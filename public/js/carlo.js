/**
 * CARLO — Monte Carlo Simulation Engine
 *
 * Runs 1,000 randomized scenarios for each decision option.
 * Named after the casino of chance.
 *
 * All functions are PURE (no DOM access, no side effects, no global state).
 *
 * NOTE: Uses new Function() for safe formula evaluation in sandboxed context.
 * This is intentional for the simulation engine to evaluate mathematical formulas.
 */

/**
 * Validate a formula string to prevent code injection.
 * Only allows: variable names, numbers, basic math ops, Math.* functions, parens, commas, dots,
 * string literals (single/double quotes for ternary comparisons), and ternary operators.
 * Rejects anything that could access globals, DOM, network, or eval.
 */
function validateFormula(formula) {
  if (typeof formula !== 'string') return false;
  if (formula.length > 1000) return false;

  // Blocklist: dangerous tokens that should never appear in a math formula
  const dangerous = /\b(fetch|eval|import|require|document|window|globalThis|self|top|parent|frames|constructor|prototype|__proto__|Function|setTimeout|setInterval|XMLHttpRequest|WebSocket|Worker|Blob|URL|location|navigator|alert|confirm|prompt|console|process|child_process|exec|spawn)\b/;
  if (dangerous.test(formula)) return false;

  // Reject template literals and bracket access (property injection)
  if (/[`\[\]]/.test(formula)) return false;

  // Reject semicolons, curly braces (block statements)
  if (/[;{}]/.test(formula)) return false;

  // Reject assignment operators (=) but allow ==, ===, !=, !==, >=, <=
  // Strategy: strip out comparison operators first, then check for remaining bare =
  const withoutComparisons = formula
    .replace(/===/g, '')
    .replace(/!==/g, '')
    .replace(/==/g, '')
    .replace(/!=/g, '')
    .replace(/>=/g, '')
    .replace(/<=/g, '');
  if (/=/.test(withoutComparisons)) return false;

  // Allowlist: only permit safe characters
  // Letters (variable names / Math), digits, math ops, parens, dots, commas, spaces,
  // underscores, ternary, comparison, single/double quotes (for string literals in ternaries)
  const allowed = /^[a-zA-Z0-9_\s+\-*/%().,:?<>=!&|^~'"]+$/;
  if (!allowed.test(formula)) return false;

  return true;
}

/**
 * Sanitize an AI-generated outcome formula to fix common issues.
 * This runs BEFORE validateFormula() and attempts to transform formulas
 * that reference undefined variables (like 'scenario') into working math.
 *
 * Returns { formula, needsScenarioId } — if the formula branches on scenario,
 * we flag it so runCarlo can inject the scenarioId.
 */
function sanitizeFormula(formula, variableIds) {
  if (typeof formula !== 'string') return { formula: '', needsScenarioId: false };

  let sanitized = formula.trim();
  let needsScenarioId = false;

  // Detect scenario-branching formulas: patterns like (scenario === 'bitcoin')
  // These reference 'scenario' which is not a variable — it's the scenario ID
  if (/\bscenario\b/.test(sanitized)) {
    needsScenarioId = true;
    // No other transformation needed — we'll inject 'scenario' as an arg at eval time
  }

  return { formula: sanitized, needsScenarioId };
}

const Carlo = {
  /**
   * Sample a random value from a variable's distribution
   *
   * @param {Object} variable - Variable object with {value, min, max, distribution}
   * @returns {number} Random sample from the distribution
   */
  sampleFromDistribution(variable) {
    const { value, min, max, distribution } = variable;

    switch (distribution) {
      case 'fixed':
        return value;

      case 'uniform':
        return min + Math.random() * (max - min);

      case 'normal': {
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

        // Standard deviation = (max - min) / 6 (so 99.7% falls within range)
        const stdDev = (max - min) / 6;
        const sample = value + z * stdDev;

        // Truncate to [min, max]
        return Math.max(min, Math.min(max, sample));
      }

      case 'right_skewed': {
        // Log-normal transformation: more values near min, long tail to max
        // Use exponential distribution shape scaled to range
        const u = Math.random();
        // Transform to exponential decay
        const lambda = 2.5; // Controls skew intensity
        const t = -Math.log(1 - u) / lambda;
        // Scale to [0, 1] range (capped at reasonable value)
        const normalized = Math.min(t, 3) / 3;
        // Map to [min, max]
        return min + normalized * (max - min);
      }

      case 'left_skewed': {
        // Mirror of right_skewed: cluster near max, tail to min
        const u = Math.random();
        const lambda = 2.5;
        const t = -Math.log(1 - u) / lambda;
        const normalized = Math.min(t, 3) / 3;
        // Invert to create left skew
        return max - normalized * (max - min);
      }

      default:
        console.warn(`Unknown distribution type: ${distribution}, using uniform`);
        return min + Math.random() * (max - min);
    }
  },

  /**
   * Apply scenario changes to variables array
   *
   * @param {Array} variables - Original variables array
   * @param {Object} scenario - Scenario object with changes
   * @returns {Array} New variables array with changes applied
   */
  applyScenarioChanges(variables, scenario) {
    if (!scenario.changes || Object.keys(scenario.changes).length === 0) {
      // No changes (e.g., "do nothing" scenario)
      return variables.map(v => ({ ...v }));
    }

    return variables.map(variable => {
      const change = scenario.changes[variable.id];
      if (!change) {
        return { ...variable };
      }

      const updated = { ...variable };

      // Apply value override
      if (change.value !== undefined) {
        updated.value = change.value;
      }

      // Apply min/max overrides
      if (change.min !== undefined) {
        updated.min = change.min;
      }
      if (change.max !== undefined) {
        updated.max = change.max;
      }

      // Apply delta (additive change)
      if (change.delta !== undefined) {
        updated.value += change.delta;
        // Adjust bounds proportionally
        const range = updated.max - updated.min;
        updated.min += change.delta;
        updated.max += change.delta;
      }

      return updated;
    });
  },

  /**
   * Safely split an edge formula into target variable and expression.
   * Handles formulas with === and == by only splitting on bare = (assignment).
   *
   * @param {string} formula - Edge formula like "target_var = expression"
   * @returns {{ target: string, expression: string } | null} Parsed result or null
   */
  parseEdgeFormula(formula) {
    if (!formula || typeof formula !== 'string') return null;

    // Find the first bare = that is NOT part of ==, ===, !=, !==, >=, <=
    // We scan character by character
    for (let i = 0; i < formula.length; i++) {
      if (formula[i] === '=') {
        // Check it's not part of ==, ===
        if (formula[i + 1] === '=') continue; // skip == or ===
        // Check it's not preceded by !, <, >, or another =
        if (i > 0 && (formula[i - 1] === '!' || formula[i - 1] === '<' || formula[i - 1] === '>' || formula[i - 1] === '=')) continue;

        const target = formula.substring(0, i).trim();
        const expression = formula.substring(i + 1).trim();
        if (target && expression) {
          return { target, expression };
        }
      }
    }

    return null;
  },

  /**
   * Evaluate outcome by walking the causal graph
   *
   * @param {Object} variableValues - Map of {variableId: sampledValue}
   * @param {Array} edges - Causal graph edges
   * @param {string} outcomeFormula - Formula to calculate final outcome
   * @returns {number} Final outcome value
   */
  evaluateOutcome(variableValues, edges, outcomeFormula) {
    // Create a working copy of variable values (will be updated by edges)
    const values = { ...variableValues };

    // Track which variables have been processed to avoid infinite loops
    const processed = new Set();
    const maxIterations = 100; // Safety limit for circular dependencies
    let iteration = 0;

    // Process edges: propagate effects through the causal graph
    // We may need multiple passes for multi-hop dependencies
    let changed = true;
    while (changed && iteration < maxIterations) {
      changed = false;
      iteration++;

      for (const edge of edges) {
        const sourceValue = values[edge.from];
        if (sourceValue === undefined) continue;

        const edgeKey = `${edge.from}->${edge.to}`;
        if (processed.has(edgeKey)) continue;

        if (edge.formula) {
          // Use explicit formula if provided (validated against injection)
          try {
            const parsed = this.parseEdgeFormula(edge.formula);
            if (parsed) {
              const evalContext = { ...values, Math };
              if (!validateFormula(parsed.expression)) {
                console.warn(`Rejected unsafe formula for edge ${edge.from}->${edge.to}: "${parsed.expression}"`);
              } else {
                // NOTE: new Function() is intentional here — formulas are AI-generated math
                // expressions that have been validated by validateFormula() above.
                const evalFunc = new Function(...Object.keys(evalContext), `return ${parsed.expression}`);
                const result = evalFunc(...Object.values(evalContext));

                if (!isNaN(result) && isFinite(result)) {
                  values[edge.to] = result;
                  changed = true;
                }
              }
            } else {
              // No assignment found — treat the whole formula as an expression
              const evalContext = { ...values, Math };
              if (validateFormula(edge.formula)) {
                const evalFunc = new Function(...Object.keys(evalContext), `return ${edge.formula}`);
                const result = evalFunc(...Object.values(evalContext));
                if (!isNaN(result) && isFinite(result)) {
                  values[edge.to] = result;
                  changed = true;
                }
              }
            }
          } catch (e) {
            console.warn(`Formula evaluation failed for edge ${edge.from}->${edge.to}:`, e.message);
          }
        } else {
          // Use strength-based propagation
          const currentValue = values[edge.to] || 0;
          const effect = edge.effect === 'positive' ? 1 : -1;
          const strength = edge.strength || 0.5;

          const delta = sourceValue * strength * 0.1 * effect;
          values[edge.to] = currentValue + delta;
          changed = true;
        }

        processed.add(edgeKey);
      }
    }

    // Calculate final outcome using the formula (validated against injection)
    if (outcomeFormula) {
      if (!validateFormula(outcomeFormula)) {
        console.warn('Rejected unsafe outcome formula:', outcomeFormula);
        return 0;
      }
      try {
        const evalContext = { ...values, Math };
        // NOTE: new Function() is intentional — validated math formula from AI
        const evalFunc = new Function(...Object.keys(evalContext), `return ${outcomeFormula}`);
        const outcome = evalFunc(...Object.values(evalContext));
        return outcome;
      } catch (e) {
        console.warn(`Outcome formula evaluation failed:`, e.message);
        return values[outcomeFormula] || 0;
      }
    }

    // No formula: return 0 (should not happen in normal usage)
    return 0;
  },

  /**
   * Run Monte Carlo simulation for a specific scenario
   *
   * @param {Object} prismaData - Complete PRISMA_DATA object
   * @param {string} scenarioId - ID of the scenario to simulate
   * @param {number} iterations - Number of simulation runs (default: 1000)
   * @returns {Array<number>} Array of outcome values
   */
  runCarlo(prismaData, scenarioId, iterations = 1000) {
    // Find the scenario
    const scenario = prismaData.scenarios.find(s => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    // Apply scenario changes to variables
    const scenarioVariables = this.applyScenarioChanges(prismaData.variables, scenario);

    // Defense-in-depth: check formula identifiers against variable keys
    const rawOutcomeFormula = prismaData.outcome?.formula;
    if (rawOutcomeFormula) {
      const formulaTokens = (rawOutcomeFormula.match(/\b[a-zA-Z_]\w*\b/g) || []);
      const safeTokens = new Set([
        'Math', 'max', 'min', 'pow', 'sqrt', 'abs', 'ceil', 'floor', 'log', 'exp', 'round',
        'PI', 'E', 'Infinity', 'NaN', 'true', 'false', 'scenario',
        'return', 'var', 'let', 'const', 'if', 'else', 'new', 'typeof'
      ]);
      const varIds = new Set(prismaData.variables.map(v => v.id));
      const unknownIds = [...new Set(formulaTokens.filter(t => !safeTokens.has(t) && !varIds.has(t)))];
      if (unknownIds.length > 0) {
        console.warn(`[Carlo] Formula references unknown identifiers: [${unknownIds.join(', ')}]. Known variable ids: [${[...varIds].join(', ')}]. Formula: "${rawOutcomeFormula}"`);
      }
    }
    const variableIds = prismaData.variables.map(v => v.id);
    const { formula: outcomeFormula, needsScenarioId } = sanitizeFormula(rawOutcomeFormula, variableIds);

    // Validate the formula upfront (log once, not per iteration)
    const formulaIsValid = outcomeFormula && validateFormula(outcomeFormula);
    if (outcomeFormula && !formulaIsValid) {
      console.warn(`[Carlo] Outcome formula REJECTED by validateFormula for scenario "${scenarioId}":`, outcomeFormula);
    }

    // Calculate baseline profit using formula with default variable values
    let baselineProfitValue = 0;
    if (formulaIsValid) {
      try {
        const baseValues = {};
        for (const v of prismaData.variables) {
          baseValues[v.id] = v.value;
        }
        // If formula needs scenario ID, inject it for baseline (use 'nothing' or first scenario)
        if (needsScenarioId) {
          baseValues.scenario = 'nothing';
        }
        const varNames = Object.keys(baseValues);
        const varVals = Object.values(baseValues);
        // NOTE: new Function() is intentional — validated math formula from AI
        const baseFunc = new Function(...varNames, 'return ' + outcomeFormula);
        baselineProfitValue = baseFunc(...varVals);
        if (isNaN(baselineProfitValue) || !isFinite(baselineProfitValue)) baselineProfitValue = 0;
      } catch (e) {
        console.warn(`[Carlo] Baseline formula evaluation failed:`, e.message);
        baselineProfitValue = 0;
      }
    }

    const outcomes = [];
    let formulaErrorLogged = false;

    // Run iterations
    for (let i = 0; i < iterations; i++) {
      // Sample each variable
      const variableValues = {};
      for (const variable of scenarioVariables) {
        variableValues[variable.id] = this.sampleFromDistribution(variable);
      }

      // Apply causal graph edges to propagate effects
      // We need to process edges in order, respecting dependencies
      const values = { ...variableValues };

      // Process edges: walk through causal graph
      for (const edge of prismaData.edges) {
        const sourceValue = values[edge.from];
        if (sourceValue === undefined) continue;

        if (edge.formula) {
          // Use explicit formula (validated against injection)
          try {
            const parsed = this.parseEdgeFormula(edge.formula);
            if (parsed) {
              const evalContext = { ...values, Math };
              if (validateFormula(parsed.expression)) {
                const varNames = Object.keys(evalContext);
                const varValues = Object.values(evalContext);
                // NOTE: new Function() is intentional — validated math formula from AI
                const evalFunc = new Function(...varNames, `return ${parsed.expression}`);
                const result = evalFunc(...varValues);

                if (!isNaN(result) && isFinite(result)) {
                  values[parsed.target] = result;
                }
              }
            }
          } catch (e) {
            // Silent fail for formula errors in Monte Carlo (don't spam console)
          }
        } else {
          // Use strength-based propagation for edges without formulas
          const effect = edge.effect === 'positive' ? 1 : -1;
          const strength = edge.strength || 0.5;
          const delta = sourceValue * strength * 0.1 * effect;

          if (values[edge.to] !== undefined) {
            values[edge.to] += delta;
          }
        }
      }

      // Calculate outcome using the outcome formula on RAW sampled values
      // (not edge-modified values, to avoid double-counting causal effects)
      let outcomeValue = 0;
      if (formulaIsValid) {
        try {
          const evalVars = { ...variableValues };
          // Inject scenario ID if formula references it
          if (needsScenarioId) {
            evalVars.scenario = scenarioId;
          }
          const varNames = Object.keys(evalVars);
          const varValues = Object.values(evalVars);
          // NOTE: new Function() is intentional — validated math formula from AI
          const evalFunc = new Function(...varNames, 'return ' + outcomeFormula);
          outcomeValue = evalFunc(...varValues);
          if (isNaN(outcomeValue) || !isFinite(outcomeValue)) outcomeValue = 0;
        } catch (e) {
          if (!formulaErrorLogged) {
            console.warn(`[Carlo] Outcome formula eval error (scenario="${scenarioId}"):`, e.message, '| Formula:', outcomeFormula);
            formulaErrorLogged = true;
          }
          outcomeValue = 0;
        }
      } else {
        outcomeValue = values['monthly_profit'] || 0;
      }

      // Delta from baseline
      const outcome = outcomeValue - baselineProfitValue;
      outcomes.push(outcome);
    }

    return outcomes;
  },

  /**
   * Run Monte Carlo for ALL scenarios
   *
   * @param {Object} prismaData - Complete PRISMA_DATA object
   * @param {number} iterations - Number of simulation runs per scenario (default: 1000)
   * @returns {Object} Results for all scenarios: {scenarioId: {outcomes, summary}}
   */
  runCarloAllScenarios(prismaData, iterations = 1000) {
    const results = {};

    for (const scenario of prismaData.scenarios) {
      const outcomes = this.runCarlo(prismaData, scenario.id, iterations);
      results[scenario.id] = {
        outcomes,
        summary: this.summarizeResults(outcomes)
      };
    }

    return results;
  },

  /**
   * Calculate summary statistics from outcome array
   *
   * @param {Array<number>} outcomes - Array of outcome values
   * @returns {Object} Summary statistics
   */
  summarizeResults(outcomes) {
    if (!outcomes || outcomes.length === 0) {
      return {
        median: 0,
        mean: 0,
        p10: 0,
        p25: 0,
        p75: 0,
        p90: 0,
        min: 0,
        max: 0,
        std: 0,
        percentPositive: 0,
        percentNegative: 0
      };
    }

    // Sort for percentile calculations
    const sorted = [...outcomes].sort((a, b) => a - b);
    const n = sorted.length;

    // Percentile helper
    const percentile = (p) => {
      const index = Math.floor(p * n);
      return sorted[Math.min(index, n - 1)];
    };

    // Mean
    const mean = outcomes.reduce((sum, val) => sum + val, 0) / n;

    // Standard deviation
    const variance = outcomes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const std = Math.sqrt(variance);

    // Count positive and negative outcomes
    const positiveCount = outcomes.filter(x => x > 0).length;
    const negativeCount = outcomes.filter(x => x < 0).length;

    return {
      median: percentile(0.5),
      mean,
      p10: percentile(0.1),
      p25: percentile(0.25),
      p75: percentile(0.75),
      p90: percentile(0.9),
      min: sorted[0],
      max: sorted[n - 1],
      std,
      percentPositive: (positiveCount / n) * 100,
      percentNegative: (negativeCount / n) * 100
    };
  }
};

// For inline HTML usage (no module export needed)
// The Carlo object is now available globally
