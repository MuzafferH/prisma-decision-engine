// api/chat.js
// Vercel serverless function for Prisma chat API

const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT } = require('./system-prompt');
const { checkGate } = require('./_auth');

// --- Formula Validation Helpers ---

/**
 * Extract variable-like identifiers from a formula string.
 * Returns tokens that aren't math/JS built-ins.
 */
function extractFormulaIdentifiers(formula) {
  if (!formula || typeof formula !== 'string') return [];
  const tokens = formula.match(/\b[a-zA-Z_]\w*\b/g) || [];
  const safeTokens = new Set([
    'Math', 'max', 'min', 'pow', 'sqrt', 'abs', 'ceil', 'floor', 'log', 'exp', 'round',
    'PI', 'E', 'Infinity', 'NaN', 'true', 'false', 'scenario',
    'return', 'var', 'let', 'const', 'if', 'else', 'new', 'typeof'
  ]);
  return [...new Set(tokens.filter(t => !safeTokens.has(t)))];
}

/**
 * Validate that a tool call's outcome formula references only known variable IDs,
 * and that scenarios actually override at least one formula variable.
 */
function validateFormulaAgainstVariables(prismaData) {
  const outcome = prismaData.outcome;
  if (!outcome || !outcome.formula) return { valid: true };

  const variables = prismaData.variables || [];
  const variableIds = new Set(variables.map(v => v.id));

  const formulaIds = extractFormulaIdentifiers(outcome.formula);
  if (formulaIds.length === 0) return { valid: true };

  // Check: every formula identifier must be a known variable ID
  const badIds = formulaIds.filter(id => !variableIds.has(id));
  if (badIds.length > 0) {
    return {
      valid: false,
      reason: 'formula_mismatch',
      badIdentifiers: badIds,
      formulaIdentifiers: formulaIds,
      variableIds: [...variableIds]
    };
  }

  // Cross-validation: at least one formula variable must appear in a non-nothing scenario's changes
  const scenarios = prismaData.scenarios || [];
  const nonNothingScenarios = scenarios.filter(s => s.id !== 'nothing' && s.id !== 'do_nothing');

  if (nonNothingScenarios.length > 0) {
    const formulaIdSet = new Set(formulaIds);
    const hasOverlap = nonNothingScenarios.some(s => {
      if (!s.changes) return false;
      return Object.keys(s.changes).some(key => formulaIdSet.has(key));
    });

    if (!hasOverlap) {
      return {
        valid: false,
        reason: 'no_scenario_overlap',
        formulaIdentifiers: formulaIds,
        variableIds: [...variableIds],
        scenarioChangeKeys: [...new Set(nonNothingScenarios.flatMap(s => Object.keys(s.changes || {})))]
      };
    }
  }

  return { valid: true };
}

/**
 * Build a hint message for the AI to correct its formula.
 */
function buildValidationHint(validationResult, prismaData) {
  const varIds = (prismaData.variables || []).map(v => v.id);

  if (validationResult.reason === 'formula_mismatch') {
    return `Your formula references ${validationResult.badIdentifiers.map(id => '`' + id + '`').join(', ')} but the variable ids are [${varIds.map(id => '`' + id + '`').join(', ')}]. The formula MUST use exact variable ids. Also, at least one formula variable must appear in scenario changes. Regenerate the tool call with the corrected formula.`;
  }

  if (validationResult.reason === 'no_scenario_overlap') {
    return `Your formula uses variables [${validationResult.formulaIdentifiers.join(', ')}] but none of these appear in any scenario's changes (scenario change keys: [${validationResult.scenarioChangeKeys.join(', ')}]). At least one formula variable must be overridden in scenario changes so outcomes differ between scenarios. Regenerate the tool call.`;
  }

  return 'Formula validation failed. Please regenerate the tool call with correct variable ids.';
}

// In-memory rate limiting (resets on cold start, acceptable for hackathon)
const ipRequests = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

module.exports = async function handler(req, res) {
  // 1. Reject non-POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Rate limiting by IP
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const requests = (ipRequests.get(ip) || []).filter(t => t > now - WINDOW_MS);
  if (requests.length >= MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment.',
      retryAfter: Math.ceil((requests[0] + WINDOW_MS - now) / 1000)
    });
  }
  requests.push(now);
  ipRequests.set(ip, requests);

  // 2b. Password gate
  if (!checkGate(req, res)) return;

  // 3. Parse and validate input
  const { messages, forceSimulation } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required.' });
  }

  if (messages.length === 0) {
    return res.status(400).json({ error: 'Messages array cannot be empty.' });
  }

  if (messages.length > 80) {
    return res.status(400).json({
      error: 'Conversation too long. Please start a new session.',
      maxLength: 80
    });
  }

  // Validate each message
  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      return res.status(400).json({
        error: 'Each message must have role and content.',
        invalidMessage: msg
      });
    }

    if (!['user', 'assistant'].includes(msg.role)) {
      return res.status(400).json({
        error: 'Message role must be "user" or "assistant".',
        invalidRole: msg.role
      });
    }

    // Handle both string and array content formats
    // Per-type limits: CSV analysis (16K), regular chat (8K), tool results (8K)
    if (typeof msg.content === 'string') {
      const isCSVUpload = msg.content.startsWith('[CSV_UPLOAD]');
      const maxLen = isCSVUpload ? 16000 : 8000;
      if (msg.content.length > maxLen) {
        return res.status(400).json({
          error: isCSVUpload ? 'CSV analysis too long. Maximum 16000 characters.' : 'Message too long. Maximum 8000 characters.',
          messageLength: msg.content.length
        });
      }
    } else if (Array.isArray(msg.content)) {
      // For array content (tool_use / tool_result format) — no per-block limit,
      // total payload is bounded by Anthropic's own context window
    } else {
      return res.status(400).json({
        error: 'Message content must be string or array.'
      });
    }
  }

  // 4. Call Anthropic API
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set');
      return res.status(500).json({ error: 'Prisma configuration error. Please contact support.', code: 'CONFIG_ERROR' });
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Tool definition (extracted for reuse in retry)
    const tools = [{
      name: 'update_dashboard',
      description: 'Update the Prisma dashboard with data analysis, chart specs, insights, simulation scenarios, or recommendations. Call after CSV upload (data_overview), when user asks "what if?" (simulation), or to deliver final verdict.',
      input_schema: {
        type: 'object',
        properties: {
          phase: {
            type: 'string',
            enum: ['data_overview', 'simulation', 'verdict'],
            description: 'data_overview = after CSV upload (charts, KPIs, insights), simulation = Monte Carlo scenarios, verdict = final recommendation'
          },
          prismaData: {
            type: 'object',
            description: 'Partial PRISMA_DATA object. Include only fields relevant to this phase. This will be merged with existing dashboard state.',
            properties: {
              meta: {
                type: 'object',
                description: 'Metadata about the decision.',
                properties: {
                  title: { type: 'string', description: 'Short title for this decision' },
                  summary: { type: 'string', description: 'One-sentence summary of the decision context' },
                  tier: { type: 'number', description: '1 for estimated variables, 2 for data-backed analysis' },
                  generatedAt: { type: 'string', description: 'ISO timestamp' }
                }
              },
              variables: {
                type: 'array',
                description: 'Decision variables with uncertainty ranges.',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Unique identifier in snake_case' },
                    label: { type: 'string', description: 'Human-readable name' },
                    value: { type: 'number', description: 'Center/expected value' },
                    min: { type: 'number', description: 'Minimum possible value' },
                    max: { type: 'number', description: 'Maximum possible value' },
                    distribution: {
                      type: 'string',
                      enum: ['fixed', 'normal', 'uniform', 'right_skewed', 'left_skewed'],
                      description: 'Distribution shape'
                    },
                    unit: { type: 'string', description: 'Unit of measurement (e.g., "€/month", "drivers")' },
                    isInput: { type: 'boolean', description: 'Whether user can adjust this variable in UI' }
                  },
                  required: ['id', 'label', 'value', 'min', 'max', 'distribution', 'unit']
                }
              },
              edges: {
                type: 'array',
                description: 'Causal relationships between variables.',
                items: {
                  type: 'object',
                  properties: {
                    from: { type: 'string', description: 'Source variable id' },
                    to: { type: 'string', description: 'Target variable id' },
                    effect: {
                      type: 'string',
                      enum: ['positive', 'negative'],
                      description: 'positive = more A causes more B, negative = more A causes less B'
                    },
                    strength: { type: 'number', description: 'Strength of relationship (0-1)' },
                    formula: { type: 'string', description: 'Optional JavaScript formula for calculating the relationship' },
                    isFeedbackLoop: { type: 'boolean', description: 'True if this edge is part of a feedback cycle' }
                  },
                  required: ['from', 'to', 'effect', 'strength']
                }
              },
              scenarios: {
                type: 'array',
                description: 'Decision options to simulate.',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Unique scenario identifier' },
                    label: { type: 'string', description: 'Human-readable scenario name' },
                    color: { type: 'string', description: 'Hex color for visualization' },
                    changes: {
                      type: 'object',
                      description: 'Variable overrides for this scenario. Keys are variable ids.',
                      additionalProperties: {
                        type: 'object',
                        properties: {
                          value: { type: 'number' },
                          min: { type: 'number' },
                          max: { type: 'number' },
                          delta: { type: 'number', description: 'Change from baseline (for costs/revenue)' }
                        }
                      }
                    },
                    assumptions: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Key assumptions for this scenario'
                    }
                  },
                  required: ['id', 'label', 'color', 'changes', 'assumptions']
                }
              },
              outcome: {
                type: 'object',
                description: 'Primary outcome metric to optimize.',
                properties: {
                  id: { type: 'string', description: 'Outcome metric identifier' },
                  label: { type: 'string', description: 'Human-readable name' },
                  unit: { type: 'string', description: 'Unit of measurement' },
                  formula: { type: 'string', description: 'JavaScript formula using variable ids' },
                  direction: {
                    type: 'string',
                    enum: ['higher_is_better', 'lower_is_better'],
                    description: 'Whether higher values are better (revenue/savings) or worse (costs). Default: higher_is_better'
                  },
                  positiveLabel: { type: 'string', description: 'Label for positive outcomes' },
                  negativeLabel: { type: 'string', description: 'Label for negative outcomes' }
                },
                required: ['id', 'label', 'unit', 'formula']
              },
              recommendation: {
                type: 'object',
                description: 'Final recommendation with action items.',
                properties: {
                  action: { type: 'string', description: 'Specific, actionable recommendation' },
                  watch: { type: 'string', description: 'Variables to monitor closely' },
                  trigger: { type: 'string', description: 'Conditions that would change your recommendation' }
                },
                required: ['action', 'watch', 'trigger']
              },
              charts: {
                type: 'array',
                description: 'Chart specifications for data overview dashboard. Client computes values from raw CSV data.',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Unique chart ID' },
                    type: { type: 'string', enum: ['bar', 'line', 'pie', 'scatter'], description: 'Chart type' },
                    title: { type: 'string', description: 'Chart title' },
                    x: { type: 'string', description: 'Column name for x-axis' },
                    y: { type: 'string', description: 'Column name for y-axis (use "*" for row count)' },
                    aggregation: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'], description: 'How to aggregate y values' },
                    groupBy: { type: 'string', description: 'Optional column for grouping/splitting' },
                    color: { type: 'string', description: 'Primary hex color' },
                    sortOrder: { type: 'string', enum: ['desc', 'asc'], description: 'Sort order for categorical axes' }
                  },
                  required: ['id', 'type', 'title', 'x', 'y', 'aggregation']
                }
              },
              kpiCards: {
                type: 'array',
                description: 'Key metric cards for data overview.',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string', description: 'Metric name' },
                    value: { type: 'string', description: 'Formatted value string' },
                    trend: { type: 'string', enum: ['up', 'down', 'flat'], description: 'Trend direction' },
                    context: { type: 'string', description: 'Comparison or explanation' }
                  },
                  required: ['label', 'value']
                }
              },
              insights: {
                type: 'array',
                description: 'AI-surfaced insights with optional simulation hooks.',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Unique insight ID' },
                    title: { type: 'string', description: 'One-line headline with specifics' },
                    description: { type: 'string', description: '1-2 sentence explanation' },
                    type: { type: 'string', enum: ['pattern', 'risk', 'opportunity', 'anomaly'], description: 'Insight category' },
                    severity: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Importance level' },
                    simulatable: { type: 'boolean', description: 'Whether this can be simulated via Monte Carlo' },
                    simulationPrompt: { type: 'string', description: 'The what-if question for simulation' },
                    estimatedProbability: { type: 'string', description: 'Rough probability estimate if simulatable' }
                  },
                  required: ['id', 'title', 'description', 'type']
                }
              },
              dataSummary: {
                type: 'object',
                description: 'Summary of uploaded dataset.',
                properties: {
                  filename: { type: 'string' },
                  rowCount: { type: 'number' },
                  dateRange: { type: 'string' },
                  columns: { type: 'array', items: { type: 'string' } },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        required: ['phase']
      }
    }];

    // Detect CSV upload or simulation-intent and force tool use deterministically
    const lastUserMsg = messages[messages.length - 1];
    const lastMsgText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
    const isCSVUpload = typeof lastUserMsg?.content === 'string'
      && lastUserMsg.content.startsWith('[CSV_UPLOAD]');
    const isSimulationRequest = forceSimulation === true
      || /^what if\b/i.test(lastMsgText)
      || /\bsimulate\b/i.test(lastMsgText);

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: messages,
      tools: tools,
      tool_choice: (isCSVUpload || isSimulationRequest)
        ? { type: 'tool', name: 'update_dashboard' }
        : { type: 'auto' }
    });

    // 5. Parse response — extract text message + tool calls
    let message = '';
    let toolCall = null;

    for (const block of response.content) {
      if (block.type === 'text') {
        message += block.text;
      } else if (block.type === 'tool_use' && block.name === 'update_dashboard') {
        toolCall = {
          id: block.id,
          name: block.name,
          input: block.input
        };
      }
    }

    // 5b. Server-side required-fields validation for simulation phase
    if (toolCall?.input?.phase === 'simulation' && toolCall?.input?.prismaData) {
      const pd = toolCall.input.prismaData;
      const missing = [];
      if (!pd.variables || !Array.isArray(pd.variables) || pd.variables.length === 0) missing.push('variables');
      if (!pd.scenarios || !Array.isArray(pd.scenarios) || pd.scenarios.length === 0) missing.push('scenarios');
      if (!pd.outcome || !pd.outcome.formula) missing.push('outcome with formula');
      if (!pd.edges || !Array.isArray(pd.edges)) missing.push('edges');

      if (missing.length > 0 && !toolCall.input._retried) {
        console.log('[Simulation Validation] Missing fields:', missing.join(', '), '— retrying...');
        try {
          const retryMessages = [...messages, {
            role: 'assistant',
            content: [
              ...(message ? [{ type: 'text', text: message }] : []),
              { type: 'tool_use', id: toolCall.id, name: toolCall.name, input: toolCall.input }
            ]
          }, {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolCall.id, content: `VALIDATION ERROR: Missing required fields: ${missing.join(', ')}. You MUST include ALL of: variables (array), scenarios (array with "Do Nothing"), outcome (object with formula using exact variable IDs), edges (array of causal relationships). Retry now.` }]
          }];

          const retryResponse = await client.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 8000,
            system: SYSTEM_PROMPT,
            messages: retryMessages,
            tools: tools,
            tool_choice: { type: 'tool', name: 'update_dashboard' }
          });

          let retryMessage = '';
          for (const block of retryResponse.content) {
            if (block.type === 'text') retryMessage += block.text;
            if (block.type === 'tool_use' && block.name === 'update_dashboard') {
              toolCall = { id: block.id, name: block.name, input: { ...block.input, _retried: true } };
            }
          }
          if (retryMessage) message = retryMessage;
          console.log('[Simulation Validation] Retry complete');
        } catch (retryError) {
          console.error('[Simulation Validation] Retry failed:', retryError.message);
        }
      }
    }

    // 5c. Server-side formula validation + retry-with-hint
    if (toolCall?.input?.prismaData) {
      const pd = toolCall.input.prismaData;
      const validation = validateFormulaAgainstVariables(pd);

      if (validation.valid) {
        console.log('[Formula Validation] PASSED');
      } else {
        console.log('[Formula Validation] FAILED:', validation.reason, JSON.stringify(validation));

        const hintMessage = buildValidationHint(validation, pd);
        console.log('[Formula Validation] Retrying with hint...');

        try {
          // Build retry conversation: original + failed assistant response + tool_result with hint
          const retryMessages = [
            ...messages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolCall.id, content: hintMessage, is_error: true }] }
          ];

          const retryResponse = await client.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: retryMessages,
            tools: tools,
            tool_choice: { type: 'auto' }
          });

          // Parse retry response
          let retryMessage = '';
          let retryToolCall = null;
          for (const block of retryResponse.content) {
            if (block.type === 'text') {
              retryMessage += block.text;
            } else if (block.type === 'tool_use' && block.name === 'update_dashboard') {
              retryToolCall = { id: block.id, name: block.name, input: block.input };
            }
          }

          // Validate retry result
          if (retryToolCall?.input?.prismaData) {
            const retryValidation = validateFormulaAgainstVariables(retryToolCall.input.prismaData);
            if (retryValidation.valid) {
              console.log('[Formula Validation] Retry SUCCEEDED');
              message = retryMessage;
              toolCall = retryToolCall;
            } else {
              console.warn('[Formula Validation] Retry also failed:', retryValidation.reason);
              // Send original response but flag it so client can show warning
              toolCall.input._formulaWarning = true;
            }
          } else if (retryToolCall) {
            // Retry produced a tool call without prismaData (e.g., different phase) — use it
            console.log('[Formula Validation] Retry produced tool call without formula, using it');
            message = retryMessage;
            toolCall = retryToolCall;
          } else {
            // Retry produced text only, no tool call — keep original with warning
            console.warn('[Formula Validation] Retry did not produce a tool call, using original');
            toolCall.input._formulaWarning = true;
          }
        } catch (retryError) {
          console.error('[Formula Validation] Retry API call failed:', retryError.message);
          // Keep original response but flag the warning
          toolCall.input._formulaWarning = true;
        }
      }
    }

    // 6. Return sanitized response
    return res.status(200).json({
      message: message.trim(),
      toolCall: toolCall,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    });

  } catch (error) {
    // Log error type for debugging (never leak full error — could contain headers)
    console.error('Anthropic API error:', error.status || 'unknown', error.type || 'unknown_type', error.message || '');

    // Handle specific error types
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Prisma is experiencing high demand. Please try again in a moment.',
        code: 'RATE_LIMIT'
      });
    }

    if (error.status === 401) {
      return res.status(500).json({
        error: 'Prisma configuration error. Please contact support.',
        code: 'CONFIG_ERROR'
      });
    }

    if (error.status >= 500) {
      return res.status(503).json({
        error: 'Prisma is temporarily unavailable. Please try again in a moment.',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    // Generic fallback — include status for client-side debugging
    const statusHint = error.status ? ` (${error.status})` : '';
    const briefMessage = error.message ? error.message.slice(0, 120) : '';
    console.error('Anthropic API full error:', JSON.stringify({ status: error.status, type: error.type, message: error.message }));
    return res.status(500).json({
      error: `Prisma encountered an error${statusHint}. ${briefMessage}`,
      code: 'API_ERROR'
    });
  }
};
