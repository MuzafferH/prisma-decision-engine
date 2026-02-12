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
  _isPrecisionRerun: false         // True during precision re-run (skip AI timer restart)
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

  // Check if server flagged a formula warning (validation failed on both attempts)
  if (toolCall.input._formulaWarning) {
    console.warn('[Dashboard] Server flagged formula warning — showing banner');
    Dashboard._showFormulaWarning();
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
  if (incoming.markov) { state.markov = incoming.markov; }

  console.log('PRISMA_STATE updated:', JSON.parse(JSON.stringify(state)));
};

/**
 * Activate dashboard sections based on the current phase
 * In v2: all visualization goes to the Answer Panel (Layers 1/2/3)
 */
Dashboard.activateForPhase = function(phase) {
  const phases = ['gathering', 'causal_graph', 'simulation', 'verdict', 'tier2_analysis'];
  const phaseIndex = phases.indexOf(phase);

  if (phaseIndex < 0) {
    console.warn(`Unknown phase: ${phase}`);
    return;
  }

  // Simulation → run engines + render Layer 1 verdict
  if (phaseIndex >= 2) {
    Dashboard.runSimulation();
  }

  // Verdict → show Layer 1
  if (phaseIndex >= 3) {
    Dashboard.showLayer1();
  }

  // Tier 2 (Discoveries)
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
    console.log('Not enough data for simulation yet');
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

    // Full sensitivity analysis (Phase 1 sync + Phase 2 async)
    const baseScenario = state.scenarios.find(s => s.id === 'nothing' || s.id === 'do_nothing') || state.scenarios[0];
    if (baseScenario) {
      console.log('Running full sensitivity analysis...');
      const phase1Results = Nassim.runFullSensitivity(state, baseScenario.id, 300, (fullResults) => {
        // Phase 2 callback: update with complete results
        Dashboard.fullSensitivityResults = fullResults;
        Dashboard.sensitivityResults = fullResults;
        console.log('Phase 2 sensitivity complete:', fullResults.length, 'variables');

        // Update "more variables" section if not yet rendered with full set
        if (Dashboard._frontSlidersRendered && Dashboard._moreSliderIds === null) {
          const { frontIds, moreIds } = Dashboard.selectFrontPageSliders();
          Dashboard._moreSliderIds = moreIds;
          // Re-render to include the expanded set
          Visualizations.renderFrontPageSliders(
            fullResults, state, frontIds, moreIds,
            Dashboard._activeBaseline || Dashboard._baselineValues,
            Dashboard._promotedSliders
          );
        }
      });

      Dashboard.fullSensitivityResults = phase1Results;
      Dashboard.sensitivityResults = phase1Results;
      console.log('Phase 1 sensitivity results:', phase1Results);
    }

    // Markov
    if (state.markov && state.markov.enabled) {
      Dashboard.runMarkov();
    }

    Dashboard._lastSimTimeMs = performance.now() - simStart;
    console.log('Total simulation time: ' + Dashboard._lastSimTimeMs.toFixed(0) + 'ms');

    // Render Layer 1 (always visible when data is ready)
    Dashboard.showLayer1();

    // If Layer 2 is already open, re-render it
    if (Dashboard._layer2Open) {
      Dashboard.renderLayer2();
    }

    // If Layer 3 is already open, re-render it
    if (Dashboard._layer3Open) {
      Dashboard.renderLayer3();
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

  fetch('/api/refine-recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: Dashboard._activeAbort.signal
  })
    .then(res => {
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
