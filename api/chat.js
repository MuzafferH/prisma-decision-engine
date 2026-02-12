// api/chat.js
// Vercel serverless function for Prisma chat API

const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT } = require('./system-prompt');

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

  // 3. Parse and validate input
  const { messages } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required.' });
  }

  if (messages.length === 0) {
    return res.status(400).json({ error: 'Messages array cannot be empty.' });
  }

  if (messages.length > 30) {
    return res.status(400).json({
      error: 'Conversation too long. Please start a new session.',
      maxLength: 30
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
    if (typeof msg.content === 'string') {
      if (msg.content.length > 2000) {
        return res.status(400).json({
          error: 'Message too long. Maximum 2000 characters.',
          messageLength: msg.content.length
        });
      }
    } else if (Array.isArray(msg.content)) {
      // For array content (tool_result format)
      for (const block of msg.content) {
        if (block.type === 'text' && block.text && block.text.length > 2000) {
          return res.status(400).json({
            error: 'Message text block too long. Maximum 2000 characters.'
          });
        }
      }
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
      description: 'Update the Prisma dashboard with decision analysis data. Call this tool whenever you have new analysis to show the user — variables, causal relationships, simulation scenarios, or recommendations. The dashboard will render the data as interactive visualizations.',
      input_schema: {
        type: 'object',
        properties: {
          phase: {
            type: 'string',
            enum: ['gathering', 'causal_graph', 'simulation', 'verdict', 'tier2_analysis'],
            description: 'Which phase of analysis this update represents. "gathering" = just chatting (do not call tool), "causal_graph" = show variables and relationships, "simulation" = define scenarios, "verdict" = deliver recommendation, "tier2_analysis" = insights from uploaded data.'
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
              feedbackLoops: {
                type: 'array',
                description: 'Identified feedback loops in the causal graph.',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'array', items: { type: 'string' }, description: 'Array of variable ids forming the loop' },
                    type: { type: 'string', enum: ['positive', 'negative'], description: 'Reinforcing or balancing loop' },
                    label: { type: 'string', description: 'Human-readable description of the loop' }
                  },
                  required: ['path', 'type', 'label']
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
              discoveries: {
                type: 'array',
                description: 'Insights from data analysis (Tier 2 only).',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Short discovery title' },
                    description: { type: 'string', description: 'Detailed explanation' },
                    impact: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Impact level' },
                    type: { type: 'string', enum: ['pattern', 'risk', 'opportunity'], description: 'Discovery type' }
                  },
                  required: ['title', 'description', 'impact', 'type']
                }
              },
              markov: {
                type: 'object',
                description: 'Markov chain configuration for state transitions over time.',
                properties: {
                  enabled: { type: 'boolean' },
                  months: { type: 'number', description: 'Number of months to simulate' },
                  entities: {
                    type: 'array',
                    description: 'Entities that transition between states (e.g., drivers, customers)',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        label: { type: 'string' },
                        initialState: { type: 'string' },
                        states: { type: 'array', items: { type: 'string' } },
                        transitions: { type: 'object', description: 'Transition probabilities matrix' },
                        scenarioTransitions: { type: 'object', description: 'Transition matrices per scenario' }
                      }
                    }
                  },
                  stateEffects: {
                    type: 'object',
                    description: 'How state changes affect variables'
                  }
                }
              }
            }
          }
        },
        required: ['phase']
      }
    }];

    const response = await client.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: messages,
      tools: tools,
      tool_choice: { type: 'auto' }
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

    // 5b. Server-side formula validation + retry-with-hint
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
            model: 'claude-opus-4-20250514',
            max_tokens: 2048,
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

    // Generic fallback
    return res.status(500).json({
      error: 'Prisma encountered an error. Please try again.',
      code: 'API_ERROR'
    });
  }
};
