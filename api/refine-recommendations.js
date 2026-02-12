// api/refine-recommendations.js
// Vercel serverless function for AI-refined slider recommendations

const Anthropic = require('@anthropic-ai/sdk');
const { checkGate } = require('./_auth');

// Rate limiting: 20/min per IP (higher than chat since these are small, fast calls)
const ipRequests = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20;

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
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
  requests.push(now);
  ipRequests.set(ip, requests);

  // 2b. Password gate
  if (!checkGate(req, res)) return;

  // 3. Parse and validate input
  const body = req.body || {};
  const { bestScenario, runnerUp, topVariable, unit, percentPositive, median } = body;

  // Validate required fields
  if (!bestScenario || typeof bestScenario.label !== 'string' || typeof bestScenario.score !== 'number') {
    return res.status(400).json({ error: 'bestScenario with label and score required.' });
  }

  // Validate string lengths (< 200 chars each)
  if (bestScenario.label.length > 200) {
    return res.status(400).json({ error: 'bestScenario.label too long.' });
  }
  if (runnerUp && typeof runnerUp.label === 'string' && runnerUp.label.length > 200) {
    return res.status(400).json({ error: 'runnerUp.label too long.' });
  }
  if (topVariable && typeof topVariable.label === 'string' && topVariable.label.length > 200) {
    return res.status(400).json({ error: 'topVariable.label too long.' });
  }
  if (typeof unit === 'string' && unit.length > 200) {
    return res.status(400).json({ error: 'unit too long.' });
  }

  // Validate numbers are in sane range
  if (bestScenario.score < 0 || bestScenario.score > 100) {
    return res.status(400).json({ error: 'bestScenario.score must be 0-100.' });
  }
  if (runnerUp && typeof runnerUp.score === 'number' && (runnerUp.score < 0 || runnerUp.score > 100)) {
    return res.status(400).json({ error: 'runnerUp.score must be 0-100.' });
  }

  // 4. Build prompt
  const context = [
    `Best scenario: "${bestScenario.label}" scoring ${bestScenario.score}/100`,
    `${percentPositive || '?'}% of simulated futures are positive`,
    `Median outcome: ${median || 0} ${unit || ''}`,
    runnerUp ? `Runner-up: "${runnerUp.label}" scoring ${runnerUp.score}/100` : 'No runner-up scenario',
    topVariable ? `Most influential variable: "${topVariable.label}" (swings outcome by ${topVariable.swing || '?'} ${unit || ''})` : 'No top variable identified'
  ].join('. ');

  const prompt = `You are a concise decision advisor. Given these Monte Carlo simulation results, write exactly 3 recommendation cards. Each must be 1-2 sentences, natural and direct — no jargon, no bullet points, no hedging.

Simulation context: ${context}

Return a JSON object with exactly these 3 keys:
- "action": What to do (reference the winning scenario by name, include the score and key stat)
- "watch": What variable to monitor (reference the most influential variable, explain why it matters)
- "trigger": When to reconsider (reference the runner-up scenario if available, specify what would flip the decision)

Return ONLY the JSON object, no markdown fencing, no explanation.`;

  // 5. Call Anthropic API
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });

    // Extract text
    let text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Strip markdown fences if present (```json ... ```)
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    // Parse JSON from response
    const parsed = JSON.parse(text);

    // Validate response shape
    if (!parsed.action || !parsed.watch || !parsed.trigger) {
      return res.status(500).json({ error: 'Invalid AI response shape.' });
    }

    // Enforce length limits
    const action = String(parsed.action).slice(0, 500);
    const watch = String(parsed.watch).slice(0, 500);
    const trigger = String(parsed.trigger).slice(0, 500);

    return res.status(200).json({ action, watch, trigger });

  } catch (error) {
    console.error('Refine API error:', error.status || 'unknown', error.type || 'unknown_type', error.message || '');

    if (error.status === 429) {
      return res.status(429).json({ error: 'High demand. Please try again.' });
    }
    if (error instanceof SyntaxError) {
      return res.status(500).json({ error: 'Failed to parse AI response.' });
    }

    return res.status(500).json({ error: 'Refinement failed.' });
  }
};
