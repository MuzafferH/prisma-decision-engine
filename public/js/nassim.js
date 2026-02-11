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
   *
   * @param {Object} prismaData - Complete PRISMA_DATA object
   * @param {string} scenarioId - Scenario to analyze
   * @param {number} iterations - Number of Carlo iterations per variable test (default: 500 for speed)
   * @returns {Array} Sensitivity results sorted by impact (descending): [{variableId, variableLabel, impactLow, impactHigh, totalSwing, baselineMedian}]
   */
  runSensitivity(prismaData, scenarioId, iterations = 500) {
    // Get baseline (normal scenario run)
    const baselineOutcomes = Carlo.runCarlo(prismaData, scenarioId, iterations);
    const baselineSorted = [...baselineOutcomes].sort((a, b) => a - b);
    const baselineMedian = baselineSorted[Math.floor(baselineSorted.length * 0.5)];

    const sensitivityResults = [];

    // Find input variables (those with isInput: true)
    const inputVariables = prismaData.variables.filter(v => v.isInput === true);

    for (const variable of inputVariables) {
      // Create modified data with variable held at MIN
      const dataAtMin = JSON.parse(JSON.stringify(prismaData));
      const varAtMin = dataAtMin.variables.find(v => v.id === variable.id);
      varAtMin.value = varAtMin.min;
      varAtMin.min = varAtMin.min;
      varAtMin.max = varAtMin.min;
      varAtMin.distribution = 'fixed';

      // Run Carlo with variable at MIN
      const outcomesAtMin = Carlo.runCarlo(dataAtMin, scenarioId, iterations);
      const sortedAtMin = [...outcomesAtMin].sort((a, b) => a - b);
      const medianAtMin = sortedAtMin[Math.floor(sortedAtMin.length * 0.5)];

      // Create modified data with variable held at MAX
      const dataAtMax = JSON.parse(JSON.stringify(prismaData));
      const varAtMax = dataAtMax.variables.find(v => v.id === variable.id);
      varAtMax.value = varAtMax.max;
      varAtMax.min = varAtMax.max;
      varAtMax.max = varAtMax.max;
      varAtMax.distribution = 'fixed';

      // Run Carlo with variable at MAX
      const outcomesAtMax = Carlo.runCarlo(dataAtMax, scenarioId, iterations);
      const sortedAtMax = [...outcomesAtMax].sort((a, b) => a - b);
      const medianAtMax = sortedAtMax[Math.floor(sortedAtMax.length * 0.5)];

      // Calculate impact
      const impactLow = medianAtMin - baselineMedian;
      const impactHigh = medianAtMax - baselineMedian;
      const totalSwing = Math.abs(impactHigh - impactLow);

      sensitivityResults.push({
        variableId: variable.id,
        variableLabel: variable.label,
        impactLow,
        impactHigh,
        totalSwing,
        baselineMedian
      });
    }

    // Sort by total swing (descending) — highest impact first
    sensitivityResults.sort((a, b) => b.totalSwing - a.totalSwing);

    return sensitivityResults;
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
  }
};

// For inline HTML usage (no module export needed)
// The Nassim object is now available globally
