/**
 * VISUALIZATIONS.JS — Prisma Rendering Engine
 *
 * All visualization functions for the dashboard.
 * Functions are called by dashboard.js when data arrives.
 *
 * Design principles:
 * - Defensive: check if elements/data exist before rendering
 * - XSS-safe: use textContent for all LLM/user data
 * - Responsive: canvas scales with devicePixelRatio
 * - Cinematic: glows, animations, smooth transitions
 */

const Visualizations = {

  /**
   * Render Monte Carlo simulation as glowing dots on canvas
   * THE HERO VISUAL — must be impressive
   *
   * @param {Object} carloResults - Results from Carlo.runCarloAllScenarios()
   * @param {Object} prismaState - Full PRISMA_DATA state
   */
  renderMonteCarlo(carloResults, prismaState) {
    const canvas = document.getElementById('monte-carlo-canvas');
    if (!canvas) {
      console.warn('Monte Carlo canvas not found');
      return;
    }

    const statsDiv = document.getElementById('scenario-stats');

    // Size canvas
    const { ctx, width, height } = this._sizeCanvas(canvas);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get scenarios
    const scenarios = prismaState.scenarios || [];
    if (scenarios.length === 0) {
      console.warn('No scenarios to render');
      return;
    }

    // Calculate layout: divide height into bands for each scenario
    const bandHeight = height / scenarios.length;
    const padding = { top: 20, bottom: 10, left: 120, right: 20 };

    // Find global min/max across all outcomes for consistent X-axis
    let globalMin = Infinity;
    let globalMax = -Infinity;
    for (const scenario of scenarios) {
      const data = carloResults[scenario.id];
      if (!data || !data.outcomes) continue;
      const sorted = [...data.outcomes].sort((a, b) => a - b);
      globalMin = Math.min(globalMin, sorted[0]);
      globalMax = Math.max(globalMax, sorted[sorted.length - 1]);
    }

    // Add 10% padding to range
    const range = globalMax - globalMin;
    globalMin -= range * 0.1;
    globalMax += range * 0.1;

    // X scale function
    const xScale = (value) => {
      const zeroX = padding.left + ((0 - globalMin) / (globalMax - globalMin)) * (width - padding.left - padding.right);
      return padding.left + ((value - globalMin) / (globalMax - globalMin)) * (width - padding.left - padding.right);
    };

    // Draw zero line (vertical dashed line)
    const zeroX = xScale(0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(zeroX, 0);
    ctx.lineTo(zeroX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Collect dots for batch animation
    const allDots = [];

    // Render each scenario
    scenarios.forEach((scenario, scenarioIndex) => {
      const data = carloResults[scenario.id];
      if (!data || !data.outcomes) return;

      const outcomes = data.outcomes;
      const summary = data.summary;
      const scenarioColor = scenario.color || '#4fc3f7';

      // Band Y range
      const bandTop = scenarioIndex * bandHeight + padding.top;
      const bandBottom = (scenarioIndex + 1) * bandHeight - padding.bottom;
      const bandMid = (bandTop + bandBottom) / 2;

      // Draw scenario label on the left
      ctx.fillStyle = '#e8e8f0';
      ctx.font = '12px Geist, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(scenario.label, padding.left - 10, bandMid);

      // Draw dots (store for animation)
      outcomes.forEach(outcome => {
        const x = xScale(outcome);
        const y = bandTop + Math.random() * (bandBottom - bandTop);
        allDots.push({ x, y, color: scenarioColor });
      });

      // Draw summary stats: median line + p10-p90 range
      if (summary) {
        // P10-P90 range rectangle (translucent)
        const p10X = xScale(summary.p10);
        const p90X = xScale(summary.p90);
        ctx.fillStyle = scenarioColor + '20'; // 20 = hex for ~12% opacity
        ctx.fillRect(p10X, bandTop, p90X - p10X, bandBottom - bandTop);

        // Median line (solid)
        const medianX = xScale(summary.median);
        ctx.strokeStyle = scenarioColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(medianX, bandTop);
        ctx.lineTo(medianX, bandBottom);
        ctx.stroke();
      }
    });

    // Animate dots in batches
    this._animateDots(ctx, allDots);

    // Update stats div below canvas
    if (statsDiv) {
      statsDiv.textContent = '';
      scenarios.forEach(scenario => {
        const data = carloResults[scenario.id];
        if (!data || !data.summary) return;

        const s = data.summary;
        const statText = document.createElement('div');
        statText.style.fontFamily = 'Geist Mono, monospace';
        statText.style.fontSize = '11px';
        statText.style.color = '#8888a0';
        statText.style.marginBottom = '4px';

        statText.textContent = `${scenario.label}: median ${this._formatNumber(s.median)} | ${s.percentPositive.toFixed(0)}% positive | range: ${this._formatNumber(s.min)} to ${this._formatNumber(s.max)}`;

        statsDiv.appendChild(statText);
      });
    }
  },

  /**
   * Animate Monte Carlo dots appearing in batches
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} dots - Array of {x, y, color} objects
   */
  _animateDots(ctx, dots) {
    const batchSize = 100;
    const batchDelay = 50; // ms
    let currentBatch = 0;

    const drawBatch = () => {
      const start = currentBatch * batchSize;
      const end = Math.min(start + batchSize, dots.length);

      for (let i = start; i < end; i++) {
        const dot = dots[i];

        // Draw dot with glow
        ctx.shadowBlur = 6;
        ctx.shadowColor = dot.color;
        ctx.fillStyle = dot.color;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      currentBatch++;

      if (end < dots.length) {
        setTimeout(() => requestAnimationFrame(drawBatch), batchDelay);
      }
    };

    requestAnimationFrame(drawBatch);
  },

  /**
   * Render causal graph using HTML divs + SVG for edges
   * Simple 3-column layout: inputs | intermediates | outputs
   *
   * @param {Object} prismaState - Full PRISMA_DATA state
   */
  renderCausalGraph(prismaState) {
    const container = document.getElementById('causal-graph-container');
    if (!container) {
      console.warn('Causal graph container not found');
      return;
    }

    // Clear container
    container.textContent = '';
    container.style.position = 'relative';
    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.gap = '20px';
    container.style.padding = '10px';
    container.style.overflow = 'auto';

    const variables = prismaState.variables || [];
    const edges = prismaState.edges || [];
    const feedbackLoops = prismaState.feedbackLoops || [];

    if (variables.length === 0) {
      container.textContent = 'No variables defined';
      return;
    }

    // Classify variables into columns
    const inputs = [];
    const intermediates = [];
    const outputs = [];

    // Build adjacency info
    const hasIncoming = new Set();
    const hasOutgoing = new Set();
    edges.forEach(edge => {
      hasIncoming.add(edge.to);
      hasOutgoing.add(edge.from);
    });

    variables.forEach(v => {
      if (v.isInput || !hasIncoming.has(v.id)) {
        inputs.push(v);
      } else if (!hasOutgoing.has(v.id) || v.id === prismaState.outcome?.id) {
        outputs.push(v);
      } else {
        intermediates.push(v);
      }
    });

    // Create SVG for edges (positioned absolutely)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '0';

    // Define arrow marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    path.setAttribute('fill', '#4fc3f7');
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);

    container.appendChild(svg);

    // Create columns
    const createColumn = (title, vars) => {
      const col = document.createElement('div');
      col.style.display = 'flex';
      col.style.flexDirection = 'column';
      col.style.gap = '10px';
      col.style.flex = '1';
      col.style.minWidth = '120px';
      col.style.zIndex = '1';

      const colTitle = document.createElement('div');
      colTitle.textContent = title;
      colTitle.style.fontFamily = 'Geist Mono, monospace';
      colTitle.style.fontSize = '10px';
      colTitle.style.color = '#8888a0';
      colTitle.style.textTransform = 'uppercase';
      colTitle.style.marginBottom = '6px';
      colTitle.style.letterSpacing = '0.1em';
      col.appendChild(colTitle);

      vars.forEach(v => {
        const node = document.createElement('div');
        node.className = 'causal-node';
        node.dataset.varId = v.id;
        node.style.padding = '8px 12px';
        node.style.borderRadius = '8px';
        node.style.background = '#1a1a28';
        node.style.border = '1px solid rgba(79,195,247,0.15)';
        node.style.fontFamily = 'Geist Mono, monospace';
        node.style.fontSize = '11px';
        node.style.color = '#e8e8f0';
        node.style.position = 'relative';

        const label = document.createElement('div');
        label.textContent = v.label;
        label.style.fontWeight = '600';
        label.style.marginBottom = '2px';
        node.appendChild(label);

        const value = document.createElement('div');
        value.textContent = `${this._formatNumber(v.value)} ${v.unit || ''}`;
        value.style.fontSize = '10px';
        value.style.color = '#8888a0';
        node.appendChild(value);

        col.appendChild(node);
      });

      return col;
    };

    const inputCol = createColumn('INPUTS', inputs);
    const intermediateCol = createColumn('PROCESS', intermediates);
    const outputCol = createColumn('OUTCOMES', outputs);

    container.appendChild(inputCol);
    if (intermediates.length > 0) {
      container.appendChild(intermediateCol);
    }
    container.appendChild(outputCol);

    // Draw edges after layout settles
    setTimeout(() => {
      this._drawCausalEdges(svg, edges, feedbackLoops, container);
    }, 100);

    // Add feedback loop callout if exists
    if (feedbackLoops.length > 0) {
      const callout = document.createElement('div');
      callout.style.marginTop = '10px';
      callout.style.padding = '8px 12px';
      callout.style.background = 'rgba(239,83,80,0.1)';
      callout.style.border = '1px solid rgba(239,83,80,0.3)';
      callout.style.borderRadius = '6px';
      callout.style.fontFamily = 'Geist Mono, monospace';
      callout.style.fontSize = '11px';
      callout.style.color = '#ef5350';
      callout.textContent = `⚠ ${feedbackLoops[0].label || 'Feedback loop detected'}`;
      container.appendChild(callout);
    }
  },

  /**
   * Draw SVG edges between causal graph nodes
   * @param {SVGElement} svg - SVG element
   * @param {Array} edges - Array of edge objects
   * @param {Array} feedbackLoops - Array of feedback loop objects
   * @param {HTMLElement} container - Container element for position calculation
   */
  _drawCausalEdges(svg, edges, feedbackLoops, container) {
    const containerRect = container.getBoundingClientRect();

    // Get all node positions
    const nodePositions = {};
    container.querySelectorAll('.causal-node').forEach(node => {
      const varId = node.dataset.varId;
      const rect = node.getBoundingClientRect();
      nodePositions[varId] = {
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2
      };
    });

    // Build feedback loop edge set
    const feedbackEdges = new Set();
    feedbackLoops.forEach(loop => {
      if (loop.path) {
        for (let i = 0; i < loop.path.length - 1; i++) {
          feedbackEdges.add(`${loop.path[i]}->${loop.path[i + 1]}`);
        }
      }
    });

    // Draw edges
    edges.forEach(edge => {
      const fromPos = nodePositions[edge.from];
      const toPos = nodePositions[edge.to];

      if (!fromPos || !toPos) return;

      const isPositive = edge.effect === 'positive';
      const isFeedback = feedbackEdges.has(`${edge.from}->${edge.to}`);
      const strength = edge.strength || 0.5;

      // Line color
      const color = isPositive ? '#10b981' : '#ef5350';
      const strokeWidth = 1 + strength * 2; // 1-3px based on strength

      // Create line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fromPos.x);
      line.setAttribute('y1', fromPos.y);
      line.setAttribute('x2', toPos.x);
      line.setAttribute('y2', toPos.y);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', strokeWidth);
      line.setAttribute('marker-end', 'url(#arrowhead)');
      line.setAttribute('opacity', '0.6');

      if (isFeedback) {
        // Pulsing animation for feedback loops
        line.style.animation = 'edgePulse 2s infinite';
        line.setAttribute('stroke-dasharray', '4 4');
      }

      svg.appendChild(line);
    });

    // Add CSS animation for pulse if not already added
    if (!document.getElementById('edge-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'edge-pulse-style';
      style.textContent = `
        @keyframes edgePulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `;
      document.head.appendChild(style);
    }
  },

  /**
   * Render Taleb classification badges for all scenarios
   *
   * @param {Object} nassimResults - Results from Nassim.classifyAllScenarios()
   * @param {Object} prismaState - Full PRISMA_DATA state
   */
  renderTalebBadges(nassimResults, prismaState) {
    const container = document.getElementById('taleb-badges');
    if (!container) {
      console.warn('Taleb badges container not found');
      return;
    }

    // Clear container
    container.textContent = '';

    const scenarios = prismaState.scenarios || [];

    scenarios.forEach(scenario => {
      const classification = nassimResults[scenario.id];
      if (!classification) return;

      // Create badge card
      const badge = document.createElement('div');
      badge.className = `taleb-badge taleb-${classification.classification.toLowerCase()}`;

      // Label
      const label = document.createElement('div');
      label.className = 'badge-label';
      label.textContent = scenario.label;
      label.style.fontFamily = 'Geist Sans, sans-serif';
      label.style.fontSize = '10px';
      label.style.fontWeight = '700';
      label.style.textTransform = 'uppercase';
      label.style.letterSpacing = '0.1em';
      label.style.marginBottom = '4px';
      label.style.color = '#8888a0';
      badge.appendChild(label);

      // Classification
      const classDiv = document.createElement('div');
      classDiv.className = 'badge-classification';
      classDiv.textContent = classification.classification;
      classDiv.style.fontFamily = 'Geist Sans, sans-serif';
      classDiv.style.fontSize = '14px';
      classDiv.style.fontWeight = '700';
      classDiv.style.marginBottom = '6px';

      // Color based on classification
      const colors = {
        FRAGILE: '#ef5350',
        ROBUST: '#4caf50',
        ANTIFRAGILE: '#ab47bc'
      };
      classDiv.style.color = colors[classification.classification] || '#ffa726';
      badge.appendChild(classDiv);

      // Stat
      const stat = document.createElement('div');
      stat.className = 'badge-stat';
      stat.textContent = `${classification.percentPositive.toFixed(0)}% of futures positive`;
      stat.style.fontFamily = 'Geist Mono, monospace';
      stat.style.fontSize = '11px';
      stat.style.color = '#8888a0';
      stat.style.marginBottom = '6px';
      badge.appendChild(stat);

      // Reasoning
      const reasoning = document.createElement('div');
      reasoning.className = 'badge-reasoning';
      reasoning.textContent = classification.reasoning;
      reasoning.style.fontFamily = 'Geist Sans, sans-serif';
      reasoning.style.fontSize = '12px';
      reasoning.style.color = '#e8e8f0';
      reasoning.style.lineHeight = '1.4';
      badge.appendChild(reasoning);

      container.appendChild(badge);
    });
  },

  /**
   * Render tornado chart (sensitivity analysis) using Plotly
   *
   * @param {Array} sensitivityResults - Results from Nassim.runSensitivity()
   * @param {Object} prismaState - Full PRISMA_DATA state
   */
  renderTornado(sensitivityResults, prismaState) {
    const container = document.getElementById('tornado-chart');
    if (!container) {
      console.warn('Tornado chart container not found');
      return;
    }

    if (!sensitivityResults || sensitivityResults.length === 0) {
      container.textContent = 'No sensitivity data available';
      return;
    }

    // Take top 6 variables
    const topVars = sensitivityResults.slice(0, 6);

    // Prepare data for Plotly (horizontal bar chart)
    const labels = topVars.map(v => v.variableLabel).reverse();
    const impactLow = topVars.map(v => v.impactLow).reverse();
    const impactHigh = topVars.map(v => v.impactHigh).reverse();

    const trace1 = {
      x: impactLow,
      y: labels,
      type: 'bar',
      orientation: 'h',
      name: 'At Min',
      marker: {
        color: 'rgba(79,195,247,0.4)'
      }
    };

    const trace2 = {
      x: impactHigh,
      y: labels,
      type: 'bar',
      orientation: 'h',
      name: 'At Max',
      marker: {
        color: 'rgba(79,195,247,0.8)'
      }
    };

    const data = [trace1, trace2];

    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Geist Mono, monospace', color: '#8888a0', size: 11 },
      xaxis: {
        title: 'Impact on outcome',
        gridcolor: 'rgba(79,195,247,0.08)',
        zerolinecolor: 'rgba(255,255,255,0.2)',
        color: '#8888a0'
      },
      yaxis: {
        color: '#e8e8f0',
        automargin: true
      },
      margin: { l: 120, r: 20, t: 10, b: 40 },
      showlegend: false,
      barmode: 'overlay'
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot(container, data, layout, config);
  },

  /**
   * Render Markov timeline (if Markov data exists)
   *
   * @param {Object} timelines - Results from Markov.getMarkovOutcomeTimeline() for all scenarios
   * @param {Object} prismaState - Full PRISMA_DATA state
   */
  renderMarkovTimeline(timelines, prismaState) {
    const container = document.getElementById('markov-timeline');
    if (!container) {
      // Element doesn't exist — skip silently
      return;
    }

    if (!timelines || Object.keys(timelines).length === 0) {
      container.textContent = 'No Markov data available';
      return;
    }

    const scenarios = prismaState.scenarios || [];
    const traces = [];

    scenarios.forEach(scenario => {
      const timeline = timelines[scenario.id];
      if (!timeline) return;

      const months = timeline.map(t => t.month);
      const medians = timeline.map(t => t.outcomeMedian);
      const p25s = timeline.map(t => t.outcomeP25);
      const p75s = timeline.map(t => t.outcomeP75);

      // Median line
      traces.push({
        x: months,
        y: medians,
        type: 'scatter',
        mode: 'lines',
        name: scenario.label,
        line: {
          color: scenario.color || '#4fc3f7',
          width: 2
        }
      });

      // Shaded band (P25-P75)
      traces.push({
        x: [...months, ...months.reverse()],
        y: [...p75s, ...p25s.reverse()],
        type: 'scatter',
        mode: 'lines',
        fill: 'toself',
        fillcolor: (scenario.color || '#4fc3f7') + '20',
        line: { width: 0 },
        showlegend: false,
        hoverinfo: 'skip'
      });
    });

    const layout = {
      title: '6 months from now...',
      titlefont: { family: 'Geist Sans, sans-serif', size: 12, color: '#8888a0' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Geist Mono, monospace', color: '#8888a0', size: 11 },
      xaxis: {
        title: 'Month',
        gridcolor: 'rgba(79,195,247,0.08)',
        color: '#8888a0'
      },
      yaxis: {
        title: 'Outcome',
        gridcolor: 'rgba(79,195,247,0.08)',
        zerolinecolor: 'rgba(255,255,255,0.2)',
        color: '#8888a0'
      },
      margin: { l: 60, r: 20, t: 40, b: 40 },
      legend: {
        font: { family: 'Geist Sans, sans-serif', color: '#e8e8f0', size: 10 },
        bgcolor: 'transparent'
      }
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot(container, traces, layout, config);
  },

  /**
   * Render scenario comparison (BONUS — if element exists)
   *
   * @param {Object} carloResults - Results from Carlo.runCarloAllScenarios()
   * @param {Object} prismaState - Full PRISMA_DATA state
   */
  renderScenarioComparison(carloResults, prismaState) {
    const container = document.getElementById('scenario-compare');
    if (!container) {
      // Element doesn't exist — skip silently
      return;
    }

    const scenarios = prismaState.scenarios || [];
    const traces = [];

    scenarios.forEach(scenario => {
      const data = carloResults[scenario.id];
      if (!data || !data.outcomes) return;

      traces.push({
        y: data.outcomes,
        type: 'violin',
        name: scenario.label,
        marker: {
          color: scenario.color || '#4fc3f7'
        },
        box: { visible: true },
        meanline: { visible: true }
      });
    });

    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Geist Mono, monospace', color: '#8888a0', size: 11 },
      yaxis: {
        title: 'Outcome',
        gridcolor: 'rgba(79,195,247,0.08)',
        zerolinecolor: 'rgba(255,255,255,0.2)',
        color: '#8888a0'
      },
      xaxis: {
        color: '#e8e8f0'
      },
      margin: { l: 60, r: 20, t: 10, b: 60 },
      showlegend: false
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot(container, traces, layout, config);
  },

  /**
   * Helper: Size canvas accounting for devicePixelRatio
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @returns {Object} {ctx, width, height}
   */
  _sizeCanvas(canvas) {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    return { ctx, width: rect.width, height: rect.height };
  },

  /**
   * Helper: Format number for display
   * @param {number} num - Number to format
   * @returns {string} Formatted string
   */
  _formatNumber(num) {
    if (Math.abs(num) >= 1000) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }
};
