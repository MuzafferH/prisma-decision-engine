/**
 * MARKOV ENGINE — State Transitions & Time Evolution
 *
 * Models how business states evolve over time using Markov chains.
 * Runs Monte Carlo walks through state space to understand future probabilities.
 *
 * Example: A driver starts "unreliable" and over 6 months may become:
 * - reliable (improved with better conditions)
 * - burned_out (worsening with overtime)
 * - quit (absorbing state)
 *
 * Different decisions create different transition matrices → different futures.
 */

const Markov = {

  /**
   * Validate that a transition matrix is well-formed
   * @param {Object} transitions - {fromState: {toState: probability, ...}}
   * @returns {Object} {valid: boolean, errors: [string]}
   */
  validateTransitionMatrix(transitions) {
    const errors = [];
    const allFromStates = Object.keys(transitions);

    // Check each row
    for (const fromState of allFromStates) {
      const row = transitions[fromState];
      const toStates = Object.keys(row);

      // Check probabilities are valid
      for (const toState of toStates) {
        const prob = row[toState];
        if (prob < 0 || prob > 1) {
          errors.push(`Invalid probability ${prob} for ${fromState} → ${toState} (must be 0-1)`);
        }

        // Check that toState exists as a fromState
        if (!allFromStates.includes(toState)) {
          errors.push(`State "${toState}" referenced in transitions but not defined as a state`);
        }
      }

      // Check row sums to 1.0 (within floating point tolerance)
      const sum = toStates.reduce((acc, state) => acc + row[state], 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        errors.push(`Transition probabilities from "${fromState}" sum to ${sum.toFixed(3)}, not 1.0`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Sample next state based on current state's transition probabilities
   * @param {string} currentState - Current state
   * @param {Object} transitions - Transition matrix
   * @returns {string} Next state
   */
  sampleNextState(currentState, transitions) {
    const row = transitions[currentState];
    if (!row) {
      throw new Error(`State "${currentState}" not found in transition matrix`);
    }

    const states = Object.keys(row);
    const probabilities = states.map(s => row[s]);

    // Cumulative probability sampling
    const rand = Math.random();
    let cumulative = 0;

    for (let i = 0; i < states.length; i++) {
      cumulative += probabilities[i];
      if (rand < cumulative) {
        return states[i];
      }
    }

    // Fallback (should never happen if probabilities sum to 1)
    return states[states.length - 1];
  },

  /**
   * Run a single Markov chain walk forward in time
   * @param {string} initialState - Starting state
   * @param {Object} transitions - Transition matrix
   * @param {number} steps - Number of time steps
   * @returns {Array<string>} State at each step (length = steps + 1, includes initial)
   */
  walkChain(initialState, transitions, steps) {
    const path = [initialState];
    let currentState = initialState;

    for (let i = 0; i < steps; i++) {
      currentState = this.sampleNextState(currentState, transitions);
      path.push(currentState);
    }

    return path;
  },

  /**
   * Run Monte Carlo simulation of Markov chain to get state distributions over time
   * @param {Object} entityConfig - Entity configuration from prismaData.markov.entities
   * @param {string} scenarioId - Which scenario to simulate (affects transitions)
   * @param {number} iterations - Number of Monte Carlo walks (default 1000)
   * @param {number} months - Number of months to simulate (default 6)
   * @returns {Object} Markov results with monthly distributions
   */
  runMarkovMonteCarlo(entityConfig, scenarioId, iterations = 1000, months = 6) {
    // Get the appropriate transition matrix for this scenario
    const transitions = (scenarioId && entityConfig.scenarioTransitions && entityConfig.scenarioTransitions[scenarioId])
      ? entityConfig.scenarioTransitions[scenarioId]
      : entityConfig.transitions;

    // Validate transitions
    const validation = this.validateTransitionMatrix(transitions);
    if (!validation.valid) {
      console.error('Invalid transition matrix:', validation.errors);
      throw new Error('Invalid transition matrix: ' + validation.errors.join('; '));
    }

    const initialState = entityConfig.initialState;
    const allStates = entityConfig.states;

    // Initialize monthly distributions
    const monthlyDistributions = [];
    for (let month = 0; month <= months; month++) {
      const dist = {};
      for (const state of allStates) {
        dist[state] = 0;
      }
      monthlyDistributions.push(dist);
    }

    // Store sample paths for visualization
    const samplePaths = [];
    const numSamples = Math.min(10, iterations);

    // Run Monte Carlo iterations
    for (let iter = 0; iter < iterations; iter++) {
      const path = this.walkChain(initialState, transitions, months);

      // Save sample path
      if (iter < numSamples) {
        samplePaths.push(path);
      }

      // Accumulate state counts at each month
      for (let month = 0; month <= months; month++) {
        const state = path[month];
        monthlyDistributions[month][state] += 1;
      }
    }

    // Convert counts to probabilities
    for (let month = 0; month <= months; month++) {
      for (const state of allStates) {
        monthlyDistributions[month][state] /= iterations;
      }
    }

    return {
      entityId: entityConfig.id,
      entityLabel: entityConfig.label,
      monthlyDistributions,
      paths: samplePaths
    };
  },

  /**
   * Run Markov Monte Carlo for all entities in the system
   * @param {Object} prismaData - Full Prisma data structure
   * @param {string} scenarioId - Which scenario to simulate
   * @param {number} iterations - Number of Monte Carlo walks per entity
   * @returns {Object} {entityId: markovResult, ...}
   */
  runAllMarkov(prismaData, scenarioId, iterations = 1000) {
    if (!prismaData.markov || !prismaData.markov.enabled) {
      return {};
    }

    const results = {};
    const months = prismaData.markov.months || 6;

    for (const entity of prismaData.markov.entities) {
      results[entity.id] = this.runMarkovMonteCarlo(entity, scenarioId, iterations, months);
    }

    return results;
  },

  /**
   * Apply state effects to variables based on Markov distributions
   * @param {Object} variables - Current variable values {id: value}
   * @param {Object} stateDistribution - Current state distribution {entityId.state: probability}
   * @param {Object} stateEffects - State effects from prismaData.markov.stateEffects
   * @returns {Object} Modified variables {id: value}
   */
  applyStateEffects(variables, stateDistribution, stateEffects) {
    const modified = {...variables};

    // Apply each state's effect weighted by its probability
    for (const [stateKey, probability] of Object.entries(stateDistribution)) {
      const effects = stateEffects[stateKey];
      if (!effects) continue;

      for (const [varId, effect] of Object.entries(effects)) {
        if (modified[varId] !== undefined) {
          modified[varId] += effect * probability;
        }
      }
    }

    return modified;
  },

  /**
   * Generate outcome timeline showing how outcome evolves over time under Markov state transitions
   * @param {Object} prismaData - Full Prisma data structure
   * @param {string} scenarioId - Which scenario to simulate
   * @param {Object} markovResults - Results from runAllMarkov()
   * @param {Object} carloSummary - Carlo simulation summary with baseline statistics
   * @param {number} months - Number of months to project
   * @returns {Array} Timeline of outcomes over time
   */
  getMarkovOutcomeTimeline(prismaData, scenarioId, markovResults, carloSummary, months = 6) {
    const timeline = [];

    // Get baseline variable values
    const baselineVars = {};
    for (const variable of prismaData.variables) {
      baselineVars[variable.id] = variable.value;
    }

    // Apply scenario changes to baseline
    const scenario = prismaData.scenarios.find(s => s.id === scenarioId);
    if (scenario && scenario.changes) {
      for (const [varId, change] of Object.entries(scenario.changes)) {
        if (change.value !== undefined) {
          baselineVars[varId] = change.value;
        } else if (change.delta !== undefined) {
          baselineVars[varId] += change.delta;
        }
      }
    }

    const stateEffects = prismaData.markov.stateEffects || {};

    // For each month, calculate outcome based on state distributions
    for (let month = 0; month <= months; month++) {
      // Build state distribution for this month
      const stateDistribution = {};
      for (const [entityId, result] of Object.entries(markovResults)) {
        const monthDist = result.monthlyDistributions[month];
        for (const [state, prob] of Object.entries(monthDist)) {
          const key = `${entityId}.${state}`;
          stateDistribution[key] = prob;
        }
      }

      // Apply state effects to variables
      const modifiedVars = this.applyStateEffects(baselineVars, stateDistribution, stateEffects);

      // Calculate outcome using the outcome formula
      // For simplicity, we'll use the monthly_profit variable as the outcome
      // In a real implementation, this would evaluate the outcome formula
      const outcomeVar = prismaData.variables.find(v => v.id === 'monthly_profit');
      const outcomeValue = modifiedVars['monthly_profit'] || (outcomeVar ? outcomeVar.value : 0);

      // For now, use a simple estimation
      // In practice, you'd want to run a mini-Carlo simulation with the modified variables
      // to get P25/P75 bounds, but for speed we'll use the baseline uncertainty
      const baselineUncertainty = carloSummary ? carloSummary.spread || 0 : 0;

      timeline.push({
        month,
        outcomeMedian: outcomeValue,
        outcomeP25: outcomeValue - baselineUncertainty * 0.5,
        outcomeP75: outcomeValue + baselineUncertainty * 0.5
      });
    }

    return timeline;
  },

  /**
   * Convenience function: Run Markov + timeline for ALL scenarios
   * @param {Object} prismaData - Full Prisma data structure
   * @param {number} iterations - Number of Monte Carlo walks per entity
   * @returns {Object} {scenarioId: timeline, ...}
   */
  getTimelineAllScenarios(prismaData, iterations = 1000) {
    const timelines = {};

    // Use dummy carlo summary for now (would normally come from Carlo engine)
    const dummyCarloSummary = {
      spread: 2000 // placeholder uncertainty
    };

    for (const scenario of prismaData.scenarios) {
      const markovResults = this.runAllMarkov(prismaData, scenario.id, iterations);
      const timeline = this.getMarkovOutcomeTimeline(
        prismaData,
        scenario.id,
        markovResults,
        dummyCarloSummary,
        prismaData.markov.months || 6
      );
      timelines[scenario.id] = timeline;
    }

    return timelines;
  }
};
