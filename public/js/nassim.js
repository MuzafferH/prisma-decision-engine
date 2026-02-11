/**
 * NASSIM — Taleb Classification + Sensitivity Analysis Engine
 *
 * Classifies decisions using the Taleb framework:
 * - FRAGILE: Breaks under stress
 * - ROBUST: Survives most stress
 * - ANTIFRAGILE: Benefits from chaos
 *
 * Also runs sensitivity analysis to identify which variables matter most.
 * Named after Nassim Nicholas Taleb.
 *
 * All functions are PURE (no DOM access, no side effects, no global state).
 */

const Nassim = {
  /**
   * Classify a decision using Taleb framework
   *
   * @param {Array<number>} outcomes - Array of 1,000 outcome values from Monte Carlo
   * @param {Array<number>} highVarianceOutcomes - Optional: outcomes from high-variance run (for antifragile detection)
   * @returns {Object} Classification result with {classification, confidence, percentPositive, percentNegative, medianOutcome, worstCase, bestCase, reasoning}
   */
  classifyTaleb(outcomes, highVarianceOutcomes = null) {
    // Sort for percentile calculations
    const sorted = [...outcomes].sort((a, b) => a - b);
    const n = sorted.length;

    // Calculate key statistics
    const median = sorted[Math.floor(n * 0.5)];
    const p10 = sorted[Math.floor(n * 0.1)]; // Worst 10%
    const p90 = sorted[Math.floor(n * 0.9)]; // Best 10%

    // Count positive and negative outcomes
    const positiveCount = outcomes.filter(x => x > 0).length;
    const negativeCount = outcomes.filter(x => x < 0).length;
    const percentPositive = (positiveCount / n) * 100;
    const percentNegative = (negativeCount / n) * 100;

    const absMedian = Math.abs(median);

    // Check for ANTIFRAGILE first (if we have high-variance data)
    if (highVarianceOutcomes && highVarianceOutcomes.length > 0) {
      const highVarSorted = [...highVarianceOutcomes].sort((a, b) => a - b);
      const highVarMedian = highVarSorted[Math.floor(highVarSorted.length * 0.5)];

      // If high-variance outcomes are better than normal outcomes, it's antifragile
      const improvement = highVarMedian - median;
      const improvementRatio = absMedian > 0 ? improvement / absMedian : 0;

      if (improvement > 0 && improvementRatio > 0.15) {
        // At least 15% improvement under chaos
        const confidence = Math.min(0.95, 0.6 + improvementRatio * 0.5);
        return {
          classification: 'ANTIFRAGILE',
          confidence,
          percentPositive,
          percentNegative,
          medianOutcome: median,
          worstCase: p10,
          bestCase: p90,
          reasoning: `This decision actually benefits from volatility. Under high uncertainty, the median outcome improves by ${Math.abs(improvement).toFixed(0)} (${(improvementRatio * 100).toFixed(0)}% better). The more chaotic the environment, the better it performs.`
        };
      }
    }

    // Check for FRAGILE
    const isCatastrophicTail = absMedian > 0 && Math.abs(p10) > absMedian * 3;
    const isHighNegativeRate = percentNegative > 40;

    if (isHighNegativeRate || isCatastrophicTail) {
      // Calculate confidence: higher when clearly fragile
      let confidence = 0.5;
      if (percentNegative > 60) confidence += 0.3;
      else if (percentNegative > 50) confidence += 0.2;
      else if (percentNegative > 40) confidence += 0.1;

      if (isCatastrophicTail) confidence += 0.2;

      confidence = Math.min(0.95, confidence);

      let reasoning = '';
      if (isHighNegativeRate && isCatastrophicTail) {
        reasoning = `This decision fails in ${percentNegative.toFixed(0)}% of futures. The worst 10% lose more than ${Math.abs(p10).toFixed(0)} (catastrophic tail risk). Extremely fragile under stress.`;
      } else if (isHighNegativeRate) {
        reasoning = `This decision fails in ${percentNegative.toFixed(0)}% of futures. Even without catastrophic tail risk, it has a high failure rate.`;
      } else {
        reasoning = `While this decision succeeds in ${percentPositive.toFixed(0)}% of futures, the worst 10% lose more than ${Math.abs(p10).toFixed(0)} (>3x the median). Catastrophic downside risk makes it fragile.`;
      }

      return {
        classification: 'FRAGILE',
        confidence,
        percentPositive,
        percentNegative,
        medianOutcome: median,
        worstCase: p10,
        bestCase: p90,
        reasoning
      };
    }

    // Check for ROBUST
    const isHighPositiveRate = percentPositive > 65;
    const isManageableTail = absMedian > 0 ? Math.abs(p10) < absMedian * 2 : Math.abs(p10) < 1000;

    if (isHighPositiveRate && isManageableTail) {
      // Calculate confidence: higher when clearly robust
      let confidence = 0.6;
      if (percentPositive > 80) confidence += 0.25;
      else if (percentPositive > 75) confidence += 0.15;
      else if (percentPositive > 70) confidence += 0.1;

      confidence = Math.min(0.95, confidence);

      const reasoning = `This decision works in ${percentPositive.toFixed(0)}% of futures. Even in the worst 10%, losses stay under ${Math.abs(p10).toFixed(0)} (manageable downside). It survives most stress scenarios.`;

      return {
        classification: 'ROBUST',
        confidence,
        percentPositive,
        percentNegative,
        medianOutcome: median,
        worstCase: p10,
        bestCase: p90,
        reasoning
      };
    }

    // Borderline case: doesn't clearly fit any category
    let borderlineReasoning = '';
    if (percentPositive >= 50 && percentPositive <= 65) {
      borderlineReasoning = `Borderline — this decision works in ${percentPositive.toFixed(0)}% of futures but has some exposure. Consider risk mitigation strategies.`;
    } else if (percentNegative >= 30 && percentNegative <= 40) {
      borderlineReasoning = `Borderline — this decision fails in ${percentNegative.toFixed(0)}% of futures. Close to fragile territory. Monitor carefully.`;
    } else {
      borderlineReasoning = `This decision doesn't clearly fit fragile or robust categories. Success rate: ${percentPositive.toFixed(0)}%. Proceed with caution and monitor key variables.`;
    }

    return {
      classification: 'ROBUST',
      confidence: 0.45, // Low confidence for borderline cases
      percentPositive,
      percentNegative,
      medianOutcome: median,
      worstCase: p10,
      bestCase: p90,
      reasoning: borderlineReasoning
    };
  },

  /**
   * Classify all scenarios in a PRISMA dataset
   * Includes antifragile detection by running high-variance scenarios
   *
   * @param {Object} carloResults - Results from Carlo.runCarloAllScenarios()
   * @param {Object} prismaData - Complete PRISMA_DATA object
   * @returns {Object} Classification results per scenario: {scenarioId: talebResult}
   */
  classifyAllScenarios(carloResults, prismaData) {
    const classifications = {};

    for (const scenarioId in carloResults) {
      const normalOutcomes = carloResults[scenarioId].outcomes;

      // Run high-variance scenario for antifragile detection
      // Double the uncertainty (multiply each variable's range by 2)
      const highVarData = this._createHighVarianceData(prismaData);
      const highVarOutcomes = Carlo.runCarlo(highVarData, scenarioId, 500); // Use fewer iterations for speed

      // Classify with both normal and high-variance outcomes
      const classification = this.classifyTaleb(normalOutcomes, highVarOutcomes);
      classifications[scenarioId] = classification;
    }

    return classifications;
  },

  /**
   * Create a high-variance version of prisma data
   * (internal helper for antifragile detection)
   *
   * @param {Object} prismaData - Original PRISMA_DATA
   * @returns {Object} Modified PRISMA_DATA with doubled uncertainty ranges
   */
  _createHighVarianceData(prismaData) {
    const highVarData = JSON.parse(JSON.stringify(prismaData)); // Deep clone

    // Double the range for each variable (except fixed distributions)
    highVarData.variables = highVarData.variables.map(variable => {
      if (variable.distribution === 'fixed') {
        return variable;
      }

      // Double the range around the center value
      const center = variable.value;
      const currentRange = variable.max - variable.min;
      const newRange = currentRange * 2;

      return {
        ...variable,
        min: center - newRange / 2,
        max: center + newRange / 2
      };
    });

    return highVarData;
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
   * Compute a 0-100 decision score from a Taleb classification result
   * Maps classification + percentPositive + confidence into a single number
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
    const confidence = classification.confidence || 0.5;
    const cls = classification.classification;

    // Base score from percent positive (0-100 range)
    let score = pctPositive;

    // Adjust based on classification
    if (cls === 'ANTIFRAGILE') {
      score = Math.max(score, 80); // At least 80 for antifragile
      score = Math.min(100, score + confidence * 10);
    } else if (cls === 'ROBUST') {
      // Boost robust decisions slightly
      score = Math.min(100, score + confidence * 5);
    } else if (cls === 'FRAGILE') {
      // Penalize fragile decisions
      score = Math.max(0, score - confidence * 10);
    }

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

    // Headline from score — include scenario name when provided
    let headline;
    if (bestScenarioLabel) {
      if (score >= 80) headline = `${bestScenarioLabel} looks strongest`;
      else if (score >= 60) headline = `${bestScenarioLabel} is a solid bet`;
      else if (score >= 40) headline = `${bestScenarioLabel} could go either way`;
      else if (score >= 20) headline = `${bestScenarioLabel} needs caution`;
      else headline = `${bestScenarioLabel} looks risky`;
    } else {
      if (score >= 80) headline = 'This looks strong';
      else if (score >= 60) headline = 'Solid bet with manageable downside';
      else if (score >= 40) headline = 'This could go either way';
      else if (score >= 20) headline = 'Proceed with caution';
      else headline = 'This is risky';
    }

    // Color from score
    let color;
    if (score >= 60) color = '#10B981';
    else if (score >= 40) color = '#F59E0B';
    else color = '#EF4444';

    // Summary: structured parts so renderer can bold key values
    // Each part is {text, bold} — bold parts get <strong>
    const medianStr = Visualizations._formatNumber(summary.median) + ' ' + unit;
    const pctStr = classification.percentPositive.toFixed(0) + '%';
    const summaryParts = [
      { text: 'Most likely outcome: ' },
      { text: medianStr, bold: true },
      { text: '. In ' },
      { text: pctStr, bold: true },
      { text: ' of 1,000 simulated futures, this decision comes out positive.' }
    ];

    // Risk: structured parts
    let riskParts = [];
    const p10Str = Visualizations._formatNumber(Math.abs(summary.p10)) + ' ' + unit;
    if (cls === 'FRAGILE') {
      riskParts = [
        { text: 'In the worst 10% of futures, losses reach ' },
        { text: p10Str, bold: true },
        { text: '.' }
      ];
    } else if (summary.p10 < 0) {
      riskParts = [
        { text: 'Downside: the worst 10% of futures show losses of ' },
        { text: p10Str, bold: true },
        { text: '.' }
      ];
    } else {
      riskParts = [
        { text: 'Even in the worst 10%, the outcome stays at ' },
        { text: Visualizations._formatNumber(summary.p10) + ' ' + unit, bold: true },
        { text: '.' }
      ];
    }

    return { headline, summaryParts, riskParts, score, color };
  }
};

// For inline HTML usage (no module export needed)
// The Nassim object is now available globally
