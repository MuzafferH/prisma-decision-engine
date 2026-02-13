/**
 * DASHBOARD.JS — Prisma Dashboard Orchestrator v2
 *
 * Progressive disclosure: Layer 1 (verdict) → Layer 2 (evidence) → Layer 3 (engine room)
 * Connects chat responses to visualizations.
 * Manages phase progression, data accumulation, and engine coordination.
 */

const Dashboard = {
  prismaState: {},      // Accumulated PRISMA_DATA
  currentPhase: null,   // Current phase
  carloResults: null,   // Cached Carlo results
  nassimResults: null,  // Cached Nassim results
  markovResults: null,  // Cached Markov results
  sensitivityResults: null, // Cached sensitivity results
  fullSensitivityResults: null, // Full sensitivity (all non-fixed vars)
  isDemoMode: false,
  _slidersRendered: false,
  _frontSlidersRendered: false, // Lock: front-page sliders rendered
  _layer2Open: false,
  _layer3Open: false,
  _iterationCount: 1000, // Default simulation iteration count
  _baselineValues: null, // Session baseline (never changes)
  _activeBaseline: null, // Active baseline (updates on AI tool calls)
  _promotedSliders: new Set(), // AI-promoted slider variable IDs
  _frontSliderIds: null, // Locked front slider IDs after first render
  _moreSliderIds: null,  // Locked "more" slider IDs after first render
  _moreVarsOpen: false,  // "More variables" expansion state

  // --- Dynamic Recommendations State ---
  _originalRecommendation: null, // AI recs from first render (never changes)
  _originalVerdict: null,        // Original verdict from first render
  _bestScenarioId: null,         // Current best scenario ID
  _bestScenarioLabel: null,      // Current best scenario label
  _bestScenarioScore: null,      // Current best scenario score
  _recState: 'baseline',         // RecState: 'baseline' | 'updated' | 'refining'
  _recVersion: 0,                // Version counter for race condition prevention
  _activeAbort: null,            // AbortController for pending AI refinement
  _refineTimeout: null,          // 2s debounce timer for AI refinement
  _mode: 'demo',                  // 'demo' (template-only) | 'live' (template + AI)
  _isPrecisionRerun: false,        // True during precision re-run (skip AI timer restart)

  // --- Prisma 2.0: Data Mode State ---
  _dataMode: false,               // true when in upload-first data flow
  _csvData: null,                 // Raw parsed CSV rows
  _csvAnalysis: null,             // CSVAnalyzer output
  _dataOverviewRendered: false,   // Prevent double renders
  _simulationVisible: false,      // Full Analysis expanded (legacy compat)
  _futuresCascadePlayed: false,   // Futures Cascade animation played once (legacy compat)
  _lastSimulationPrompt: null,    // Label for current simulation

  // --- Simulation History (stacking cards) ---
  simulationHistory: [],          // Array of simulation snapshots
  _simCounter: 0,                 // Auto-increment ID
  _maxSimulations: 10,            // Memory cap — evict oldest beyond this

  // --- Analysis History (stacking cards for follow-up questions) ---
  analysisHistory: [],            // Array of analysis snapshots
  _analysisCounter: 0,            // Auto-increment ID
  _maxAnalyses: 10                // Memory cap — evict oldest beyond this
};

/**
 * Initialize the dashboard
 */
Dashboard.init = function() {
  console.log('Prisma Dashboard v2 initializing...');

  // Set up the callback for chat updates
  if (typeof Chat !== 'undefined') {
    Chat.onDashboardUpdate = Dashboard.handleToolCall;
    console.log('Dashboard callback registered with Chat');
  }

  // Set up progressive disclosure controls
  Dashboard.setupDisclosure();

  // Delegated click handler for simulation history cards
  const simHistory = document.getElementById('simulation-history');
  if (simHistory) {
    simHistory.addEventListener('click', (e) => {
      const btn = e.target.closest('.sim-full-analysis-btn');
      if (!btn) return;
      const card = btn.closest('.sim-card');
      if (!card) return;
      Dashboard.toggleSimCard(parseInt(card.dataset.simId, 10));
    });
  }

  // Set up upload drop zone (Prisma 2.0)
  Dashboard.setupUploadZone();

  // Detect mode: ?demo=true → demo (template-only), otherwise → live (template + AI)
  const urlParams = new URLSearchParams(window.location.search);
  Dashboard._mode = urlParams.get('demo') === 'true' ? 'demo' : 'live';
  console.log('Prisma mode:', Dashboard._mode);

  if (urlParams.get('demo') === 'true') {
    console.log('Demo mode requested');
    Dashboard.loadDemoData();
  } else if (urlParams.get('test') === 'true') {
    console.log('Test mode requested');
    Dashboard.loadTestData();
  }

  console.log('Prisma Dashboard v2 initialized');
};

/**
 * Set up progressive disclosure buttons and overlays
 */
Dashboard.setupDisclosure = function() {
  // "Show me why" button → toggle Layer 2
  const showWhyBtn = document.getElementById('show-why-btn');
  if (showWhyBtn) {
    showWhyBtn.addEventListener('click', () => {
      Dashboard.toggleLayer2();
    });
  }

  // "See full simulation" button → open Layer 3
  const seeFullBtn = document.getElementById('see-full-btn');
  if (seeFullBtn) {
    seeFullBtn.addEventListener('click', () => {
      Dashboard.openLayer3();
    });
  }

  // Layer 3 close button
  const closeBtn = document.getElementById('layer-3-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      Dashboard.closeLayer3();
    });
  }

  // Layer 3 overlay click to close
  const overlay = document.getElementById('layer-3-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      Dashboard.closeLayer3();
    });
  }

  // Escape key to close Layer 3
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && Dashboard._layer3Open) {
      Dashboard.closeLayer3();
    }
  });

  // Simulation count toggle
  const simToggle = document.getElementById('sim-count-toggle');
  if (simToggle) {
    simToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.sim-count-btn');
      if (!btn) return;
      const count = parseInt(btn.dataset.count, 10);
      if (!count) return;

      // Update active state
      simToggle.querySelectorAll('.sim-count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      Dashboard._iterationCount = count;
      // Re-run simulation at new count
      Dashboard.runSimulation();
    });
  }

  // "More variables" toggle
  const moreBtn = document.getElementById('more-vars-btn');
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      Dashboard._moreVarsOpen = !Dashboard._moreVarsOpen;
      const moreContainer = document.getElementById('front-sliders-more');
      if (moreContainer) {
        moreContainer.classList.toggle('hidden', !Dashboard._moreVarsOpen);
      }
      moreBtn.classList.toggle('expanded', Dashboard._moreVarsOpen);
    });
  }

  // "Reset all" button
  const resetBtn = document.getElementById('reset-sliders-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      Dashboard.resetSliders();
    });
  }
};

/**
 * Toggle Layer 2 (evidence) expand/collapse
 */
Dashboard.toggleLayer2 = function() {
  const layer2 = document.getElementById('layer-2');
  const btn = document.getElementById('show-why-btn');
  if (!layer2) return;

  Dashboard._layer2Open = !Dashboard._layer2Open;

  if (Dashboard._layer2Open) {
    layer2.classList.add('expanded');
    if (btn) btn.classList.add('expanded');

    // Render Layer 2 content if we have data
    if (Dashboard.carloResults && Dashboard.nassimResults) {
      Dashboard.renderLayer2();
    }
  } else {
    layer2.classList.remove('expanded');
    if (btn) btn.classList.remove('expanded');
  }
};

/**
 * Open Layer 3 (engine room) slide-over
 */
Dashboard.openLayer3 = function() {
  const panel = document.getElementById('layer-3-panel');
  const overlay = document.getElementById('layer-3-overlay');

  if (panel) panel.classList.add('open');
  if (overlay) overlay.classList.add('open');
  Dashboard._layer3Open = true;

  // Render Layer 3 content
  if (Dashboard.carloResults) {
    Dashboard.renderLayer3();
  }
};

/**
 * Close Layer 3
 */
Dashboard.closeLayer3 = function() {
  const panel = document.getElementById('layer-3-panel');
  const overlay = document.getElementById('layer-3-overlay');

  if (panel) panel.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  Dashboard._layer3Open = false;
};

/**
 * Handle tool call from chat.js
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

  // Auto-detect data mode from phase
  if (phase === 'data_overview') {
    Dashboard._dataMode = true;
  }

  // Check if server flagged a formula warning (validation failed on both attempts)
  if (toolCall.input._formulaWarning) {
    console.warn('[Dashboard] Server flagged formula warning — showing banner');
    Dashboard._showFormulaWarning();
  }

  // Clear simulation-phase state before merging new data (prevents contamination from previous sims)
  if (phase === 'simulation') {
    Dashboard.prismaState.variables = null;
    Dashboard.prismaState.scenarios = null;
    Dashboard.prismaState.outcome = null;
    Dashboard.prismaState.edges = [];
    Dashboard.prismaState.recommendation = null;
  }

  if (prismaData) {
    Dashboard.mergePrismaData(prismaData);
  }

  Dashboard.currentPhase = phase;
  Dashboard.activateForPhase(phase);
};

/**
 * Deep merge partial prismaData updates into accumulated state
 */
Dashboard.mergePrismaData = function(incoming) {
  const state = Dashboard.prismaState;

  if (incoming.meta) {
    state.meta = { ...(state.meta || {}), ...incoming.meta };
    if (state.meta.tier) {
      const tierBadge = document.getElementById('tier-badge');
      if (tierBadge) tierBadge.textContent = `Tier ${state.meta.tier}`;
    }
  }

  if (incoming.variables) {
    if (!state.variables) state.variables = [];
    for (const v of incoming.variables) {
      const idx = state.variables.findIndex(x => x.id === v.id);
      if (idx >= 0) { state.variables[idx] = { ...state.variables[idx], ...v }; }
      else { state.variables.push(v); }

      // Chat-driven slider promotion: AI sets frontPageSlider: true
      if (v.frontPageSlider) {
        Dashboard._promotedSliders.add(v.id);
        // Force re-render of front sliders to include promoted variable
        Dashboard._frontSlidersRendered = false;
        Dashboard._frontSliderIds = null;
        // Update active baseline for the new variable
        if (Dashboard._activeBaseline) {
          Dashboard._activeBaseline[v.id] = v.value;
        }
      }
    }
  }

  if (incoming.edges) {
    if (!state.edges) state.edges = [];
    for (const e of incoming.edges) {
      const key = `${e.from}->${e.to}`;
      const idx = state.edges.findIndex(x => `${x.from}->${x.to}` === key);
      if (idx >= 0) { state.edges[idx] = { ...state.edges[idx], ...e }; }
      else { state.edges.push(e); }
    }
  }

  if (incoming.feedbackLoops) { state.feedbackLoops = incoming.feedbackLoops; }
  if (incoming.scenarios) {
    if (!state.scenarios) state.scenarios = [];
    for (const s of incoming.scenarios) {
      const idx = state.scenarios.findIndex(x => x.id === s.id);
      if (idx >= 0) { state.scenarios[idx] = { ...state.scenarios[idx], ...s }; }
      else { state.scenarios.push(s); }
    }
  }
  if (incoming.outcome) { state.outcome = incoming.outcome; }
  if (incoming.recommendation) { state.recommendation = incoming.recommendation; }
  if (incoming.discoveries) {
    if (!state.discoveries) state.discoveries = [];
    state.discoveries = state.discoveries.concat(incoming.discoveries);
  }

  // Prisma 2.0: new fields
  if (incoming.charts) { state.charts = incoming.charts; }
  if (incoming.kpiCards) { state.kpiCards = incoming.kpiCards; }
  if (incoming.insights) { state.insights = incoming.insights; }
  if (incoming.dataSummary) { state.dataSummary = incoming.dataSummary; }

  console.log('PRISMA_STATE updated:', JSON.parse(JSON.stringify(state)));
};

/**
 * Activate dashboard sections based on the current phase
 * In v2: all visualization goes to the Answer Panel (Layers 1/2/3)
 */
Dashboard.activateForPhase = function(phase) {
  // Prisma 2.0: Data mode phase handling
  if (Dashboard._dataMode) {
    console.log('[Dashboard] Data mode — phase:', phase);

    if (phase === 'data_overview') {
      Dashboard.showDataOverview();
      return;
    }

    if (phase === 'simulation') {
      const state = Dashboard.prismaState;
      const prevCount = Dashboard._simCounter;
      const hasMissing = !state.variables || !state.scenarios || !state.outcome;

      Dashboard.runSimulation();

      if (Dashboard._simCounter > prevCount) {
        Dashboard._createSimCard();
      } else {
        // Diagnose the failure and show a failed card with retry
        const diagnostic = hasMissing
          ? 'Missing simulation data — variables, scenarios, or outcome formula not provided'
          : (Dashboard.carloResults && Dashboard._checkAllZeroOutcomes(Dashboard.carloResults))
            ? 'Formula produced no variation — variable names may not match the data'
            : 'Simulation engine encountered an error';

        Dashboard._createFailedSimCard(
          Dashboard._lastSimulationPrompt || 'Simulation',
          diagnostic
        );
      }
      return;
    }

    if (phase === 'verdict') {
      // Populate recommendation in latest sim card
      const latest = Dashboard.simulationHistory[Dashboard.simulationHistory.length - 1];
      if (latest && Dashboard.prismaState.recommendation) {
        latest.recommendation = Dashboard.prismaState.recommendation;
        const doEl = document.getElementById('sim-' + latest.id + '-rec-do');
        const watchEl = document.getElementById('sim-' + latest.id + '-rec-watch');
        const pivotEl = document.getElementById('sim-' + latest.id + '-rec-pivot');
        if (doEl) doEl.textContent = Dashboard.prismaState.recommendation.action || '';
        if (watchEl) watchEl.textContent = Dashboard.prismaState.recommendation.watch || '';
        if (pivotEl) pivotEl.textContent = Dashboard.prismaState.recommendation.trigger || '';
      }
      return;
    }
  }

  // Legacy mode: existing Layer 1/2/3 flow
  const phases = ['gathering', 'causal_graph', 'simulation', 'verdict', 'tier2_analysis'];
  const phaseIndex = phases.indexOf(phase);

  if (phaseIndex < 0) {
    console.warn(`Unknown phase: ${phase}`);
    return;
  }

  if (phaseIndex >= 2) {
    Dashboard.runSimulation();
  }

  if (phaseIndex >= 3) {
    Dashboard.showLayer1();
  }

  if (phaseIndex >= 4) {
    Dashboard.renderDiscoveries();
    Dashboard.runSimulation();
  }
};

/**
 * Show Layer 1 and hide the dormant state
 */
Dashboard.showLayer1 = function() {
  const dormant = document.getElementById('panel-dormant');
  const layer1 = document.getElementById('layer-1');

  if (dormant) dormant.style.display = 'none';
  if (layer1) layer1.classList.add('active');

  // Render Layer 1 content
  Dashboard.renderLayer1();
};

/**
 * Render Layer 1: Score circle + verdict + recommendations
 */
Dashboard.renderLayer1 = function() {
  const state = Dashboard.prismaState;

  if (!Dashboard.nassimResults || !Dashboard.carloResults) return;

  // Find best scenario (non-"nothing" with highest decision score)
  const scenarios = state.scenarios || [];
  let bestScenarioId = null;
  let bestScore = -1;
  for (const s of scenarios) {
    if (s.id === 'nothing' || s.id === 'do_nothing') continue;
    const c = Dashboard.nassimResults[s.id];
    if (c) {
      const score = Nassim.computeDecisionScore(c);
      if (score > bestScore) {
        bestScore = score;
        bestScenarioId = s.id;
      }
    }
  }
  // Fallback to first scenario
  if (!bestScenarioId && scenarios.length > 0) {
    bestScenarioId = scenarios[0].id;
  }
  if (!bestScenarioId) return;

  const classification = Dashboard.nassimResults[bestScenarioId];
  const summary = Dashboard.carloResults[bestScenarioId]?.summary;

  if (!classification || !summary) return;

  // Track best scenario
  const bestScenario = scenarios.find(s => s.id === bestScenarioId);
  Dashboard._bestScenarioId = bestScenarioId;
  Dashboard._bestScenarioLabel = bestScenario?.label || bestScenarioId;
  Dashboard._bestScenarioScore = bestScore;

  // Store original recommendation on FIRST render (never changes)
  if (!Dashboard._originalRecommendation && state.recommendation) {
    Dashboard._originalRecommendation = { ...state.recommendation };
  }

  // Generate verdict — include best scenario label for context
  const verdict = Nassim.generateVerdict(classification, summary, state, Dashboard._bestScenarioLabel);

  // Store original verdict on first render
  if (!Dashboard._originalVerdict) {
    Dashboard._originalVerdict = { ...verdict };
  }

  // Render simulation badge
  const badgeEl = document.getElementById('simulation-badge');
  if (badgeEl) {
    const numScenarios = scenarios.length;
    const totalSims = numScenarios * Dashboard._iterationCount;
    const timeMs = Dashboard._lastSimTimeMs || 0;
    const timeStr = timeMs < 1000
      ? Math.round(timeMs) + 'ms'
      : (timeMs / 1000).toFixed(1) + 's';

    badgeEl.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = totalSims.toLocaleString();
    badgeEl.appendChild(strong);
    badgeEl.appendChild(document.createTextNode(' simulations across ' + numScenarios + ' scenarios analyzed in '));
    const timeStrong = document.createElement('strong');
    timeStrong.textContent = timeStr;
    badgeEl.appendChild(timeStrong);
  }

  // Render score circle
  Visualizations.renderScoreCircle(verdict.score, verdict.color);

  // Render verdict text
  Visualizations.renderVerdict(verdict);

  // Render recommendations — use AI-provided text, or generate from simulation data
  if (state.recommendation) {
    Visualizations.renderRecommendations(state.recommendation);
  } else {
    // AI didn't include recommendations yet — generate from simulation results
    const templateRecs = Dashboard.generateDynamicRecommendations();
    if (templateRecs) {
      Visualizations.renderRecommendations(templateRecs);
    }
  }

  // Render front-page sliders (only on first render or after reset)
  if (!Dashboard._frontSlidersRendered && Dashboard.fullSensitivityResults) {
    // Select which sliders go on front page
    if (!Dashboard._frontSliderIds) {
      const { frontIds, moreIds } = Dashboard.selectFrontPageSliders();
      Dashboard._frontSliderIds = frontIds;
      Dashboard._moreSliderIds = moreIds;
    }

    Visualizations.renderFrontPageSliders(
      Dashboard.fullSensitivityResults,
      state,
      Dashboard._frontSliderIds,
      Dashboard._moreSliderIds || [],
      Dashboard._activeBaseline || Dashboard._baselineValues,
      Dashboard._promotedSliders
    );
    Dashboard._frontSlidersRendered = true;
  }
};

/**
 * Render Layer 2: Range bar + scenario comparison + sensitivity
 */
Dashboard.renderLayer2 = function() {
  const state = Dashboard.prismaState;

  if (Dashboard.carloResults) {
    Visualizations.renderRangeBar(Dashboard.carloResults, state);
  }

  if (Dashboard.carloResults && Dashboard.nassimResults) {
    Visualizations.renderScenarioComparison(Dashboard.carloResults, Dashboard.nassimResults, state);
  }

  if (Dashboard.sensitivityResults) {
    Visualizations.renderSimplifiedSensitivity(Dashboard.sensitivityResults, state);
  }
};

/**
 * Render Layer 3: Full engine room (Monte Carlo, Taleb badges, Tornado, Markov, Causal, Sliders, Raw Stats)
 */
Dashboard.renderLayer3 = function() {
  const state = Dashboard.prismaState;

  // Monte Carlo dots
  if (Dashboard.carloResults) {
    Visualizations.renderMonteCarlo(Dashboard.carloResults, state);
  }

  // Taleb badges
  if (Dashboard.nassimResults) {
    Visualizations.renderTalebBadges(Dashboard.nassimResults, state);
  }

  // Tornado chart
  if (Dashboard.sensitivityResults) {
    Visualizations.renderTornado(Dashboard.sensitivityResults, state);
  }

  // Markov timeline
  if (Dashboard.markovResults) {
    Visualizations.renderMarkovTimeline(Dashboard.markovResults, state);
  }

  // Causal graph
  if (state.variables && state.edges) {
    Visualizations.renderCausalGraph(state);
  }

  // Sliders
  if (!Dashboard._slidersRendered) {
    Visualizations.renderSliders(state);
    Dashboard._slidersRendered = true;
  }

  // Raw stats table
  if (Dashboard.carloResults) {
    Visualizations.renderRawStats(Dashboard.carloResults, state);
  }
};

/**
 * Run Carlo + Nassim simulation
 */
Dashboard.runSimulation = function() {
  const state = Dashboard.prismaState;

  if (!state.variables || !state.scenarios || !state.outcome) {
    console.warn('Simulation missing required state:', {
      variables: !!state.variables,
      scenarios: !!state.scenarios,
      outcome: !!state.outcome
    });
    return;
  }

  try {
    const simStart = performance.now();

    console.log('Running Carlo simulation...');
    Dashboard.carloResults = Carlo.runCarloAllScenarios(state, Dashboard._iterationCount);
    console.log('Carlo results:', Dashboard.carloResults);

    // All-zero detection: check if every scenario produced all-zero outcomes
    const allZero = Dashboard._checkAllZeroOutcomes(Dashboard.carloResults);
    if (allZero) {
      console.warn('[All-Zero Detection] All scenarios produced zero outcomes — formula likely broken');
      Dashboard._showFormulaWarning();
      return;
    } else {
      Dashboard._hideFormulaWarning();
    }

    console.log('Running Nassim classification...');
    Dashboard.nassimResults = Nassim.classifyAllScenarios(Dashboard.carloResults, state);
    console.log('Nassim results:', Dashboard.nassimResults);

    // Store session baseline on first run (never changes)
    if (!Dashboard._baselineValues) {
      Dashboard._baselineValues = {};
      Dashboard._activeBaseline = {};
      for (const v of state.variables) {
        Dashboard._baselineValues[v.id] = v.value;
        Dashboard._activeBaseline[v.id] = v.value;
      }
    }

    // Create simulation history entry (before async sensitivity)
    Dashboard._simCounter++;
    const simId = Dashboard._simCounter;
    const simEntry = {
      id: simId,
      timestamp: Date.now(),
      label: Dashboard._lastSimulationPrompt || 'Simulation ' + simId,
      carloResults: JSON.parse(JSON.stringify(Dashboard.carloResults)),
      nassimResults: JSON.parse(JSON.stringify(Dashboard.nassimResults)),
      sensitivityResults: null,
      bestPctPositive: 0,
      expanded: false,
      futuresCascadePlayed: false,
      recommendation: null
    };

    // Compute best % positive for teaser
    const scenarios = state.scenarios || [];
    for (const s of scenarios) {
      if (s.id === 'nothing' || s.id === 'do_nothing') continue;
      const results = Dashboard.carloResults[s.id];
      if (results && results.summary) {
        simEntry.bestPctPositive = Math.max(simEntry.bestPctPositive, results.summary.percentPositive);
      }
    }

    // Full sensitivity analysis (Phase 1 sync + Phase 2 async)
    const baseScenario = state.scenarios.find(s => s.id === 'nothing' || s.id === 'do_nothing') || state.scenarios[0];
    if (baseScenario) {
      console.log('Running full sensitivity analysis...');
      const capturedSimId = simId; // Capture for async callback
      const phase1Results = Nassim.runFullSensitivity(state, baseScenario.id, 300, (fullResults) => {
        // Phase 2 callback: scoped to this simulation entry
        Dashboard.fullSensitivityResults = fullResults;
        Dashboard.sensitivityResults = fullResults;
        console.log('Phase 2 sensitivity complete:', fullResults.length, 'variables');

        // Update the specific history entry (not a stale global)
        const entry = Dashboard.simulationHistory.find(e => e.id === capturedSimId);
        if (entry) {
          entry.sensitivityResults = fullResults;
        }

        // Update "more variables" section if not yet rendered with full set
        if (Dashboard._frontSlidersRendered && Dashboard._moreSliderIds === null) {
          const { frontIds, moreIds } = Dashboard.selectFrontPageSliders();
          Dashboard._moreSliderIds = moreIds;
          Visualizations.renderFrontPageSliders(
            fullResults, state, frontIds, moreIds,
            Dashboard._activeBaseline || Dashboard._baselineValues,
            Dashboard._promotedSliders
          );
        }
      });

      Dashboard.fullSensitivityResults = phase1Results;
      Dashboard.sensitivityResults = phase1Results;
      simEntry.sensitivityResults = phase1Results;
      console.log('Phase 1 sensitivity results:', phase1Results);
    }

    // Evict oldest if at memory cap
    if (Dashboard.simulationHistory.length >= Dashboard._maxSimulations) {
      const evicted = Dashboard.simulationHistory.shift();
      const evictedCard = document.querySelector('.sim-card[data-sim-id="' + evicted.id + '"]');
      if (evictedCard) {
        // Purge Plotly charts to free memory
        const histEl = evictedCard.querySelector('[id$="-histogram"]');
        const tornEl = evictedCard.querySelector('[id$="-tornado"]');
        if (histEl && typeof Plotly !== 'undefined') {
          try { Plotly.purge(histEl); } catch(e) { console.warn('[Memory] Eviction purge failed:', e); }
        }
        if (tornEl && typeof Plotly !== 'undefined') {
          try { Plotly.purge(tornEl); } catch(e) { console.warn('[Memory] Eviction purge failed:', e); }
        }
        evictedCard.remove();
      }
    }

    Dashboard.simulationHistory.push(simEntry);

    // Markov (legacy — only runs if Markov engine is loaded)
    if (state.markov && state.markov.enabled && typeof Markov !== 'undefined') {
      Dashboard.runMarkov();
    }

    Dashboard._lastSimTimeMs = performance.now() - simStart;
    console.log('Total simulation time: ' + Dashboard._lastSimTimeMs.toFixed(0) + 'ms');

    // In data mode, don't auto-show Layer 1 — the teaser handles it
    if (!Dashboard._dataMode) {
      // Render Layer 1 (always visible when data is ready)
      Dashboard.showLayer1();

      // If Layer 2 is already open, re-render it
      if (Dashboard._layer2Open) {
        Dashboard.renderLayer2();
      }
    }

  } catch (error) {
    console.error('Simulation error:', error);
  }
};

/**
 * Run Markov simulation
 */
Dashboard.runMarkov = function() {
  const state = Dashboard.prismaState;

  if (!state.markov || !state.markov.enabled) return;

  try {
    console.log('Running Markov simulation...');

    const timelines = {};
    for (const scenario of state.scenarios) {
      const markovResults = Markov.runAllMarkov(state, scenario.id);
      const carloSummary = Dashboard.carloResults?.[scenario.id]?.summary || {};
      timelines[scenario.id] = Markov.getMarkovOutcomeTimeline(
        state, scenario.id, markovResults, carloSummary, state.markov.months || 6
      );
    }

    Dashboard.markovResults = timelines;
    console.log('Markov results:', timelines);

  } catch (error) {
    console.error('Markov error:', error);
  }
};

/**
 * Render discoveries section
 */
Dashboard.renderDiscoveries = function() {
  const discoveries = Dashboard.prismaState.discoveries;
  if (!discoveries || discoveries.length === 0) return;

  const section = document.getElementById('discoveries-section');
  const container = document.getElementById('discoveries-container');
  if (!section || !container) return;

  section.classList.remove('hidden');
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
    if (d.impact) card.appendChild(impact);

    container.appendChild(card);
  }
};

/**
 * Re-run simulation with slider-adjusted variable value.
 * Uses MINIMAL render path: only updates score circle (morph), verdict text,
 * delta badges — does NOT re-render slider DOM.
 */
Dashboard.rerunWithSliders = function(variableId, newValue) {
  const variable = Dashboard.prismaState.variables?.find(v => v.id === variableId);
  if (!variable) return;

  variable.value = parseFloat(newValue);
  console.log(`Variable ${variableId} updated to ${newValue}`);
  Dashboard._slidersRendered = false; // Allow slider re-render on next Layer 3 open

  const state = Dashboard.prismaState;
  if (!state.variables || !state.scenarios || !state.outcome) return;

  try {
    const simStart = performance.now();

    // Use 1000 iterations during slider drag for responsiveness
    const dragIterations = 1000;
    Dashboard.carloResults = Carlo.runCarloAllScenarios(state, dragIterations);
    Dashboard.nassimResults = Nassim.classifyAllScenarios(Dashboard.carloResults, state);

    Dashboard._lastSimTimeMs = performance.now() - simStart;

    // MINIMAL render path — NO slider DOM re-render
    Dashboard._renderSliderUpdate();

    // After 500ms idle, re-run at user's selected count if different
    if (Dashboard._iterationCount > 1000) {
      clearTimeout(Dashboard._precisionRerunTimeout);
      Dashboard._precisionRerunTimeout = setTimeout(() => {
        Dashboard.carloResults = Carlo.runCarloAllScenarios(state, Dashboard._iterationCount);
        Dashboard.nassimResults = Nassim.classifyAllScenarios(Dashboard.carloResults, state);
        // Precision re-run: update visuals but skip restarting the AI refinement timer
        Dashboard._isPrecisionRerun = true;
        Dashboard._renderSliderUpdate();
        Dashboard._isPrecisionRerun = false;
      }, 500);
    }

    // Re-render Layer 2/3 if open
    if (Dashboard._layer2Open) Dashboard.renderLayer2();
    if (Dashboard._layer3Open) Dashboard.renderLayer3();

  } catch (error) {
    console.error('Slider rerun error:', error);
  }
};

/**
 * Minimal render path for slider updates — never touches slider DOM.
 * Updates: score circle (morph), verdict text, delta badges, simulation badge.
 */
Dashboard._renderSliderUpdate = function() {
  const state = Dashboard.prismaState;
  if (!Dashboard.nassimResults || !Dashboard.carloResults) return;

  // Find best scenario
  const scenarios = state.scenarios || [];
  let bestScenarioId = null;
  let bestScore = -1;
  for (const s of scenarios) {
    if (s.id === 'nothing' || s.id === 'do_nothing') continue;
    const c = Dashboard.nassimResults[s.id];
    if (c) {
      const score = Nassim.computeDecisionScore(c);
      if (score > bestScore) { bestScore = score; bestScenarioId = s.id; }
    }
  }
  if (!bestScenarioId && scenarios.length > 0) bestScenarioId = scenarios[0].id;
  if (!bestScenarioId) return;

  const classification = Dashboard.nassimResults[bestScenarioId];
  const summary = Dashboard.carloResults[bestScenarioId]?.summary;
  if (!classification || !summary) return;

  // Track best scenario for dynamic recs
  const bestScenario = state.scenarios.find(s => s.id === bestScenarioId);
  Dashboard._bestScenarioId = bestScenarioId;
  Dashboard._bestScenarioLabel = bestScenario?.label || bestScenarioId;
  Dashboard._bestScenarioScore = bestScore;

  // Check if any slider differs from baseline
  const anySliderMoved = Dashboard._baselineValues && state.variables.some(v => {
    const bl = Dashboard._baselineValues[v.id];
    return bl !== undefined && Math.abs(v.value - bl) > 0.001;
  });

  // Generate verdict with scenario name when sliders have moved
  const verdict = anySliderMoved
    ? Nassim.generateVerdict(classification, summary, state, Dashboard._bestScenarioLabel)
    : Nassim.generateVerdict(classification, summary, state);

  // Morph score circle (not full re-render)
  Visualizations.updateScoreCircle(verdict.score, verdict.color);

  // Update verdict text
  Visualizations.renderVerdict(verdict);

  // --- Dynamic Recommendations ---
  if (anySliderMoved) {
    // Immediately shimmer rec cards so stale text fades out during crossfade
    Dashboard._setRecCardsRefining(true);

    // Sliders moved → generate template recs and crossfade
    Dashboard._recState = 'updated';
    const dynamicRecs = Dashboard.generateDynamicRecommendations();
    if (dynamicRecs) {
      Visualizations.renderRecommendations(dynamicRecs, true);
    }

    // Start 2s AI refinement timer (live mode only, skip on precision re-runs)
    if (Dashboard._mode === 'live' && !Dashboard._isPrecisionRerun) {
      Dashboard._startAIRefinement();
    }
  } else {
    // All sliders at baseline → clear shimmer and restore original recs
    Dashboard._setRecCardsRefining(false);
    if (Dashboard._recState !== 'baseline' && Dashboard._originalRecommendation) {
      Dashboard._recState = 'baseline';
      Dashboard._cancelAIRefinement();
      Visualizations.renderRecommendations(Dashboard._originalRecommendation, true);
    }
  }

  // Update delta badges on existing sliders
  Visualizations.updateFrontPageSliderDeltas(Dashboard._activeBaseline || Dashboard._baselineValues, state);

  // Update simulation badge
  const badgeEl = document.getElementById('simulation-badge');
  if (badgeEl) {
    const numScenarios = scenarios.length;
    const totalSims = numScenarios * Dashboard._iterationCount;
    const timeMs = Dashboard._lastSimTimeMs || 0;
    const timeStr = timeMs < 1000 ? Math.round(timeMs) + 'ms' : (timeMs / 1000).toFixed(1) + 's';
    badgeEl.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = totalSims.toLocaleString();
    badgeEl.appendChild(strong);
    badgeEl.appendChild(document.createTextNode(' simulations across ' + numScenarios + ' scenarios analyzed in '));
    const timeStrong = document.createElement('strong');
    timeStrong.textContent = timeStr;
    badgeEl.appendChild(timeStrong);
  }

  // Show/hide reset button
  const resetBtn = document.getElementById('reset-sliders-btn');
  if (resetBtn && Dashboard._baselineValues) {
    const anyDiff = state.variables.some(v => {
      const bl = Dashboard._baselineValues[v.id];
      return bl !== undefined && Math.abs(v.value - bl) > 0.001;
    });
    resetBtn.classList.toggle('hidden', !anyDiff);
  }
};

/**
 * Generate template-based dynamic recommendations from current simulation state.
 * Returns {action, watch, trigger} with natural-sounding text.
 *
 * Uses best scenario, runner-up, top sensitivity variable, and score ranges
 * to select from multiple template variants per card.
 */
Dashboard.generateDynamicRecommendations = function() {
  const state = Dashboard.prismaState;
  const scenarios = state.scenarios || [];
  const nassim = Dashboard.nassimResults;
  const carlo = Dashboard.carloResults;
  const sensitivity = Dashboard.fullSensitivityResults || Dashboard.sensitivityResults || [];

  if (!nassim || !carlo || scenarios.length === 0) return null;

  // --- Gather context ---

  // Best scenario (non-nothing)
  let bestId = null, bestScore = -1, bestLabel = '';
  let runnerUpId = null, runnerUpScore = -1, runnerUpLabel = '';
  for (const s of scenarios) {
    if (s.id === 'nothing' || s.id === 'do_nothing') continue;
    const c = nassim[s.id];
    if (!c) continue;
    const score = Nassim.computeDecisionScore(c);
    if (score > bestScore) {
      // Demote current best to runner-up
      runnerUpId = bestId;
      runnerUpScore = bestScore;
      runnerUpLabel = bestLabel;
      bestId = s.id;
      bestScore = score;
      bestLabel = s.label;
    } else if (score > runnerUpScore) {
      runnerUpId = s.id;
      runnerUpScore = score;
      runnerUpLabel = s.label;
    }
  }

  if (!bestId) return null;

  const bestSummary = carlo[bestId]?.summary;
  const bestClassification = nassim[bestId];
  if (!bestSummary || !bestClassification) return null;

  const unit = state.outcome?.unit || '';
  const pctPositive = bestClassification.percentPositive.toFixed(0);
  const medianStr = Visualizations._formatNumber(bestSummary.median);

  // Top sensitivity variable
  const topVar = sensitivity[0] || null;
  const topVarLabel = topVar?.variableLabel || 'key variables';
  const topVarSwing = topVar ? Visualizations._formatNumber(topVar.totalSwing) : '?';

  // Check slider direction vs baseline for top variable
  let topVarDirection = 'near';
  if (topVar && Dashboard._baselineValues) {
    const currentVar = state.variables.find(v => v.id === topVar.variableId);
    const baseline = Dashboard._baselineValues[topVar.variableId];
    if (currentVar && baseline !== undefined) {
      const diff = currentVar.value - baseline;
      if (diff > 0.001) topVarDirection = 'above';
      else if (diff < -0.001) topVarDirection = 'below';
    }
  }

  // --- Detect slider-vs-scenario tension ---
  // If the user moved a slider DOWN but the winning scenario overrides it UP,
  // flag the tension so the action card can acknowledge it.
  let tensionNote = '';
  const bestScenarioObj = scenarios.find(s => s.id === bestId);
  if (bestScenarioObj?.changes && Dashboard._baselineValues) {
    for (const [varId, change] of Object.entries(bestScenarioObj.changes)) {
      const currentVar = state.variables.find(v => v.id === varId);
      const baseline = Dashboard._baselineValues[varId];
      if (!currentVar || baseline === undefined) continue;

      const scenarioValue = change.value ?? change;
      const userValue = currentVar.value;
      // Tension: user moved the slider opposite to what the scenario assumes
      const userMovedDown = userValue < baseline - 0.001;
      const scenarioAssumesUp = scenarioValue > baseline + 0.001;
      const userMovedUp = userValue > baseline + 0.001;
      const scenarioAssumesDown = scenarioValue < baseline - 0.001;

      if ((userMovedDown && scenarioAssumesUp) || (userMovedUp && scenarioAssumesDown)) {
        const varLabel = currentVar.label || varId;
        tensionNote = ` Note: this assumes ${varLabel} reaches ${Visualizations._formatNumber(scenarioValue)} — your current setting of ${Visualizations._formatNumber(userValue)} tells a different story. Validate that assumption.`;
        break; // One tension note is enough
      }
    }
  }

  // --- Action card (winning scenario) — plain, friendly language ---
  let action;
  if (bestScore >= 80) {
    action = `${bestLabel} is your best move. ${pctPositive} out of 100 simulated futures come out positive, with a typical gain of ${medianStr} ${unit}.${tensionNote}`;
  } else if (bestScore >= 60) {
    action = `${bestLabel} comes out on top. It works in ${pctPositive} out of 100 futures, with a typical outcome of ${medianStr} ${unit}. Not a slam dunk, but the best of your options.${tensionNote}`;
  } else if (bestScore >= 40) {
    action = `${bestLabel} is slightly ahead of the other options, but it's close. Only ${pctPositive} out of 100 futures are positive — think about ways to reduce your downside.${tensionNote}`;
  } else {
    action = `None of your options look great right now. ${bestLabel} is the best of the bunch, but only ${pctPositive} out of 100 futures come out positive. Consider whether this is the right time, or if you can change the conditions.${tensionNote}`;
  }

  // --- Watch card (top sensitivity variable) — what matters most ---
  let watch;
  if (topVar) {
    const directionText = topVarDirection === 'above'
      ? 'currently set above the starting point'
      : topVarDirection === 'below'
        ? 'currently set below the starting point'
        : 'at its starting value';

    watch = `${topVarLabel} is the #1 factor that changes your outcome. It's ${directionText} right now. Try dragging that slider to see how sensitive your results are.`;
  } else {
    watch = 'Several variables affect your outcome equally. Try moving the sliders to see which one matters most for your situation.';
  }

  // --- Trigger card (runner-up scenario) — when to switch ---
  let trigger;
  if (runnerUpId && runnerUpLabel) {
    const gap = bestScore - runnerUpScore;
    if (gap <= 5) {
      trigger = `${runnerUpLabel} is almost tied. If ${topVarLabel} changes even slightly, it could become the better choice. Keep both options on the table.`;
    } else if (gap <= 15) {
      trigger = `If conditions around ${topVarLabel} shift, take another look at ${runnerUpLabel} — it's not far behind.`;
    } else {
      trigger = `${runnerUpLabel} is well behind right now. But if ${topVarLabel} changes significantly, come back and re-check.`;
    }
  } else {
    trigger = `If ${topVarLabel} shifts dramatically from current levels, re-run this analysis. The landscape could change.`;
  }

  return { action, watch, trigger };
};

/**
 * Start the 2s AI refinement debounce timer (live mode only).
 * Cancels any previous pending refinement and adds shimmer to rec cards.
 */
Dashboard._startAIRefinement = function() {
  Dashboard._cancelAIRefinement();
  Dashboard._setRecCardsRefining(true);
  Dashboard._refineTimeout = setTimeout(() => {
    Dashboard._fetchAIRefinement();
  }, 2000);
};

/**
 * Cancel any pending AI refinement (timer + in-flight fetch).
 * Also removes shimmer from rec cards.
 */
Dashboard._cancelAIRefinement = function() {
  if (Dashboard._refineTimeout) {
    clearTimeout(Dashboard._refineTimeout);
    Dashboard._refineTimeout = null;
  }
  if (Dashboard._activeAbort) {
    Dashboard._activeAbort.abort();
    Dashboard._activeAbort = null;
  }
  Dashboard._setRecCardsRefining(false);
};

/**
 * Add or remove the 'refining' shimmer class on all rec cards.
 * @param {boolean} refining - true to add shimmer, false to remove
 */
Dashboard._setRecCardsRefining = function(refining) {
  const cards = document.querySelectorAll('.rec-card');
  cards.forEach(card => {
    if (refining) {
      card.classList.add('refining');
    } else {
      card.classList.remove('refining');
    }
  });
};

/**
 * Fetch AI-refined recommendations from /api/refine-recommendations.
 * Implements version counter + AbortController for race condition prevention.
 */
Dashboard._fetchAIRefinement = function() {
  if (Dashboard._mode !== 'live') return;
  if (Dashboard._recState !== 'updated') return;

  Dashboard._recVersion++;
  const thisVersion = Dashboard._recVersion;
  Dashboard._recState = 'refining';

  if (Dashboard._activeAbort) Dashboard._activeAbort.abort();
  Dashboard._activeAbort = new AbortController();

  const state = Dashboard.prismaState;
  const sensitivity = Dashboard.fullSensitivityResults || [];
  const topVar = sensitivity[0] || null;

  // Find runner-up scenario
  const scenarios = state.scenarios || [];
  let bestId = Dashboard._bestScenarioId;
  let runnerUpId = null, runnerUpLabel = '', runnerUpScore = 0;
  for (const s of scenarios) {
    if (s.id === 'nothing' || s.id === 'do_nothing' || s.id === bestId) continue;
    const c = Dashboard.nassimResults?.[s.id];
    if (!c) continue;
    const score = Nassim.computeDecisionScore(c);
    if (score > runnerUpScore) {
      runnerUpId = s.id;
      runnerUpScore = score;
      runnerUpLabel = s.label;
    }
  }

  const payload = {
    bestScenario: { id: bestId, label: Dashboard._bestScenarioLabel, score: Dashboard._bestScenarioScore },
    runnerUp: runnerUpId ? { id: runnerUpId, label: runnerUpLabel, score: runnerUpScore } : null,
    topVariable: topVar ? { label: topVar.variableLabel, swing: topVar.totalSwing } : null,
    unit: state.outcome?.unit || '',
    percentPositive: Dashboard.nassimResults?.[bestId]?.percentPositive?.toFixed(0) || '?',
    median: Dashboard.carloResults?.[bestId]?.summary?.median || 0
  };

  var refineHeaders = { 'Content-Type': 'application/json' };
  var refineAuth = sessionStorage.getItem('prisma-auth');
  if (refineAuth) refineHeaders['X-Prisma-Auth'] = refineAuth;

  fetch('/api/refine-recommendations', {
    method: 'POST',
    headers: refineHeaders,
    body: JSON.stringify(payload),
    signal: Dashboard._activeAbort.signal
  })
    .then(res => {
      if (res.status === 401) {
        if (window.PrismaGate) window.PrismaGate.handle401();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('API error');
      return res.json();
    })
    .then(data => {
      // Discard stale responses
      if (thisVersion !== Dashboard._recVersion) return;
      // Validate response
      if (!data.action || !data.watch || !data.trigger) return;
      if (data.action.length > 500 || data.watch.length > 500 || data.trigger.length > 500) return;

      // Apply AI text via same crossfade and remove shimmer
      Dashboard._recState = 'updated';
      Dashboard._setRecCardsRefining(false);
      Visualizations.renderRecommendations(data, true);
    })
    .catch(() => {
      // Network error / aborted / garbled — silently keep template text, remove shimmer
      if (thisVersion === Dashboard._recVersion) {
        Dashboard._recState = 'updated';
        Dashboard._setRecCardsRefining(false);
      }
    });
};

/**
 * Check if ALL outcomes for ALL scenarios are zero (or within epsilon).
 * Returns true if the simulation couldn't differentiate between options.
 */
Dashboard._checkAllZeroOutcomes = function(carloResults) {
  if (!carloResults) return false;
  const EPSILON = 0.001;
  for (const scenarioId of Object.keys(carloResults)) {
    const outcomes = carloResults[scenarioId]?.outcomes;
    if (!outcomes || outcomes.length === 0) continue;
    const hasNonZero = outcomes.some(v => Math.abs(v) > EPSILON);
    if (hasNonZero) return false;
  }
  return true;
};

/**
 * Show the formula warning banner in the answer panel.
 */
Dashboard._showFormulaWarning = function() {
  let banner = document.getElementById('formula-warning-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'formula-warning-banner';
    banner.className = 'formula-warning-banner';
    const strong = document.createElement('strong');
    strong.textContent = 'Heads up:';
    banner.appendChild(strong);
    banner.appendChild(document.createTextNode(' The simulation couldn\'t differentiate between your options. Try rephrasing your question with more specific numbers.'));
    const answerPanel = document.querySelector('.answer-panel');
    if (answerPanel) {
      answerPanel.insertBefore(banner, answerPanel.firstChild);
    }
  }
  banner.classList.remove('hidden');
};

/**
 * Hide the formula warning banner.
 */
Dashboard._hideFormulaWarning = function() {
  const banner = document.getElementById('formula-warning-banner');
  if (banner) banner.classList.add('hidden');
};

/**
 * Select which variables appear as front-page sliders.
 * Top 3 by sensitivity + any AI-promoted.
 */
Dashboard.selectFrontPageSliders = function() {
  const fullSens = Dashboard.fullSensitivityResults || [];
  const promoted = Dashboard._promotedSliders || new Set();

  const top3Ids = fullSens.slice(0, 3).map(s => s.variableId);
  const frontIds = new Set([...top3Ids, ...promoted]);
  const moreIds = fullSens.slice(3).map(s => s.variableId).filter(id => !frontIds.has(id));

  return { frontIds: [...frontIds], moreIds };
};

/**
 * Reset all sliders to session baseline values, re-render, and re-run.
 */
Dashboard.resetSliders = function() {
  if (!Dashboard._baselineValues) return;

  // Cancel any pending AI refinement and reset rec state
  Dashboard._cancelAIRefinement();
  Dashboard._recState = 'baseline';

  const state = Dashboard.prismaState;
  for (const v of state.variables) {
    if (Dashboard._baselineValues[v.id] !== undefined) {
      v.value = Dashboard._baselineValues[v.id];
    }
  }

  // Reset the active baseline
  Dashboard._activeBaseline = { ...Dashboard._baselineValues };

  // Force re-render of front sliders
  Dashboard._frontSlidersRendered = false;
  Dashboard._frontSliderIds = null;
  Dashboard._moreSliderIds = null;

  // Crossfade back to original recommendations
  if (Dashboard._originalRecommendation) {
    Visualizations.renderRecommendations(Dashboard._originalRecommendation, true);
  }

  // Hide reset button
  const resetBtn = document.getElementById('reset-sliders-btn');
  if (resetBtn) resetBtn.classList.add('hidden');

  Dashboard.runSimulation();
};

/**
 * Load demo data
 */
Dashboard.loadDemoData = function() {
  console.log('Loading demo data...');

  if (typeof DEMO_DATA !== 'undefined') {
    Dashboard.prismaState = JSON.parse(JSON.stringify(DEMO_DATA));
    Dashboard.isDemoMode = true;
    Dashboard.activateForPhase('verdict');
    console.log('Demo data loaded successfully');
    return true;
  }

  console.warn('DEMO_DATA not found. Using fallback data.');
  Dashboard.loadTestData();
  return false;
};

/**
 * Load test data
 */
Dashboard.loadTestData = function() {
  console.log('Loading test data...');

  Dashboard.prismaState = {
    meta: { title: 'Test Decision', summary: 'A simple test scenario', tier: 1, generatedAt: new Date().toISOString() },
    variables: [
      { id: 'input_var', label: 'Input Variable', value: 100, min: 80, max: 120, distribution: 'normal', unit: 'units', isInput: true },
      { id: 'outcome_var', label: 'Outcome Variable', value: 50, min: 30, max: 70, distribution: 'normal', unit: 'points', isInput: false },
      { id: 'monthly_profit', label: 'Monthly Profit', value: 1000, min: 500, max: 1500, distribution: 'normal', unit: '\u20ac/month', isInput: false }
    ],
    edges: [
      { from: 'input_var', to: 'outcome_var', effect: 'positive', strength: 0.7, formula: 'outcome_var = input_var * 0.5' },
      { from: 'outcome_var', to: 'monthly_profit', effect: 'positive', strength: 0.8, formula: 'monthly_profit = 500 + outcome_var * 10' }
    ],
    feedbackLoops: [],
    scenarios: [
      { id: 'scenario_a', label: 'Scenario A', color: '#10b981', changes: { input_var: { value: 110, min: 100, max: 120 } }, assumptions: ['Optimistic scenario'] },
      { id: 'scenario_b', label: 'Scenario B', color: '#ef4444', changes: { input_var: { value: 90, min: 80, max: 100 } }, assumptions: ['Pessimistic scenario'] },
      { id: 'nothing', label: 'Do Nothing', color: '#6b7280', changes: {}, assumptions: ['Status quo'] }
    ],
    outcome: { id: 'monthly_profit_delta', label: 'Monthly Profit Change', unit: '\u20ac/month', formula: 'scenario_monthly_profit - baseline_monthly_profit', positiveLabel: 'Profit Gain', negativeLabel: 'Profit Loss' },
    recommendation: { action: 'Choose Scenario A for better outcomes', watch: 'Monitor input_var closely', trigger: 'If input_var drops below 85, reconsider' }
  };

  Dashboard.isDemoMode = true;
  Dashboard.activateForPhase('verdict');
  console.log('Test data loaded successfully');
};

// ==================== PRISMA 2.0: DATA MODE FUNCTIONS ====================

/**
 * Set up the upload drop zone on the landing page.
 */
Dashboard.setupUploadZone = function() {
  const dropZone = document.getElementById('upload-drop-zone');
  const fileInput = document.getElementById('landing-file-upload');
  const demoBtn = document.getElementById('btn-demo-data');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', (e) => {
      if (e.target === demoBtn || e.target.closest('.btn-demo-data')) return;
      fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0 && typeof Chat !== 'undefined') {
        Dashboard._dataMode = true;
        Chat.handleCSVUpload(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0] && typeof Chat !== 'undefined') {
        Dashboard._dataMode = true;
        Chat.handleCSVUpload(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  if (demoBtn) {
    demoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Dashboard._dataMode = true;
      Dashboard.loadDemoCSV();
    });
  }
};

/**
 * Show skeleton loading state immediately after upload (no dead screen).
 */
Dashboard.showSkeletonLoading = function() {
  // Reveal chat panel by removing pre-upload state
  const app = document.querySelector('.prisma-app');
  if (app) app.classList.remove('pre-upload');

  if (typeof ChartRenderer !== 'undefined') {
    ChartRenderer.renderSkeletonLoading();
  }
};

/**
 * Show the data overview (charts, KPIs, insights) after Claude responds.
 */
Dashboard.showDataOverview = function() {
  // Ensure chat panel is visible
  const app = document.querySelector('.prisma-app');
  if (app) app.classList.remove('pre-upload');

  const dormant = document.getElementById('panel-dormant');
  const dataOverview = document.getElementById('data-overview');

  if (dormant) dormant.style.display = 'none';
  if (dataOverview) dataOverview.style.display = 'block';

  if (!Dashboard.prismaState || !Dashboard._csvData || typeof ChartRenderer === 'undefined') return;

  if (!Dashboard._dataOverviewRendered) {
    // FIRST: render into main containers (existing behavior)
    ChartRenderer.renderDataOverview(
      Dashboard.prismaState,
      Dashboard._csvData,
      Dashboard._csvAnalysis
    );
    Dashboard._dataOverviewRendered = true;
  } else {
    // SUBSEQUENT: create expandable analysis card instead of wiping the dashboard
    const lastUserMsg = (typeof Chat !== 'undefined' && Chat.messages.length > 0)
      ? Chat.messages.filter(m => m.role === 'user').pop()
      : null;
    const questionText = (typeof lastUserMsg?.content === 'string')
      ? lastUserMsg.content
      : (Array.isArray(lastUserMsg?.content) ? lastUserMsg.content.find(b => b.type === 'text')?.text : null);
    const label = questionText || Dashboard.prismaState?.dataSummary?.description || 'Follow-up Analysis';
    Dashboard._createAnalysisCard(label);
  }
};

/**
 * Create a simulation card and prepend it to the history container.
 * Each card has its own teaser + expandable full analysis with unique IDs.
 */
Dashboard._createSimCard = function() {
  const historyContainer = document.getElementById('simulation-history');
  if (!historyContainer || !Dashboard.carloResults) return;

  const entry = Dashboard.simulationHistory[Dashboard.simulationHistory.length - 1];
  if (!entry) return;

  const simId = entry.id;
  const pct = Math.round(entry.bestPctPositive);

  // Build card DOM safely (no innerHTML — label could be user text)
  const card = document.createElement('div');
  card.className = 'sim-card';
  card.dataset.simId = simId;

  // Teaser section
  const teaser = document.createElement('div');
  teaser.className = 'simulation-teaser';

  const teaserContent = document.createElement('div');
  teaserContent.className = 'teaser-content';

  const labelEl = document.createElement('span');
  labelEl.className = 'teaser-label';
  labelEl.textContent = entry.label || 'Simulation ' + simId;

  const scoreEl = document.createElement('span');
  scoreEl.className = 'teaser-score';
  scoreEl.textContent = pct >= 99
    ? pct + '% positive outcome (narrow range)'
    : pct + '% positive outcome';

  const simBadge = document.createElement('span');
  simBadge.className = 'card-type-badge sim-badge';
  simBadge.textContent = 'SIMULATION';
  teaserContent.appendChild(simBadge);
  teaserContent.appendChild(labelEl);
  teaserContent.appendChild(scoreEl);

  const btn = document.createElement('button');
  btn.className = 'sim-full-analysis-btn full-analysis-btn shine';
  btn.textContent = 'Full Analysis';

  teaser.appendChild(teaserContent);
  teaser.appendChild(btn);

  // Full analysis section (collapsed)
  const analysis = document.createElement('div');
  analysis.className = 'full-analysis collapsed';
  analysis.id = 'sim-' + simId + '-analysis';

  const inner = document.createElement('div');
  inner.className = 'full-analysis-inner';

  const top = document.createElement('div');
  top.className = 'full-analysis-top';

  const histogramEl = document.createElement('div');
  histogramEl.className = 'full-analysis-histogram';
  histogramEl.id = 'sim-' + simId + '-histogram';

  const statsEl = document.createElement('div');
  statsEl.className = 'full-analysis-stats';
  statsEl.id = 'sim-' + simId + '-stats';

  top.appendChild(histogramEl);
  top.appendChild(statsEl);

  const tornadoEl = document.createElement('div');
  tornadoEl.id = 'sim-' + simId + '-tornado';

  // Recommendation triptych
  const recTriptych = document.createElement('div');
  recTriptych.className = 'rec-triptych';

  const recNames = [
    { cls: 'rec-do', heading: 'Do this', idSuffix: '-rec-do' },
    { cls: 'rec-watch', heading: 'Watch this', idSuffix: '-rec-watch' },
    { cls: 'rec-pivot', heading: 'Change if...', idSuffix: '-rec-pivot' }
  ];

  recNames.forEach(function(r) {
    const recCard = document.createElement('div');
    recCard.className = 'rec-card ' + r.cls;
    const h4 = document.createElement('h4');
    h4.textContent = r.heading;
    const p = document.createElement('p');
    p.id = 'sim-' + simId + r.idSuffix;
    recCard.appendChild(h4);
    recCard.appendChild(p);
    recTriptych.appendChild(recCard);
  });

  inner.appendChild(top);
  inner.appendChild(tornadoEl);
  inner.appendChild(recTriptych);
  analysis.appendChild(inner);

  card.appendChild(teaser);
  card.appendChild(analysis);

  // Prepend (newest on top)
  historyContainer.prepend(card);

  // Show section label
  document.getElementById('sim-section-label')?.classList.add('visible');

  // Chat confirmation
  if (typeof Chat !== 'undefined') {
    Chat.displayMessage('assistant', 'Simulation complete \u2014 ' + pct + '% of 1,000 futures come out positive. Click \u201cFull Analysis\u201d on the right to explore the results.');
  }

  // Scroll card into view
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

/**
 * Create a failed simulation card with diagnostic info and retry button.
 * Shown when the simulation engine couldn't produce results.
 */
Dashboard._createFailedSimCard = function(label, diagnostic) {
  const historyContainer = document.getElementById('simulation-history');
  if (!historyContainer) return;

  const card = document.createElement('div');
  card.className = 'sim-card sim-card-failed';

  const teaser = document.createElement('div');
  teaser.className = 'simulation-teaser';

  const teaserContent = document.createElement('div');
  teaserContent.className = 'teaser-content';

  const labelEl = document.createElement('span');
  labelEl.className = 'teaser-label';
  labelEl.textContent = label || 'Simulation';

  const scoreEl = document.createElement('span');
  scoreEl.className = 'teaser-score';
  scoreEl.textContent = diagnostic || 'Simulation could not complete';

  teaserContent.appendChild(labelEl);
  teaserContent.appendChild(scoreEl);

  const retryBtn = document.createElement('button');
  retryBtn.className = 'full-analysis-btn';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', () => {
    card.remove();
    if (typeof Chat !== 'undefined') {
      Chat.triggerSimulation(label);
    }
  });

  teaser.appendChild(teaserContent);
  teaser.appendChild(retryBtn);
  card.appendChild(teaser);

  historyContainer.prepend(card);

  // Chat notification
  if (typeof Chat !== 'undefined') {
    Chat.displayMessage('assistant', 'The simulation couldn\u2019t complete \u2014 ' + diagnostic.toLowerCase() + '. Click \u201cRetry\u201d on the card to try again.');
  }

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

/**
 * Create an analysis card for follow-up data_overview responses.
 * Preserves the original dashboard and stacks new analyses as expandable cards.
 */
Dashboard._createAnalysisCard = function(label) {
  const historyContainer = document.getElementById('analysis-history');
  if (!historyContainer) return;

  Dashboard._analysisCounter++;
  const aId = Dashboard._analysisCounter;

  // Snapshot current prisma state for this analysis
  const state = Dashboard.prismaState;
  const snapshot = JSON.parse(JSON.stringify({
    kpiCards: state.kpiCards,
    charts: state.charts,
    insights: state.insights,
    dataSummary: state.dataSummary
  }));

  const entry = {
    id: aId,
    timestamp: Date.now(),
    label: label,
    prismaData: snapshot,
    expanded: true
  };

  // Evict oldest if at memory cap
  if (Dashboard.analysisHistory.length >= Dashboard._maxAnalyses) {
    const evicted = Dashboard.analysisHistory.shift();
    const evictedCard = document.querySelector('.analysis-card[data-analysis-id="' + evicted.id + '"]');
    if (evictedCard) {
      const plots = evictedCard.querySelectorAll('.chart-plot');
      plots.forEach(function(p) { try { Plotly.purge(p); } catch(e) {} });
      evictedCard.remove();
    }
  }

  Dashboard.analysisHistory.push(entry);

  // Build card DOM
  const card = document.createElement('div');
  card.className = 'analysis-card';
  card.dataset.analysisId = aId;

  // Header
  const header = document.createElement('div');
  header.className = 'analysis-card-header';

  const labelEl = document.createElement('span');
  labelEl.className = 'analysis-card-label';
  // Truncate long labels
  const displayLabel = label.length > 100 ? label.substring(0, 97) + '...' : label;
  labelEl.textContent = displayLabel;

  const analysisBadge = document.createElement('span');
  analysisBadge.className = 'card-type-badge analysis-badge';
  analysisBadge.textContent = 'ANALYSIS';

  // Wrap badge + label so header stays 2-child flex (left group + toggle)
  const headerLeft = document.createElement('div');
  headerLeft.className = 'analysis-header-left';
  headerLeft.appendChild(analysisBadge);
  headerLeft.appendChild(labelEl);

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'analysis-card-toggle';
  toggleBtn.textContent = 'Collapse';
  toggleBtn.addEventListener('click', function() {
    Dashboard._toggleAnalysisCard(aId);
  });

  header.appendChild(headerLeft);
  header.appendChild(toggleBtn);

  // Content
  const content = document.createElement('div');
  content.className = 'analysis-card-content';
  content.id = 'analysis-' + aId + '-content';

  const kpiContainer = document.createElement('div');
  kpiContainer.className = 'kpi-strip';
  kpiContainer.id = 'analysis-' + aId + '-kpi';

  const chartContainer = document.createElement('div');
  chartContainer.className = 'chart-grid';
  chartContainer.id = 'analysis-' + aId + '-charts';

  const insightsContainer = document.createElement('div');
  insightsContainer.className = 'insights-section';
  insightsContainer.id = 'analysis-' + aId + '-insights';

  content.appendChild(kpiContainer);
  content.appendChild(chartContainer);
  content.appendChild(insightsContainer);

  card.appendChild(header);
  card.appendChild(content);

  historyContainer.prepend(card);

  // Show section label
  document.getElementById('analysis-section-label')?.classList.add('visible');

  // Render into card-specific containers
  if (typeof ChartRenderer !== 'undefined') {
    ChartRenderer.renderDataOverviewInto(snapshot, Dashboard._csvData, kpiContainer, chartContainer, insightsContainer);
  }

  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/**
 * Toggle expand/collapse for an analysis card.
 */
Dashboard._toggleAnalysisCard = function(analysisId) {
  const entry = Dashboard.analysisHistory.find(function(e) { return e.id === analysisId; });
  if (!entry) return;

  const content = document.getElementById('analysis-' + analysisId + '-content');
  const card = document.querySelector('.analysis-card[data-analysis-id="' + analysisId + '"]');
  const btn = card ? card.querySelector('.analysis-card-toggle') : null;
  if (!content) return;

  entry.expanded = !entry.expanded;

  if (entry.expanded) {
    content.classList.remove('collapsed');
    if (btn) btn.textContent = 'Collapse';
    // Re-render from snapshot
    const kpiContainer = document.getElementById('analysis-' + analysisId + '-kpi');
    const chartContainer = document.getElementById('analysis-' + analysisId + '-charts');
    const insightsContainer = document.getElementById('analysis-' + analysisId + '-insights');
    if (typeof ChartRenderer !== 'undefined' && kpiContainer && chartContainer && insightsContainer) {
      ChartRenderer.renderDataOverviewInto(entry.prismaData, Dashboard._csvData, kpiContainer, chartContainer, insightsContainer);
    }
  } else {
    content.classList.add('collapsed');
    if (btn) btn.textContent = 'Expand';
    // Purge Plotly charts on collapse
    const plots = content.querySelectorAll('.chart-plot');
    plots.forEach(function(p) { try { Plotly.purge(p); } catch(e) {} });
  }
};

/**
 * Toggle Full Analysis expand/collapse for a specific simulation card.
 */
Dashboard.toggleSimCard = function(simId) {
  const entry = Dashboard.simulationHistory.find(function(e) { return e.id === simId; });
  if (!entry) return;

  const analysis = document.getElementById('sim-' + simId + '-analysis');
  const card = document.querySelector('.sim-card[data-sim-id="' + simId + '"]');
  const btn = card ? card.querySelector('.sim-full-analysis-btn') : null;
  if (!analysis) return;

  entry.expanded = !entry.expanded;

  if (entry.expanded) {
    analysis.classList.remove('collapsed');
    analysis.classList.add('expanded');
    if (card) card.classList.add('analysis-expanded');
    if (btn) {
      btn.classList.remove('shine');
      btn.classList.add('expanded');
      btn.textContent = 'Hide Analysis';
    }
    // Render full analysis contents for this card
    Dashboard._renderSimAnalysis(entry);
  } else {
    analysis.classList.remove('expanded');
    analysis.classList.add('collapsed');
    if (card) card.classList.remove('analysis-expanded');
    if (btn) {
      btn.classList.remove('expanded');
      btn.textContent = 'Full Analysis';
    }
    // Purge Plotly charts on collapse to free memory
    var histEl = document.getElementById('sim-' + simId + '-histogram');
    var tornEl = document.getElementById('sim-' + simId + '-tornado');
    if (histEl && typeof Plotly !== 'undefined') {
      try { Plotly.purge(histEl); } catch(e) { console.warn('[Memory] Failed to purge histogram:', e); }
    }
    if (tornEl && typeof Plotly !== 'undefined') {
      try { Plotly.purge(tornEl); } catch(e) { console.warn('[Memory] Failed to purge tornado:', e); }
    }
  }
};

/**
 * Legacy compat: toggleFullAnalysis delegates to latest sim card.
 */
Dashboard.toggleFullAnalysis = function() {
  var latest = Dashboard.simulationHistory[Dashboard.simulationHistory.length - 1];
  if (latest) Dashboard.toggleSimCard(latest.id);
};

/**
 * Render full analysis contents for a specific simulation card.
 * Uses the entry's snapshot data and card-specific container IDs.
 */
Dashboard._renderSimAnalysis = function(entry) {
  const state = Dashboard.prismaState;
  const carloResults = entry.carloResults;
  if (!carloResults) return;

  const simId = entry.id;

  // Probability histogram — first time per card: Futures Cascade, then Plotly
  const histContainer = document.getElementById('sim-' + simId + '-histogram');
  if (histContainer) {
    if (!entry.futuresCascadePlayed && typeof ChartRenderer !== 'undefined' && ChartRenderer.renderFuturesCascade) {
      entry.futuresCascadePlayed = true;
      ChartRenderer.renderFuturesCascade(histContainer, carloResults, state);
    } else if (typeof Visualizations !== 'undefined' && Visualizations.renderProbabilityHistogram) {
      Visualizations.renderProbabilityHistogram(carloResults, state, histContainer);
    }
  }

  // Stats card
  const statsContainer = document.getElementById('sim-' + simId + '-stats');
  if (statsContainer) {
    Dashboard._renderSimulationStats(statsContainer, carloResults, state);
  }

  // Sensitivity tornado — pass container directly (no more ID swap hack)
  const sensResults = entry.sensitivityResults || Dashboard.sensitivityResults;
  if (sensResults && typeof Visualizations !== 'undefined') {
    const tornadoContainer = document.getElementById('sim-' + simId + '-tornado');
    if (tornadoContainer) {
      Visualizations.renderTornado(sensResults, state, tornadoContainer);
    }
  }

  // Recommendation (if available)
  if (entry.recommendation || state.recommendation) {
    const rec = entry.recommendation || state.recommendation;
    const doEl = document.getElementById('sim-' + simId + '-rec-do');
    const watchEl = document.getElementById('sim-' + simId + '-rec-watch');
    const pivotEl = document.getElementById('sim-' + simId + '-rec-pivot');
    if (doEl) doEl.textContent = rec.action || '';
    if (watchEl) watchEl.textContent = rec.watch || '';
    if (pivotEl) pivotEl.textContent = rec.trigger || '';
  }
};

/**
 * Legacy compat wrapper.
 */
Dashboard._renderFullAnalysis = function() {
  var latest = Dashboard.simulationHistory[Dashboard.simulationHistory.length - 1];
  if (latest) Dashboard._renderSimAnalysis(latest);
};

/**
 * Render simulation stats card into a specific container.
 */
Dashboard._renderSimulationStats = function(container, carloResults, state) {
  if (!container || !carloResults) return;

  container.textContent = '';
  const scenarios = state.scenarios || [];
  const unit = state.outcome?.unit || '';

  // Find best non-nothing scenario
  let bestId = null;
  let bestPct = 0;
  for (const s of scenarios) {
    if (s.id === 'nothing' || s.id === 'do_nothing') continue;
    const r = carloResults[s.id];
    if (r && r.summary && r.summary.percentPositive > bestPct) {
      bestPct = r.summary.percentPositive;
      bestId = s.id;
    }
  }
  if (!bestId) return;

  const summary = carloResults[bestId].summary;
  const fmt = (n) => typeof Visualizations !== 'undefined' ? Visualizations._formatNumber(n) : Math.round(n).toLocaleString();

  // Expected value (large)
  const primaryLabel = document.createElement('div');
  primaryLabel.className = 'stat-label';
  primaryLabel.textContent = 'EXPECTED OUTCOME';
  container.appendChild(primaryLabel);

  const primaryValue = document.createElement('div');
  primaryValue.className = 'stat-primary ' + (summary.median >= 0 ? 'positive' : 'negative');
  primaryValue.textContent = (summary.median >= 0 ? '+' : '') + fmt(summary.median) + ' ' + unit;
  container.appendChild(primaryValue);

  // Stat rows
  const stats = [
    ['Best case (P90)', fmt(summary.p90) + ' ' + unit],
    ['Worst case (P10)', fmt(summary.p10) + ' ' + unit],
    ['Positive outcomes', Math.round(summary.percentPositive) + '%'],
    ['Scenarios tested', scenarios.length.toString()]
  ];

  stats.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'stat-value';
    valueEl.textContent = value;
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    container.appendChild(row);
  });
};

/**
 * Render recommendation cards in Full Analysis.
 * Now accepts optional per-card element references.
 */
Dashboard._renderSimulationRecommendation = function(rec, doEl, watchEl, pivotEl) {
  const doText = doEl || document.getElementById('sim-rec-do-text');
  const watchText = watchEl || document.getElementById('sim-rec-watch-text');
  const pivotText = pivotEl || document.getElementById('sim-rec-pivot-text');

  if (doText) doText.textContent = rec.action || '';
  if (watchText) watchText.textContent = rec.watch || '';
  if (pivotText) pivotText.textContent = rec.trigger || '';
};

/**
 * Load demo CSV file and process it through the data flow.
 */
Dashboard.loadDemoCSV = function() {
  console.log('Loading demo CSV...');
  Dashboard._dataMode = true;

  // Fetch the demo CSV
  fetch('/data/delivery_logs_q4.csv')
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch demo CSV');
      return response.text();
    })
    .then(csvText => {
      // Parse it
      const result = Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      if (result.data && result.data.length > 0) {
        // Create a mock File object for handleCSVUpload flow
        const blob = new Blob([csvText], { type: 'text/csv' });
        const file = new File([blob], 'delivery_logs_q4.csv', { type: 'text/csv' });

        if (typeof Chat !== 'undefined') {
          Chat.handleCSVUpload(file);
        }
      }
    })
    .catch(err => {
      console.error('Demo CSV load failed:', err);
      if (typeof Chat !== 'undefined') {
        Chat.displayMessage('error', 'Failed to load demo data. Please try uploading a CSV file.');
      }
    });
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
