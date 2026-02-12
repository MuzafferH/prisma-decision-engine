/**
 * NASSIM — Risk Classification + Sensitivity Analysis Engine
 *
 * Classifies decisions using pure mathematical analysis:
 * - Success rate (% of positive outcomes)
 * - Risk-reward ratio (upside vs downside)
 * - Tail risk severity (worst 10% vs median)
 *
 * Also runs sensitivity analysis to identify which variables matter most.
 *
 * All functions are PURE (no DOM access, no side effects, no global state).
 */

const Nassim = {
  /**
   * Classify a decision based on simulation statistics.
   * Uses percentage positive, risk-reward ratio, and tail risk.
   *
   * Risk tiers:
   *   STRONG:        >75% positive, positive median, manageable downside
   *   LOW_RISK:      >60% positive, manageable downside
   *   MODERATE_RISK: 40-60% positive
   *   HIGH_RISK:     <40% positive OR catastrophic tail risk
   *
   * @param {Array<number>} outcomes - Array of outcome values from Monte Carlo
   * @returns {Object} Classification result
   */
  classifyTaleb(outcomes) {
    const sorted = [...outcomes].sort((a, b) => a - b);
    const n = sorted.length;

    const median = sorted[Math.floor(n * 0.5)];
    const p10 = sorted[Math.floor(n * 0.1)];
    const p90 = sorted[Math.floor(n * 0.9)];

    const positiveCount = outcomes.filter(x => x > 0).length;
    const negativeCount = outcomes.filter(x => x < 0).length;
    const percentPositive = (positiveCount / n) * 100;
    const percentNegative = (negativeCount / n) * 100;

    const absMedian = Math.abs(median);

    // Risk-reward ratio: how much upside per unit of downside
    const upside = p90 > 0 ? p90 : 0;
    const downside = p10 < 0 ? Math.abs(p10) : 0;
    const riskRewardRatio = downside > 0 ? upside / downside : upside > 0 ? 10 : 1;

    // Tail risk: is the worst case catastrophic relative to the median?
    const hasCatastrophicTail = absMedian > 0 && Math.abs(p10) > absMedian * 3;

    // Classify based on pure statistics
    let classification, reasoning;

    if (percentPositive > 75 && median > 0 && !hasCatastrophicTail) {
      classification = 'STRONG';
      reasoning = `This decision works in ${percentPositive.toFixed(0)}% of simulated futures with a positive median outcome. Risk-reward ratio: ${riskRewardRatio.toFixed(1)}x.`;
    } else if (percentPositive > 60 && !hasCatastrophicTail) {
      classification = 'LOW_RISK';
      reasoning = `This decision works in ${percentPositive.toFixed(0)}% of futures. Downside is manageable — worst 10% of outcomes: ${Math.abs(p10).toFixed(0)}.`;
    } else if (percentPositive >= 40) {
      classification = 'MODERATE_RISK';
      reasoning = `This could go either way — ${percentPositive.toFixed(0)}% of futures are positive. Consider risk mitigation before committing.`;
    } else {
      classification = 'HIGH_RISK';
      if (hasCatastrophicTail) {
        reasoning = `Only ${percentPositive.toFixed(0)}% of futures are positive, and the worst 10% show severe losses of ${Math.abs(p10).toFixed(0)}. High downside risk.`;
      } else {
        reasoning = `This decision fails in ${percentNegative.toFixed(0)}% of simulated futures. Proceed with caution.`;
      }
    }

    return {
      classification,
      percentPositive,
      percentNegative,
      medianOutcome: median,
      worstCase: p10,
      bestCase: p90,
      riskRewardRatio,
      reasoning
    };
  },

  /**
   * Classify all scenarios — pure statistical analysis, no extra simulations needed.
   *
   * @param {Object} carloResults - Results from Carlo.runCarloAllScenarios()
   * @param {Object} prismaData - Complete PRISMA_DATA object (unused, kept for API compat)
   * @returns {Object} Classification results per scenario
   */
  classifyAllScenarios(carloResults, prismaData) {
    const classifications = {};

    for (const scenarioId in carloResults) {
      classifications[scenarioId] = this.classifyTaleb(carloResults[scenarioId].outcomes);
    }

    return classifications;
  },

  /**
   * Run sensitivity analysis to find which variables matter most
   * Tests ALL non-fixed variables (not just isInput) for comprehensive ranking.
   *
   * Two-phase execution:
   *   Phase 1 (sync): Variables appearing in the outcome formula — fast, returns immediately
   *   Phase 2 (async): Remaining non-fixed variables — runs via requestIdleCallback, calls onComplete
   *
   * @param {Object} prismaData - Complete PRISMA_DATA object
   * @param {string} scenarioId - Scenario to analyze
   * @param {number} iterations - Number of Carlo iterations per variable test (default: 300)
   * @param {Function} onComplete - Optional callback when Phase 2 finishes with full results
   * @returns {Array} Phase 1 results (formula variables only), sorted by totalSwing
   */
  runFullSensitivity(prismaData, scenarioId, iterations = 300, onComplete = null) {
    // Get baseline
    const baselineOutcomes = Carlo.runCarlo(prismaData, scenarioId, iterations);
    const baselineSorted = [...baselineOutcomes].sort((a, b) => a - b);
    const baselineMedian = baselineSorted[Math.floor(baselineSorted.length * 0.5)];

    // All non-fixed variables
    const nonFixedVars = prismaData.variables.filter(v => v.distribution !== 'fixed');
    if (nonFixedVars.length === 0) return [];

    // Parse outcome formula to find which variable IDs it references
    const formulaStr = prismaData.outcome?.formula || '';
    const formulaVarIds = new Set();
    for (const v of prismaData.variables) {
      if (formulaStr.includes(v.id)) formulaVarIds.add(v.id);
    }

    // Split into Phase 1 (formula vars) and Phase 2 (rest)
    const phase1Vars = nonFixedVars.filter(v => formulaVarIds.has(v.id));
    const phase2Vars = nonFixedVars.filter(v => !formulaVarIds.has(v.id));

    const testVariable = (variable) => {
      // Test at MIN
      const dataAtMin = JSON.parse(JSON.stringify(prismaData));
      const varAtMin = dataAtMin.variables.find(v => v.id === variable.id);
      varAtMin.value = varAtMin.min;
      varAtMin.max = varAtMin.min;
      varAtMin.distribution = 'fixed';
      const outcomesAtMin = Carlo.runCarlo(dataAtMin, scenarioId, iterations);
      const sortedAtMin = [...outcomesAtMin].sort((a, b) => a - b);
      const medianAtMin = sortedAtMin[Math.floor(sortedAtMin.length * 0.5)];

      // Test at MAX
      const dataAtMax = JSON.parse(JSON.stringify(prismaData));
      const varAtMax = dataAtMax.variables.find(v => v.id === variable.id);
      varAtMax.value = varAtMax.max;
      varAtMax.min = varAtMax.max;
      varAtMax.distribution = 'fixed';
      const outcomesAtMax = Carlo.runCarlo(dataAtMax, scenarioId, iterations);
      const sortedAtMax = [...outcomesAtMax].sort((a, b) => a - b);
      const medianAtMax = sortedAtMax[Math.floor(sortedAtMax.length * 0.5)];

      return {
        variableId: variable.id,
        variableLabel: variable.label,
        impactLow: medianAtMin - baselineMedian,
        impactHigh: medianAtMax - baselineMedian,
        totalSwing: Math.abs((medianAtMax - baselineMedian) - (medianAtMin - baselineMedian)),
        baselineMedian
      };
    };

    // Phase 1: test formula variables synchronously
    const phase1Results = phase1Vars.map(testVariable);
    phase1Results.sort((a, b) => b.totalSwing - a.totalSwing);

    // Phase 2: test remaining variables asynchronously
    if (phase2Vars.length > 0 && onComplete) {
      const runPhase2 = () => {
        const phase2Results = phase2Vars.map(testVariable);
        const allResults = [...phase1Results, ...phase2Results];
        allResults.sort((a, b) => b.totalSwing - a.totalSwing);
        onComplete(allResults);
      };

      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(runPhase2);
      } else {
        setTimeout(runPhase2, 50);
      }
    } else if (onComplete) {
      // No phase 2 vars, call back with phase 1 results
      onComplete(phase1Results);
    }

    return phase1Results;
  },

  /**
   * Legacy wrapper — kept for backward compatibility with Layer 2/3
   */
  runSensitivity(prismaData, scenarioId, iterations = 500) {
    return this.runFullSensitivity(prismaData, scenarioId, iterations);
  },

  /**
   * Get top N most impactful variables from sensitivity results
   *
   * @param {Array} sensitivityResults - Output from runSensitivity()
   * @param {number} n - Number of top variables to return (default: 3)
   * @returns {Array} Top N variables sorted by impact
   */
  getTopVariables(sensitivityResults, n = 3) {
    return sensitivityResults.slice(0, n);
  },

  /**
   * Compute a 0-100 decision score from pure simulation statistics.
   *
   * Formula: weighted combination of:
   *   - % positive outcomes (70% weight — the most important signal)
   *   - Risk-reward ratio bonus/penalty (20% weight)
   *   - Median direction bonus (10% weight — positive median = small boost)
   *
   * Score mapping:
   *   80-100 green: "This looks strong"
   *   60-79  green: "Solid bet with manageable downside"
   *   40-59  amber: "This could go either way"
   *   20-39  red:   "Proceed with caution"
   *   0-19   red:   "This is risky"
   *
   * @param {Object} classification - Result from classifyTaleb()
   * @returns {number} Score 0-100
   */
  computeDecisionScore(classification) {
    if (!classification) return 50;

    const pctPositive = classification.percentPositive;
    const rr = classification.riskRewardRatio || 1;
    const median = classification.medianOutcome || 0;

    // 70% weight: percentage of positive outcomes (0-100 → 0-70)
    let score = pctPositive * 0.7;

    // 20% weight: risk-reward ratio (capped contribution of 0-20 points)
    // rr > 2 = good (bonus), rr < 0.5 = bad (penalty)
    const rrBonus = Math.max(-20, Math.min(20, (rr - 1) * 10));
    score += rrBonus;

    // 10% weight: positive median gets a small boost (0-10 points)
    if (median > 0) score += 10;

    // Clamp to 0-100
    return Math.round(Math.max(0, Math.min(100, score)));
  },

  /**
   * Generate plain-English verdict from classification + simulation data
   *
   * @param {Object} classification - Result from classifyTaleb()
   * @param {Object} summary - Carlo summary for best scenario
   * @param {Object} prismaState - Full state
   * @param {string} [bestScenarioLabel] - Optional: include scenario name in headline
   * @returns {Object} {headline, summaryParts, riskParts, score, color}
   */
  generateVerdict(classification, summary, prismaState, bestScenarioLabel) {
    if (!classification || !summary) {
      return { headline: 'Analyzing...', summary: '', risk: '', score: 50, color: '#F59E0B' };
    }

    const score = this.computeDecisionScore(classification);
    const unit = prismaState.outcome?.unit || '';
    const cls = classification.classification;

    // Headline — honest about the situation, scenario name only when it's actually good
    let headline;
    if (score >= 80) headline = bestScenarioLabel ? `${bestScenarioLabel} looks strong` : 'This looks strong';
    else if (score >= 60) headline = bestScenarioLabel ? `${bestScenarioLabel} is a solid bet` : 'Solid bet with manageable downside';
    else if (score >= 40) headline = 'This could go either way';
    else if (score >= 20) headline = 'The odds aren\'t great';
    else headline = 'All options carry significant risk';

    // Color from score
    let color;
    if (score >= 60) color = '#10B981';
    else if (score >= 40) color = '#F59E0B';
    else color = '#EF4444';

    // Summary — conversational, not technical
    const medianStr = Visualizations._formatNumber(Math.abs(summary.median)) + ' ' + unit;
    const pctRound = Math.round(classification.percentPositive);
    let summaryParts;

    if (summary.median >= 0 && pctRound >= 60) {
      // Positive outcome, good odds
      summaryParts = [
        { text: 'You\'d likely ' },
        { text: 'gain about ' + medianStr, bold: true },
        { text: '. ' },
        { text: pctRound + ' out of 100', bold: true },
        { text: ' simulated futures come out ahead.' }
      ];
    } else if (summary.median >= 0) {
      // Positive outcome, borderline odds
      summaryParts = [
        { text: 'The typical outcome is a ' },
        { text: 'gain of ' + medianStr, bold: true },
        { text: ', but only ' },
        { text: pctRound + ' out of 100', bold: true },
        { text: ' futures are positive. It\'s a coin toss.' }
      ];
    } else if (pctRound >= 20) {
      // Negative outcome, some hope
      summaryParts = [
        { text: 'You\'d most likely ' },
        { text: 'lose about ' + medianStr, bold: true },
        { text: '. Only ' },
        { text: pctRound + ' out of 100', bold: true },
        { text: ' futures come out ahead.' }
      ];
    } else {
      // Negative outcome, very few positive futures
      summaryParts = [
        { text: 'You\'d most likely ' },
        { text: 'lose about ' + medianStr, bold: true },
        { text: '. Almost none of the simulated futures (' },
        { text: pctRound + '%', bold: true },
        { text: ') come out positive.' }
      ];
    }

    // Risk — plain language
    let riskParts = [];
    const p10Str = Visualizations._formatNumber(Math.abs(summary.p10)) + ' ' + unit;
    if (summary.p10 < 0) {
      riskParts = [
        { text: 'Worst case (bottom 10%): you could lose up to ' },
        { text: p10Str, bold: true },
        { text: '.' }
      ];
    } else {
      riskParts = [
        { text: 'Even in the worst scenarios, you\'d still be at ' },
        { text: Visualizations._formatNumber(summary.p10) + ' ' + unit, bold: true },
        { text: '.' }
      ];
    }

    // Context line: adapts language based on score
    const decisionTitle = prismaState.meta?.title || '';
    let context;
    if (!bestScenarioLabel) {
      context = decisionTitle;
    } else if (score >= 60) {
      context = `${decisionTitle} — best option: ${bestScenarioLabel}`;
    } else if (score >= 30) {
      context = `${decisionTitle} — closest option: ${bestScenarioLabel}`;
    } else {
      context = `${decisionTitle} — all options are risky, ${bestScenarioLabel} scores highest`;
    }

    return { context, headline, summaryParts, riskParts, score, color };
  }
};

// For inline HTML usage (no module export needed)
// The Nassim object is now available globally
