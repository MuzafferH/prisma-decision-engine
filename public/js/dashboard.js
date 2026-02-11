/**
 * DASHBOARD.JS — Prisma Dashboard Orchestrator
 *
 * Connects chat responses to visualizations.
 * Manages phase progression, data accumulation, and engine coordination.
 *
 * This is the bridge between chat.js (user interaction) and visualizations.js (rendering).
 */

const Dashboard = {
  prismaState: {},      // Accumulated PRISMA_DATA
  currentPhase: null,   // Current phase: gathering|causal_graph|simulation|verdict|tier2_analysis
  carloResults: null,   // Cached Carlo results
  nassimResults: null,  // Cached Nassim results
  markovResults: null,  // Cached Markov results
  isDemoMode: false     // True if ?demo=true in URL
};

/**
 * Initialize the dashboard
 * Called on page load
 */
Dashboard.init = function() {
  console.log('Prisma Dashboard initializing...');

  // Set up the callback for chat updates
  if (typeof Chat !== 'undefined') {
    Chat.onDashboardUpdate = Dashboard.handleToolCall;
    console.log('Dashboard callback registered with Chat');
  } else {
    console.warn('Chat module not found. Dashboard will not receive updates.');
  }

  // Check for demo mode
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === 'true') {
    console.log('Demo mode requested');
    Dashboard.loadDemoData();
  } else if (urlParams.get('test') === 'true') {
    console.log('Test mode requested');
    Dashboard.loadTestData();
  }

  console.log('Prisma Dashboard initialized');
};

/**
 * Handle tool call from chat.js
 * This is the MAIN entry point for dashboard updates
 *
 * @param {Object} toolCall - Tool call with shape: {id, name, input: {phase, prismaData}}
 */
Dashboard.handleToolCall = function(toolCall) {
  if (!toolCall || !toolCall.input) {
    console.warn('Invalid tool call received:', toolCall);
    return;
  }

  const { phase, prismaData } = toolCall.input;

  if (!phase) {
    console.warn('Tool call missing phase:', toolCall);
    return;
  }

  console.log(`Dashboard received update: phase=${phase}`);

  // Merge incoming data
  if (prismaData) {
    Dashboard.mergePrismaData(prismaData);
  }

  // Update current phase
  Dashboard.currentPhase = phase;

  // Activate sections and trigger renders
  Dashboard.activateForPhase(phase);
};

/**
 * Deep merge partial prismaData updates into accumulated state
 *
 * @param {Object} incoming - Partial prismaData object
 */
Dashboard.mergePrismaData = function(incoming) {
  const state = Dashboard.prismaState;

  // Meta: shallow merge
  if (incoming.meta) {
    state.meta = { ...(state.meta || {}), ...incoming.meta };

    // Update header elements
    if (state.meta.title) {
      const titleEl = document.getElementById('decision-title');
      if (titleEl) {
        titleEl.textContent = state.meta.title;
      }
    }

    if (state.meta.tier) {
      const tierBadge = document.getElementById('tier-badge');
      if (tierBadge) {
        tierBadge.textContent = `Tier ${state.meta.tier}`;
      }
    }
  }

  // Variables: merge by id
  if (incoming.variables) {
    if (!state.variables) state.variables = [];
    for (const v of incoming.variables) {
      const idx = state.variables.findIndex(x => x.id === v.id);
      if (idx >= 0) {
        state.variables[idx] = { ...state.variables[idx], ...v };
      } else {
        state.variables.push(v);
      }
    }
  }

  // Edges: merge by from->to composite key
  if (incoming.edges) {
    if (!state.edges) state.edges = [];
    for (const e of incoming.edges) {
      const key = `${e.from}->${e.to}`;
      const idx = state.edges.findIndex(x => `${x.from}->${x.to}` === key);
      if (idx >= 0) {
        state.edges[idx] = { ...state.edges[idx], ...e };
      } else {
        state.edges.push(e);
      }
    }
  }

  // FeedbackLoops: replace
  if (incoming.feedbackLoops) {
    state.feedbackLoops = incoming.feedbackLoops;
  }

  // Scenarios: merge by id
  if (incoming.scenarios) {
    if (!state.scenarios) state.scenarios = [];
    for (const s of incoming.scenarios) {
      const idx = state.scenarios.findIndex(x => x.id === s.id);
      if (idx >= 0) {
        state.scenarios[idx] = { ...state.scenarios[idx], ...s };
      } else {
        state.scenarios.push(s);
      }
    }
  }

  // Outcome: replace
  if (incoming.outcome) {
    state.outcome = incoming.outcome;
  }

  // Recommendation: replace
  if (incoming.recommendation) {
    state.recommendation = incoming.recommendation;
  }

  // Discoveries: append
  if (incoming.discoveries) {
    if (!state.discoveries) state.discoveries = [];
    state.discoveries = state.discoveries.concat(incoming.discoveries);
  }

  // Markov: replace
  if (incoming.markov) {
    state.markov = incoming.markov;
  }

  console.log('PRISMA_STATE updated:', JSON.parse(JSON.stringify(state)));
};

/**
 * Activate dashboard sections and trigger renders based on the current phase
 * Enforces ordering — if we receive 'simulation' but 'causal_graph' hasn't been shown, activate both
 *
 * @param {string} phase - Current phase
 */
Dashboard.activateForPhase = function(phase) {
  const phases = ['gathering', 'causal_graph', 'simulation', 'verdict', 'tier2_analysis'];
  const phaseIndex = phases.indexOf(phase);

  if (phaseIndex < 0) {
    console.warn(`Unknown phase: ${phase}`);
    return;
  }

  // Causal graph
  if (phaseIndex >= 1) {
    Dashboard.activateSection('causal-section');
    Dashboard.renderCausalGraph();
  }

  // Simulation (Monte Carlo + Taleb + Sensitivity)
  if (phaseIndex >= 2) {
    Dashboard.activateSection('monte-carlo-section');
    Dashboard.activateSection('taleb-section');
    Dashboard.activateSection('sensitivity-section');
    Dashboard.runSimulation();
  }

  // Verdict (Recommendations)
  if (phaseIndex >= 3) {
    Dashboard.activateSection('recommendation-section');
    Dashboard.renderRecommendations();
  }

  // Tier 2 (Discoveries)
  if (phaseIndex >= 4) {
    Dashboard.renderDiscoveries();
    // Re-run simulation with updated data
    Dashboard.runSimulation();
  }
};

/**
 * Activate a dashboard section (remove dormant state, show content)
 *
 * @param {string} sectionId - Section element ID
 */
Dashboard.activateSection = function(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) {
    el.classList.remove('dormant');
    el.classList.add('active');

    // Hide dormant text
    const dormantText = el.querySelector('.dormant-text');
    if (dormantText) {
      dormantText.style.display = 'none';
    }
  }
};

/**
 * Run Carlo + Nassim simulation on current prismaState
 */
Dashboard.runSimulation = function() {
  const state = Dashboard.prismaState;

  // Check if we have enough data
  if (!state.variables || !state.scenarios || !state.outcome) {
    console.log('Not enough data for simulation yet');
    return;
  }

  try {
    console.log('Running Carlo simulation...');

    // Run Carlo for all scenarios
    Dashboard.carloResults = Carlo.runCarloAllScenarios(state);
    console.log('Carlo results:', Dashboard.carloResults);

    // Render Monte Carlo dots
    if (typeof Visualizations !== 'undefined' && Visualizations.renderMonteCarlo) {
      Visualizations.renderMonteCarlo(Dashboard.carloResults, state);
    }

    // Run Nassim classification
    console.log('Running Nassim classification...');
    Dashboard.nassimResults = Nassim.classifyAllScenarios(Dashboard.carloResults, state);
    console.log('Nassim results:', Dashboard.nassimResults);

    // Render Taleb badges
    if (typeof Visualizations !== 'undefined' && Visualizations.renderTalebBadges) {
      Visualizations.renderTalebBadges(Dashboard.nassimResults, state);
    }

    // Run sensitivity analysis (on first scenario or 'nothing' scenario)
    const baseScenario = state.scenarios.find(s => s.id === 'nothing' || s.id === 'do_nothing') || state.scenarios[0];
    if (baseScenario) {
      console.log('Running sensitivity analysis...');
      const sensitivity = Nassim.runSensitivity(state, baseScenario.id);
      console.log('Sensitivity results:', sensitivity);

      if (typeof Visualizations !== 'undefined' && Visualizations.renderTornado) {
        Visualizations.renderTornado(sensitivity, state);
      }
    }

    // Run Markov if configured
    if (state.markov && state.markov.enabled) {
      Dashboard.runMarkov();
    }

  } catch (error) {
    console.error('Simulation error:', error);
  }
};

/**
 * Run Markov simulation on current prismaState
 */
Dashboard.runMarkov = function() {
  const state = Dashboard.prismaState;

  if (!state.markov || !state.markov.enabled) {
    return;
  }

  try {
    console.log('Running Markov simulation...');

    const timelines = {};
    for (const scenario of state.scenarios) {
      const markovResults = Markov.runAllMarkov(state, scenario.id);
      const carloSummary = Dashboard.carloResults?.[scenario.id]?.summary || {};
      timelines[scenario.id] = Markov.getMarkovOutcomeTimeline(
        state,
        scenario.id,
        markovResults,
        carloSummary,
        state.markov.months || 6
      );
    }

    Dashboard.markovResults = timelines;
    console.log('Markov results:', timelines);

    if (typeof Visualizations !== 'undefined' && Visualizations.renderMarkovTimeline) {
      Visualizations.renderMarkovTimeline(timelines, state);
    }

  } catch (error) {
    console.error('Markov error:', error);
  }
};

/**
 * Render the causal graph visualization
 */
Dashboard.renderCausalGraph = function() {
  const state = Dashboard.prismaState;

  if (!state.variables || !state.edges) {
    console.log('Not enough data for causal graph');
    return;
  }

  console.log('Rendering causal graph...');

  if (typeof Visualizations !== 'undefined' && Visualizations.renderCausalGraph) {
    Visualizations.renderCausalGraph(state);
  } else {
    // Visualizations not loaded yet - display placeholder
    const container = document.getElementById('causal-graph-container');
    if (container) {
      const placeholder = document.createElement('div');
      placeholder.className = 'viz-placeholder';
      placeholder.textContent = 'Causal graph visualization will appear here';
      container.appendChild(placeholder);
    }
  }
};

/**
 * Render recommendations panel
 */
Dashboard.renderRecommendations = function() {
  const rec = Dashboard.prismaState.recommendation;

  if (!rec) {
    console.log('No recommendations to render');
    return;
  }

  console.log('Rendering recommendations...');

  const actionEl = document.getElementById('rec-action-text');
  const watchEl = document.getElementById('rec-watch-text');
  const triggerEl = document.getElementById('rec-trigger-text');

  if (actionEl) actionEl.textContent = rec.action || 'Awaiting...';
  if (watchEl) watchEl.textContent = rec.watch || 'Awaiting...';
  if (triggerEl) triggerEl.textContent = rec.trigger || 'Awaiting...';
};

/**
 * Render discoveries section
 */
Dashboard.renderDiscoveries = function() {
  const discoveries = Dashboard.prismaState.discoveries;

  if (!discoveries || discoveries.length === 0) {
    console.log('No discoveries to render');
    return;
  }

  console.log('Rendering discoveries...');

  const section = document.getElementById('discoveries-section');
  const container = document.getElementById('discoveries-container');

  if (!section || !container) {
    console.warn('Discoveries DOM elements not found');
    return;
  }

  section.classList.remove('hidden');
  Dashboard.activateSection('discoveries-section');

  // Clear existing content
  container.textContent = '';

  for (const d of discoveries) {
    const card = document.createElement('div');
    card.className = 'discovery-card';

    const badge = document.createElement('span');
    badge.className = 'discovery-badge discovery-' + (d.type || 'pattern');
    badge.textContent = (d.type || 'pattern').toUpperCase();

    const title = document.createElement('h4');
    title.textContent = d.title || 'Insight';

    const desc = document.createElement('p');
    desc.textContent = d.description || '';

    const impact = document.createElement('span');
    impact.className = 'discovery-impact';
    impact.textContent = d.impact ? `Impact: ${d.impact}` : '';

    card.appendChild(badge);
    card.appendChild(title);
    card.appendChild(desc);
    if (d.impact) {
      card.appendChild(impact);
    }

    container.appendChild(card);
  }
};

/**
 * Re-run simulation with slider-adjusted variable value
 *
 * @param {string} variableId - Variable ID
 * @param {number} newValue - New value from slider
 */
Dashboard.rerunWithSliders = function(variableId, newValue) {
  const variable = Dashboard.prismaState.variables?.find(v => v.id === variableId);
  if (variable) {
    variable.value = parseFloat(newValue);
    console.log(`Variable ${variableId} updated to ${newValue}`);
    Dashboard.runSimulation();
  }
};

/**
 * Load demo data and render everything
 */
Dashboard.loadDemoData = function() {
  console.log('Loading demo data...');

  // Check if demo data is available
  if (typeof DEMO_DATA !== 'undefined') {
    Dashboard.prismaState = JSON.parse(JSON.stringify(DEMO_DATA));
    Dashboard.isDemoMode = true;
    Dashboard.activateForPhase('verdict');
    console.log('Demo data loaded successfully');
    return true;
  }

  // No demo data available - load from example schema
  console.warn('DEMO_DATA not found. Using fallback data from schema.');
  Dashboard.loadTestData();
  return false;
};

/**
 * Load test data (simple scenario for testing)
 */
Dashboard.loadTestData = function() {
  console.log('Loading test data...');

  // Simple test data
  Dashboard.prismaState = {
    meta: {
      title: 'Test Decision',
      summary: 'A simple test scenario',
      tier: 1,
      generatedAt: new Date().toISOString()
    },
    variables: [
      {
        id: 'input_var',
        label: 'Input Variable',
        value: 100,
        min: 80,
        max: 120,
        distribution: 'normal',
        unit: 'units',
        isInput: true
      },
      {
        id: 'outcome_var',
        label: 'Outcome Variable',
        value: 50,
        min: 30,
        max: 70,
        distribution: 'normal',
        unit: 'points',
        isInput: false
      },
      {
        id: 'monthly_profit',
        label: 'Monthly Profit',
        value: 1000,
        min: 500,
        max: 1500,
        distribution: 'normal',
        unit: '€/month',
        isInput: false
      }
    ],
    edges: [
      {
        from: 'input_var',
        to: 'outcome_var',
        effect: 'positive',
        strength: 0.7,
        formula: 'outcome_var = input_var * 0.5'
      },
      {
        from: 'outcome_var',
        to: 'monthly_profit',
        effect: 'positive',
        strength: 0.8,
        formula: 'monthly_profit = 500 + outcome_var * 10'
      }
    ],
    feedbackLoops: [],
    scenarios: [
      {
        id: 'scenario_a',
        label: 'Scenario A',
        color: '#10b981',
        changes: {
          input_var: {
            value: 110,
            min: 100,
            max: 120
          }
        },
        assumptions: ['Optimistic scenario']
      },
      {
        id: 'scenario_b',
        label: 'Scenario B',
        color: '#ef4444',
        changes: {
          input_var: {
            value: 90,
            min: 80,
            max: 100
          }
        },
        assumptions: ['Pessimistic scenario']
      },
      {
        id: 'nothing',
        label: 'Do Nothing',
        color: '#6b7280',
        changes: {},
        assumptions: ['Status quo']
      }
    ],
    outcome: {
      id: 'monthly_profit_delta',
      label: 'Monthly Profit Change',
      unit: '€/month',
      formula: 'scenario_monthly_profit - baseline_monthly_profit',
      positiveLabel: 'Profit Gain',
      negativeLabel: 'Profit Loss'
    },
    recommendation: {
      action: 'Choose Scenario A for better outcomes',
      watch: 'Monitor input_var closely',
      trigger: 'If input_var drops below 85, reconsider'
    }
  };

  Dashboard.isDemoMode = true;
  Dashboard.activateForPhase('verdict');
  console.log('Test data loaded successfully');
};

// Keyboard shortcut: Ctrl+Shift+D to toggle demo mode
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    console.log('Demo mode shortcut triggered');
    Dashboard.loadDemoData();
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  Dashboard.init();
});
