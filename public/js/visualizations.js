/**
 * VISUALIZATIONS.JS — Prisma Rendering Engine v2
 *
 * Layer 1: renderScoreCircle(), renderVerdict(), renderRecommendations()
 * Layer 2: renderRangeBar(), renderScenarioComparison(), renderSimplifiedSensitivity()
 * Layer 3: renderMonteCarlo(), renderCausalGraph(), renderTalebBadges(),
 *          renderTornado(), renderMarkovTimeline(), renderSliders(), renderRawStats()
 */

const Visualizations = {

  // =========================================
  //  LAYER 1 RENDERERS — The Verdict
  // =========================================

  // Cached refs for score circle morph mode
  _scoreCircleRefs: null,
  _scoreCircleScore: null,

  /**
   * Render the SVG score circle (0–100) — full dramatic animation
   * Caches element refs for subsequent morph updates.
   * @param {number} score - Decision score 0-100
   * @param {string} color - Verdict color hex
   */
  renderScoreCircle(score, color) {
    const container = document.getElementById('score-circle');
    if (!container) return;

    container.textContent = '';

    const size = 80;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    // Background circle
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', size / 2);
    bgCircle.setAttribute('cy', size / 2);
    bgCircle.setAttribute('r', radius);
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', '#EEEEE8');
    bgCircle.setAttribute('stroke-width', strokeWidth);
    svg.appendChild(bgCircle);

    // Score arc
    const arcCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arcCircle.setAttribute('cx', size / 2);
    arcCircle.setAttribute('cy', size / 2);
    arcCircle.setAttribute('r', radius);
    arcCircle.setAttribute('fill', 'none');
    arcCircle.setAttribute('stroke', color);
    arcCircle.setAttribute('stroke-width', strokeWidth);
    arcCircle.setAttribute('stroke-linecap', 'round');
    arcCircle.setAttribute('stroke-dasharray', circumference);
    arcCircle.setAttribute('stroke-dashoffset', circumference);
    arcCircle.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
    arcCircle.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease';
    svg.appendChild(arcCircle);

    // Score number
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', size / 2);
    text.setAttribute('y', size / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', color);
    text.setAttribute('font-family', 'Geist, system-ui, sans-serif');
    text.setAttribute('font-size', '24');
    text.setAttribute('font-weight', '700');
    text.textContent = '0';
    svg.appendChild(text);

    container.appendChild(svg);

    // Cache refs for morph mode
    this._scoreCircleRefs = { arcCircle, text, circumference };
    this._scoreCircleScore = score;

    // Animate: count up + arc fill
    const targetOffset = circumference - (score / 100) * circumference;
    requestAnimationFrame(() => {
      arcCircle.style.strokeDashoffset = targetOffset;
    });

    // Count-up animation for the number
    const duration = 1200;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      text.textContent = Math.round(score * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  },

  /**
   * Morph the score circle from old score to new score (no reset-to-zero).
   * Uses CSS transition for arc + RAF for number count.
   * If no cached refs, falls back to full renderScoreCircle.
   *
   * @param {number} newScore - New decision score 0-100
   * @param {string} newColor - New verdict color hex
   */
  updateScoreCircle(newScore, newColor) {
    const refs = this._scoreCircleRefs;
    if (!refs) {
      // No cached refs yet — fall back to full render
      this.renderScoreCircle(newScore, newColor);
      return;
    }

    const { arcCircle, text, circumference } = refs;
    const oldScore = this._scoreCircleScore || 0;

    // Update arc (CSS transition handles the animation at 300ms)
    arcCircle.style.transition = 'stroke-dashoffset 0.3s ease-out, stroke 0.3s ease';
    const targetOffset = circumference - (newScore / 100) * circumference;
    arcCircle.setAttribute('stroke', newColor);
    arcCircle.style.strokeDashoffset = targetOffset;

    // Update text color
    text.setAttribute('fill', newColor);

    // Count from old to new with RAF
    const duration = 300;
    const startTime = performance.now();
    const countAnimate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(oldScore + (newScore - oldScore) * eased);
      text.textContent = current;
      if (progress < 1) requestAnimationFrame(countAnimate);
    };
    requestAnimationFrame(countAnimate);

    this._scoreCircleScore = newScore;
  },

  /**
   * Render verdict headline, summary, and risk text
   * Uses structured parts: [{text, bold?}] for selective bolding
   * @param {Object} verdict - {headline, summaryParts, riskParts}
   */
  renderVerdict(verdict) {
    const headlineEl = document.getElementById('verdict-headline');
    const summaryEl = document.getElementById('verdict-summary');
    const riskEl = document.getElementById('verdict-risk');

    if (headlineEl) headlineEl.textContent = verdict.headline || '';

    // Build summary with bold key numbers
    if (summaryEl && verdict.summaryParts) {
      summaryEl.textContent = '';
      this._renderParts(summaryEl, verdict.summaryParts);
    }

    // Build risk with bold key numbers
    if (riskEl && verdict.riskParts && verdict.riskParts.length > 0) {
      riskEl.textContent = '';
      const riskLabel = document.createElement('strong');
      riskLabel.textContent = 'Risk: ';
      riskLabel.style.color = '#EF4444';
      riskEl.appendChild(riskLabel);
      this._renderParts(riskEl, verdict.riskParts);
    }
  },

  /**
   * Render structured text parts into a container
   * @param {HTMLElement} container
   * @param {Array} parts - [{text, bold?}]
   */
  _renderParts(container, parts) {
    parts.forEach(part => {
      if (part.bold) {
        const strong = document.createElement('strong');
        strong.textContent = part.text;
        strong.style.color = '#1A1A1A';
        container.appendChild(strong);
      } else {
        container.appendChild(document.createTextNode(part.text));
      }
    });
  },

  /**
   * Ensure each rec card has a .refining-label span.
   * Called once after initial render or when cards are rebuilt.
   */
  _ensureRefiningLabels() {
    document.querySelectorAll('.rec-card').forEach(card => {
      if (!card.querySelector('.refining-label')) {
        const label = document.createElement('span');
        label.className = 'refining-label';
        label.textContent = 'refining...';
        card.appendChild(label);
      }
    });
  },

  /**
   * Render the recommendation triptych (Layer 1)
   * Supports crossfade: fade out current text, swap, fade in — staggered 50ms per card.
   * Removes the 'refining' shimmer class when rendering AI-refined text.
   * @param {Object} rec - {action, watch, trigger}
   * @param {boolean} [crossfade=false] - If true, animate the transition
   */
  renderRecommendations(rec, crossfade) {
    const doEl = document.getElementById('rec-do-text');
    const watchEl = document.getElementById('rec-watch-text');
    const pivotEl = document.getElementById('rec-pivot-text');

    const cards = [
      { el: doEl, text: rec.action || 'Awaiting...' },
      { el: watchEl, text: rec.watch || 'Awaiting...' },
      { el: pivotEl, text: rec.trigger || 'Awaiting...' }
    ];

    if (!crossfade) {
      // Instant update (first render)
      cards.forEach(c => { if (c.el) c.el.textContent = c.text; });
      // Ensure refining-label spans exist for future shimmer use
      this._ensureRefiningLabels();
      return;
    }

    // Crossfade: fade out → swap text → fade in, staggered 50ms per card
    // Also remove shimmer class from each card as its text arrives
    cards.forEach((c, i) => {
      if (!c.el) return;
      setTimeout(() => {
        c.el.classList.add('fading');
        setTimeout(() => {
          c.el.textContent = c.text;
          c.el.classList.remove('fading');
          // Remove refining shimmer from the parent card when new text is set
          const card = c.el.closest('.rec-card');
          if (card) card.classList.remove('refining');
          // Re-ensure refining-label span exists after text replacement
          this._ensureRefiningLabels();
        }, 200); // After fade-out completes
      }, i * 50); // Stagger
    });
  },

  /**
   * Render front-page What-If sliders in Layer 1
   *
   * @param {Array} sensitivityRanked - Sorted sensitivity results from runFullSensitivity
   * @param {Object} prismaState - Full state
   * @param {Set} frontIds - Set of variable IDs to render in main section
   * @param {Array} moreIds - Variable IDs to render in "more" section
   * @param {Object} baselineValues - Map of variableId -> baseline value
   * @param {Set} promotedSliders - Set of AI-promoted variable IDs
   */
  renderFrontPageSliders(sensitivityRanked, prismaState, frontIds, moreIds, baselineValues, promotedSliders) {
    const container = document.getElementById('front-sliders');
    const moreContainer = document.getElementById('front-sliders-more');
    if (!container) return;

    container.textContent = '';
    if (moreContainer) moreContainer.textContent = '';

    const variables = prismaState.variables || [];
    if (!sensitivityRanked || sensitivityRanked.length === 0) {
      const msg = document.createElement('div');
      msg.style.cssText = 'font-size:12px;color:var(--text3);padding:8px 0;';
      msg.textContent = 'All variables are fixed — no sliders to show.';
      container.appendChild(msg);
      return;
    }

    const promoted = promotedSliders || new Set();

    const createSlider = (variableId, targetContainer) => {
      const variable = variables.find(v => v.id === variableId);
      if (!variable) return;

      const baseline = baselineValues ? (baselineValues[variableId] ?? variable.value) : variable.value;
      const isPromoted = promoted.has(variableId);

      const card = document.createElement('div');
      card.className = 'front-slider' + (isPromoted ? ' ai-suggested' : '');
      card.dataset.variableId = variableId;

      // Header: label + value + unit + delta
      const header = document.createElement('div');
      header.className = 'front-slider-header';

      const labelWrap = document.createElement('div');
      labelWrap.className = 'front-slider-label';
      labelWrap.textContent = variable.label || variable.id;
      if (isPromoted) {
        const aiBadge = document.createElement('span');
        aiBadge.className = 'ai-badge';
        aiBadge.textContent = 'AI';
        labelWrap.appendChild(aiBadge);
      }
      header.appendChild(labelWrap);

      const valueWrap = document.createElement('span');
      const valSpan = document.createElement('span');
      valSpan.className = 'front-slider-value';
      valSpan.dataset.variableId = variableId;
      valSpan.textContent = this._formatNumber(variable.value);
      valueWrap.appendChild(valSpan);

      if (variable.unit) {
        const unitSpan = document.createElement('span');
        unitSpan.className = 'front-slider-unit';
        unitSpan.textContent = variable.unit;
        valueWrap.appendChild(unitSpan);
      }

      // Delta badge
      const delta = document.createElement('span');
      delta.className = 'front-slider-delta';
      delta.dataset.variableId = variableId;
      this._updateDeltaBadge(delta, variable.value, baseline);
      valueWrap.appendChild(delta);

      header.appendChild(valueWrap);
      card.appendChild(header);

      // Track wrapper with baseline marker
      const trackWrap = document.createElement('div');
      trackWrap.className = 'front-slider-track-wrap';

      const input = document.createElement('input');
      input.type = 'range';
      input.min = variable.min || 0;
      input.max = variable.max || 100;
      input.step = this._calculateStep(variable);
      input.value = variable.value;  // Set value AFTER step to avoid float-snap issues
      input.dataset.variableId = variableId;

      // Baseline diamond
      const baselinePct = ((baseline - (variable.min || 0)) / ((variable.max || 100) - (variable.min || 0))) * 100;
      const diamond = document.createElement('div');
      diamond.className = 'front-slider-baseline';
      diamond.style.left = 'calc(' + baselinePct + '% - 4px)';
      trackWrap.appendChild(diamond);

      let sliderTimeout = null;
      input.addEventListener('input', (e) => {
        const newVal = parseFloat(e.target.value);
        valSpan.textContent = this._formatNumber(newVal);
        this._updateDeltaBadge(delta, newVal, baseline);

        // Show reset button if any slider differs from baseline
        const resetBtn = document.getElementById('reset-sliders-btn');
        if (resetBtn) resetBtn.classList.remove('hidden');

        clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => {
          if (typeof Dashboard !== 'undefined' && Dashboard.rerunWithSliders) {
            Dashboard.rerunWithSliders(variableId, newVal);
          }
        }, 150);
      });

      trackWrap.appendChild(input);
      card.appendChild(trackWrap);

      // Range labels
      const rangeDiv = document.createElement('div');
      rangeDiv.className = 'front-slider-range';
      const minSpan = document.createElement('span');
      minSpan.textContent = this._formatNumber(variable.min || 0);
      rangeDiv.appendChild(minSpan);
      const maxSpan = document.createElement('span');
      maxSpan.textContent = this._formatNumber(variable.max || 100);
      rangeDiv.appendChild(maxSpan);
      card.appendChild(rangeDiv);

      targetContainer.appendChild(card);
    };

    // Render front sliders
    for (const id of frontIds) {
      createSlider(id, container);
    }

    // Render "more" sliders
    if (moreIds && moreIds.length > 0 && moreContainer) {
      for (const id of moreIds) {
        createSlider(id, moreContainer);
      }
      // Show the "more variables" button
      const moreBtn = document.getElementById('more-vars-btn');
      if (moreBtn) moreBtn.classList.remove('hidden');
    }
  },

  /**
   * Update delta badges on existing slider DOM (minimal render path)
   * @param {Object} baselineValues - Map of variableId -> baseline value
   * @param {Object} prismaState - Full state
   */
  updateFrontPageSliderDeltas(baselineValues, prismaState) {
    const variables = prismaState.variables || [];
    document.querySelectorAll('.front-slider-delta').forEach(delta => {
      const varId = delta.dataset.variableId;
      const variable = variables.find(v => v.id === varId);
      if (!variable || !baselineValues) return;
      const baseline = baselineValues[varId] ?? variable.value;
      this._updateDeltaBadge(delta, variable.value, baseline);
    });

    // Also update displayed values
    document.querySelectorAll('.front-slider-value').forEach(valSpan => {
      const varId = valSpan.dataset.variableId;
      const variable = variables.find(v => v.id === varId);
      if (variable) valSpan.textContent = this._formatNumber(variable.value);
    });
  },

  /**
   * Update a delta badge element
   */
  _updateDeltaBadge(el, current, baseline) {
    const diff = current - baseline;
    const pct = baseline !== 0 ? ((diff / Math.abs(baseline)) * 100) : 0;

    if (Math.abs(diff) < 0.001) {
      el.className = 'front-slider-delta';
      el.textContent = '';
      return;
    }

    const sign = diff > 0 ? '+' : '';
    el.textContent = this._formatNumber(baseline) + ' \u2192 ' + this._formatNumber(current) + ' (' + sign + pct.toFixed(0) + '%)';
    el.className = 'front-slider-delta visible ' + (diff > 0 ? 'positive' : 'negative');
  },

  // =========================================
  //  LAYER 2 RENDERERS — The Evidence
  // =========================================

  /**
   * Render the outcome range bar (horizontal distribution bar)
   * Shows P10-P90 range with green/red split at zero
   *
   * @param {Object} carloResults - Carlo results for the best scenario
   * @param {Object} prismaState - Full state
   */
  renderRangeBar(carloResults, prismaState) {
    const canvas = document.getElementById('range-bar-canvas');
    const summaryDiv = document.getElementById('range-bar-summary');
    if (!canvas) return;

    const scenarios = prismaState.scenarios || [];
    // Use the first non-"nothing" scenario, fallback to first
    const bestScenario = scenarios.find(s => s.id !== 'nothing' && s.id !== 'do_nothing') || scenarios[0];
    if (!bestScenario) return;

    const data = carloResults[bestScenario.id];
    if (!data || !data.summary) return;

    const s = data.summary;
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    const padding = { left: 10, right: 10 };
    const barY = 10;
    const barH = h - 24;

    // Scale: P10 to P90 range
    const rangeMin = s.p10;
    const rangeMax = s.p90;
    const spread = rangeMax - rangeMin;
    const xScale = (val) => padding.left + ((val - rangeMin) / spread) * (w - padding.left - padding.right);

    // P10-P90 light fill
    const p10X = xScale(s.p10);
    const p90X = xScale(s.p90);
    ctx.fillStyle = '#EEEEE8';
    ctx.beginPath();
    ctx.roundRect(p10X, barY, p90X - p10X, barH, 4);
    ctx.fill();

    // P25-P75 darker fill
    const p25X = xScale(s.p25);
    const p75X = xScale(s.p75);
    ctx.fillStyle = '#D5D5D0';
    ctx.beginPath();
    ctx.roundRect(p25X, barY, p75X - p25X, barH, 4);
    ctx.fill();

    // Green/red overlay at zero line (if zero is within range)
    if (rangeMin < 0 && rangeMax > 0) {
      const zeroX = xScale(0);

      // Red side (left of zero)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fillRect(p10X, barY, zeroX - p10X, barH);

      // Green side (right of zero)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.fillRect(zeroX, barY, p90X - zeroX, barH);

      // Zero line
      ctx.strokeStyle = '#1A1A1A';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(zeroX, barY - 2);
      ctx.lineTo(zeroX, barY + barH + 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // "break even" label
      ctx.fillStyle = '#6B6B6B';
      ctx.font = '10px Geist Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('break even', zeroX, barY + barH + 12);
    }

    // Median marker
    const medX = xScale(s.median);
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(medX, barY - 2);
    ctx.lineTo(medX, barY + barH + 2);
    ctx.stroke();

    // Median label
    ctx.fillStyle = '#1A1A1A';
    ctx.font = 'bold 11px Geist Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this._formatNumber(s.median), medX, barY - 6);

    // Summary text
    if (summaryDiv) {
      const unit = prismaState.outcome?.unit || '';
      summaryDiv.textContent = `Most likely range: ${this._formatNumber(s.p25)} to ${this._formatNumber(s.p75)} ${unit}. Median: ${this._formatNumber(s.median)} ${unit}`;
    }
  },

  /**
   * Render scenario comparison bars (one per scenario, stacked vertically)
   *
   * @param {Object} carloResults - Carlo results for all scenarios
   * @param {Object} nassimResults - Nassim classifications
   * @param {Object} prismaState - Full state
   */
  renderScenarioComparison(carloResults, nassimResults, prismaState) {
    const container = document.getElementById('scenario-comparison');
    if (!container) return;

    // Keep the h3, clear the rest
    const h3 = container.querySelector('h3');
    container.textContent = '';
    if (h3) container.appendChild(h3);

    const scenarios = prismaState.scenarios || [];
    if (scenarios.length === 0) return;

    // Find global range across all scenarios
    let globalMin = Infinity, globalMax = -Infinity;
    for (const sc of scenarios) {
      const d = carloResults[sc.id];
      if (d && d.summary) {
        globalMin = Math.min(globalMin, d.summary.p10);
        globalMax = Math.max(globalMax, d.summary.p90);
      }
    }

    // Find best/worst by median
    let bestId = null, worstId = null, bestMed = -Infinity, worstMed = Infinity;
    for (const sc of scenarios) {
      const d = carloResults[sc.id];
      if (d && d.summary) {
        if (d.summary.median > bestMed) { bestMed = d.summary.median; bestId = sc.id; }
        if (d.summary.median < worstMed) { worstMed = d.summary.median; worstId = sc.id; }
      }
    }

    for (const scenario of scenarios) {
      const data = carloResults[scenario.id];
      if (!data || !data.summary) continue;

      const score = Nassim.computeDecisionScore
        ? Nassim.computeDecisionScore(nassimResults[scenario.id])
        : Math.round(data.summary.percentPositive);

      const row = document.createElement('div');
      row.className = 'scenario-row';
      if (scenario.id === bestId) row.classList.add('best');
      if (scenario.id === worstId && scenarios.length > 1) row.classList.add('worst');

      // Label
      const label = document.createElement('div');
      label.className = 'scenario-label-badge';
      label.textContent = scenario.label;
      row.appendChild(label);

      // Mini range bar
      const barWrap = document.createElement('div');
      barWrap.className = 'scenario-bar-wrap';
      const miniCanvas = document.createElement('canvas');
      barWrap.appendChild(miniCanvas);
      row.appendChild(barWrap);

      // Score badge
      const badge = document.createElement('div');
      badge.className = 'scenario-score-badge';
      badge.textContent = score;
      badge.style.color = this._scoreColor(score);
      badge.style.background = this._scoreColor(score) + '15';
      row.appendChild(badge);

      container.appendChild(row);

      // Draw mini range bar after append (so dimensions are available)
      requestAnimationFrame(() => {
        this._drawMiniRangeBar(miniCanvas, data.summary, globalMin, globalMax, scenario.color);
      });
    }
  },

  /**
   * Draw a mini range bar on a small canvas
   */
  _drawMiniRangeBar(canvas, summary, globalMin, globalMax, color) {
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;

    const spread = globalMax - globalMin;
    const xScale = (val) => ((val - globalMin) / spread) * w;

    // P10-P90 light fill
    const p10X = xScale(summary.p10);
    const p90X = xScale(summary.p90);
    ctx.fillStyle = (color || '#2563EB') + '20';
    ctx.beginPath();
    ctx.roundRect(p10X, 4, Math.max(1, p90X - p10X), h - 8, 3);
    ctx.fill();

    // P25-P75 darker fill
    const p25X = xScale(summary.p25);
    const p75X = xScale(summary.p75);
    ctx.fillStyle = (color || '#2563EB') + '50';
    ctx.beginPath();
    ctx.roundRect(p25X, 4, Math.max(1, p75X - p25X), h - 8, 3);
    ctx.fill();

    // Median line
    const medX = xScale(summary.median);
    ctx.strokeStyle = color || '#2563EB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(medX, 2);
    ctx.lineTo(medX, h - 2);
    ctx.stroke();

    // Zero line if in range
    if (globalMin < 0 && globalMax > 0) {
      const zeroX = xScale(0);
      ctx.strokeStyle = '#9B9B9B';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(zeroX, 2);
      ctx.lineTo(zeroX, h - 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  /**
   * Render simplified sensitivity bars (CSS bars, top 3 variables)
   *
   * @param {Array} sensitivityResults - From Nassim.runSensitivity()
   * @param {Object} prismaState - Full state
   */
  renderSimplifiedSensitivity(sensitivityResults, prismaState) {
    const container = document.getElementById('sensitivity-list');
    if (!container) return;

    container.textContent = '';

    if (!sensitivityResults || sensitivityResults.length === 0) return;

    const topVars = sensitivityResults.slice(0, 3);
    const maxSwing = topVars[0].totalSwing;
    const unit = prismaState.outcome?.unit || '';

    topVars.forEach((v, i) => {
      const item = document.createElement('div');
      item.className = 'sensitivity-item';

      // Header: name + impact
      const header = document.createElement('div');
      header.className = 'sensitivity-header';

      const name = document.createElement('span');
      name.className = 'sensitivity-name';
      name.textContent = v.variableLabel;
      header.appendChild(name);

      const impact = document.createElement('span');
      impact.className = 'sensitivity-impact';
      impact.textContent = `${this._formatNumber(v.totalSwing)} ${unit} swing`;
      header.appendChild(impact);

      item.appendChild(header);

      // Bar
      const track = document.createElement('div');
      track.className = 'sensitivity-bar-track';
      const fill = document.createElement('div');
      fill.className = 'sensitivity-bar-fill';
      fill.style.width = '0%';
      track.appendChild(fill);
      item.appendChild(track);

      // Animate bar width
      const pct = maxSwing > 0 ? (v.totalSwing / maxSwing) * 100 : 0;
      requestAnimationFrame(() => {
        setTimeout(() => { fill.style.width = pct + '%'; }, 50 + i * 100);
      });

      // Description
      const desc = document.createElement('div');
      desc.className = 'sensitivity-description';
      desc.textContent = `${v.variableLabel} — This is your ${i === 0 ? 'biggest lever' : i === 1 ? 'second biggest lever' : 'third most important factor'}.`;
      item.appendChild(desc);

      container.appendChild(item);
    });
  },

  // =========================================
  //  LAYER 3 RENDERERS — The Engine Room
  // =========================================

  /**
   * Render Monte Carlo simulation as dots on canvas (Layer 3)
   */
  renderMonteCarlo(carloResults, prismaState) {
    const canvas = document.getElementById('monte-carlo-canvas');
    if (!canvas) return;

    const statsDiv = document.getElementById('scenario-stats');
    const { ctx, width, height } = this._sizeCanvas(canvas);
    ctx.clearRect(0, 0, width, height);

    const scenarios = prismaState.scenarios || [];
    if (scenarios.length === 0) return;

    const bandPadding = 12; // gap between scenario bands
    const bandHeight = height / scenarios.length;
    const padding = { top: 20, bottom: 10, left: 120, right: 20 };

    let globalMin = Infinity, globalMax = -Infinity;
    for (const scenario of scenarios) {
      const data = carloResults[scenario.id];
      if (!data || !data.outcomes) continue;
      const sorted = [...data.outcomes].sort((a, b) => a - b);
      globalMin = Math.min(globalMin, sorted[0]);
      globalMax = Math.max(globalMax, sorted[sorted.length - 1]);
    }

    const range = globalMax - globalMin;
    globalMin -= range * 0.1;
    globalMax += range * 0.1;

    const xScale = (value) => padding.left + ((value - globalMin) / (globalMax - globalMin)) * (width - padding.left - padding.right);

    // Zero line
    const zeroX = xScale(0);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(zeroX, 0);
    ctx.lineTo(zeroX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    const allDots = [];
    const staticElements = { zeroX, scenarios: [], width, height, padding };

    const gaussianRandom = () => {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    scenarios.forEach((scenario, scenarioIndex) => {
      const data = carloResults[scenario.id];
      if (!data || !data.outcomes) return;

      const outcomes = data.outcomes;
      const summary = data.summary;
      const scenarioColor = scenario.color || '#2563EB';

      const bandTop = scenarioIndex * bandHeight + padding.top + bandPadding;
      const bandBottom = (scenarioIndex + 1) * bandHeight - padding.bottom - bandPadding;
      const bandMid = (bandTop + bandBottom) / 2;
      const bandSpan = (bandBottom - bandTop) / 2; // half-height for clamping

      const staticScenario = { label: scenario.label, color: scenarioColor, bandTop, bandBottom, bandMid };

      // Label
      ctx.fillStyle = '#1A1A1A';
      ctx.font = '12px Geist, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(scenario.label, padding.left - 10, bandMid);

      if (summary) {
        const p10X = xScale(summary.p10);
        const p90X = xScale(summary.p90);
        ctx.fillStyle = scenarioColor + '25';
        ctx.fillRect(p10X, bandTop, p90X - p10X, bandBottom - bandTop);

        const medianX = xScale(summary.median);
        ctx.strokeStyle = scenarioColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(medianX, bandTop);
        ctx.lineTo(medianX, bandBottom);
        ctx.stroke();

        staticScenario.p10X = p10X;
        staticScenario.p90X = p90X;
        staticScenario.medianX = medianX;
      }

      staticElements.scenarios.push(staticScenario);

      outcomes.forEach(outcome => {
        const x = xScale(outcome);
        // Tighter Gaussian spread (0.12) and clamp to band boundaries
        const rawY = bandMid + gaussianRandom() * bandSpan * 0.35;
        const y = Math.max(bandTop + 2, Math.min(bandBottom - 2, rawY));
        allDots.push({ x, y, color: scenarioColor });
      });
    });

    this._animateDots(ctx, allDots, staticElements);

    if (statsDiv) {
      statsDiv.textContent = '';
      scenarios.forEach(scenario => {
        const data = carloResults[scenario.id];
        if (!data || !data.summary) return;

        const s = data.summary;
        const statText = document.createElement('div');
        statText.style.fontFamily = 'Geist Mono, monospace';
        statText.style.fontSize = '11px';
        statText.style.color = '#6B6B6B';
        statText.style.marginBottom = '4px';

        const percentPositive = s.percentPositive.toFixed(0);
        // Green for >50%, amber for 25-50%, red for <25%
        const percentColor = percentPositive >= 50 ? '#10B981' : percentPositive >= 25 ? '#F59E0B' : '#EF4444';

        const label = document.createTextNode(`${scenario.label}: median ${this._formatNumber(s.median)} | `);
        const percentSpan = document.createElement('span');
        percentSpan.textContent = `${percentPositive}% positive`;
        percentSpan.style.color = percentColor;
        percentSpan.style.fontSize = '13px';
        percentSpan.style.fontWeight = '700';
        const rangeText = document.createTextNode(` | range: ${this._formatNumber(s.min)} to ${this._formatNumber(s.max)}`);

        statText.appendChild(label);
        statText.appendChild(percentSpan);
        statText.appendChild(rangeText);
        statsDiv.appendChild(statText);
      });
    }
  },

  /**
   * Animate Monte Carlo dots with waterfall effect
   */
  _animateDots(ctx, dots, staticElements) {
    const startTime = performance.now();
    const totalDuration = 1500;
    const batchSize = 100;
    const batchDelay = 50;

    const animatedDots = dots.map((dot, index) => {
      const batchIndex = Math.floor(index / batchSize);
      // Start from the center X position of the canvas (not top) — dots expand outward from center
      return { ...dot, targetX: dot.x, targetY: dot.y, startX: dot.x, startY: dot.y, startAlpha: 0, releaseTime: batchIndex * batchDelay, index };
    });

    const easeOutQuad = (t) => t * (2 - t);

    const redrawStaticElements = () => {
      const { zeroX, scenarios, width, height, padding } = staticElements;

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(zeroX, 0);
      ctx.lineTo(zeroX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      scenarios.forEach((scenario, idx) => {
        // Draw separator line between bands
        if (idx > 0) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padding.left, scenario.bandTop - 6);
          ctx.lineTo(width - padding.right, scenario.bandTop - 6);
          ctx.stroke();
        }

        ctx.fillStyle = '#1A1A1A';
        ctx.font = '12px Geist, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(scenario.label, padding.left - 10, scenario.bandMid);

        if (scenario.p10X && scenario.p90X) {
          ctx.fillStyle = scenario.color + '25';
          ctx.fillRect(scenario.p10X, scenario.bandTop, scenario.p90X - scenario.p10X, scenario.bandBottom - scenario.bandTop);
        }

        if (scenario.medianX) {
          ctx.strokeStyle = scenario.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(scenario.medianX, scenario.bandTop);
          ctx.lineTo(scenario.medianX, scenario.bandBottom);
          ctx.stroke();
        }
      });
    };

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      redrawStaticElements();

      animatedDots.forEach(dot => {
        const dotElapsed = elapsed - dot.releaseTime;
        if (dotElapsed < 0) return;

        const progress = Math.min(dotElapsed / 400, 1);
        const easedAlpha = easeOutQuad(progress) * 0.55;

        ctx.globalAlpha = easedAlpha;
        ctx.fillStyle = dot.color;
        ctx.beginPath();
        ctx.arc(dot.targetX, dot.targetY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      if (elapsed < totalDuration) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  },

  /**
   * Render causal graph in Layer 3
   */
  renderCausalGraph(prismaState) {
    const container = document.getElementById('causal-graph-container');
    if (!container) return;

    container.textContent = '';
    container.style.position = 'relative';

    const variables = prismaState.variables || [];
    const edges = prismaState.edges || [];
    const feedbackLoops = prismaState.feedbackLoops || [];

    if (variables.length === 0) {
      container.textContent = 'No variables defined';
      return;
    }

    const inputs = [], intermediates = [], outputs = [];
    const hasIncoming = new Set();
    const hasOutgoing = new Set();
    edges.forEach(edge => { hasIncoming.add(edge.to); hasOutgoing.add(edge.from); });

    variables.forEach(v => {
      if (v.isInput || !hasIncoming.has(v.id)) { inputs.push(v); }
      else if (!hasOutgoing.has(v.id) || v.id === prismaState.outcome?.id) { outputs.push(v); }
      else { intermediates.push(v); }
    });

    // SVG for edges
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '0';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('refX', '7');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L0,6 L7,3 z');
    path.setAttribute('fill', '#2563EB');
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);
    container.appendChild(svg);

    const createGroup = (title, vars) => {
      const group = document.createElement('div');
      group.style.display = 'flex';
      group.style.alignItems = 'center';
      group.style.gap = '6px';
      group.style.zIndex = '1';
      group.style.flexShrink = '0';

      const groupLabel = document.createElement('span');
      groupLabel.textContent = title;
      groupLabel.style.fontFamily = 'var(--font-mono)';
      groupLabel.style.fontSize = '9px';
      groupLabel.style.color = '#9B9B9B';
      groupLabel.style.textTransform = 'uppercase';
      groupLabel.style.letterSpacing = '0.1em';
      groupLabel.style.marginRight = '4px';
      group.appendChild(groupLabel);

      vars.forEach(v => {
        const node = document.createElement('div');
        node.className = 'causal-node';
        node.dataset.varId = v.id;
        node.textContent = v.label;
        group.appendChild(node);
      });

      return group;
    };

    const createArrow = () => {
      const arrow = document.createElement('span');
      arrow.textContent = '\u2192';
      arrow.style.color = '#2563EB';
      arrow.style.fontSize = '16px';
      arrow.style.flexShrink = '0';
      arrow.style.margin = '0 4px';
      return arrow;
    };

    container.appendChild(createGroup('INPUTS', inputs));
    container.appendChild(createArrow());
    if (intermediates.length > 0) {
      container.appendChild(createGroup('PROCESS', intermediates));
      container.appendChild(createArrow());
    }
    container.appendChild(createGroup('OUTCOMES', outputs));

    setTimeout(() => { this._drawCausalEdges(svg, edges, feedbackLoops, container); }, 100);

    if (feedbackLoops.length > 0) {
      const callout = document.createElement('span');
      callout.style.marginLeft = '12px';
      callout.style.padding = '3px 8px';
      callout.style.background = 'rgba(239,68,68,0.08)';
      callout.style.border = '1px solid rgba(239,68,68,0.2)';
      callout.style.borderRadius = '4px';
      callout.style.fontFamily = 'var(--font-mono)';
      callout.style.fontSize = '10px';
      callout.style.color = '#EF4444';
      callout.style.flexShrink = '0';
      callout.textContent = feedbackLoops[0].label || 'Feedback loop';
      container.appendChild(callout);
    }
  },

  /**
   * Draw SVG edges for causal graph
   */
  _drawCausalEdges(svg, edges, feedbackLoops, container) {
    const containerRect = container.getBoundingClientRect();

    const nodePositions = {};
    container.querySelectorAll('.causal-node').forEach(node => {
      const varId = node.dataset.varId;
      const rect = node.getBoundingClientRect();
      nodePositions[varId] = {
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2
      };
    });

    const feedbackEdges = new Set();
    feedbackLoops.forEach(loop => {
      if (loop.path) {
        for (let i = 0; i < loop.path.length - 1; i++) {
          feedbackEdges.add(`${loop.path[i]}->${loop.path[i + 1]}`);
        }
      }
    });

    edges.forEach(edge => {
      const fromPos = nodePositions[edge.from];
      const toPos = nodePositions[edge.to];
      if (!fromPos || !toPos) return;

      const isPositive = edge.effect === 'positive';
      const isFeedback = feedbackEdges.has(`${edge.from}->${edge.to}`);
      const strength = edge.strength || 0.5;
      const color = isPositive ? '#10B981' : '#EF4444';
      const strokeWidth = 1 + strength * 2;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fromPos.x);
      line.setAttribute('y1', fromPos.y);
      line.setAttribute('x2', toPos.x);
      line.setAttribute('y2', toPos.y);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', strokeWidth);
      line.setAttribute('marker-end', 'url(#arrowhead)');
      line.setAttribute('opacity', '0.5');

      if (isFeedback) {
        line.style.animation = 'edgePulse 2s infinite';
        line.setAttribute('stroke-dasharray', '4 4');
      }

      svg.appendChild(line);
    });

    if (!document.getElementById('edge-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'edge-pulse-style';
      style.textContent = `@keyframes edgePulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.6; } }`;
      document.head.appendChild(style);
    }
  },

  /**
   * Render Taleb classification badges in Layer 3
   */
  renderTalebBadges(nassimResults, prismaState) {
    const container = document.getElementById('taleb-badges');
    if (!container) return;

    container.textContent = '';
    const scenarios = prismaState.scenarios || [];

    scenarios.forEach(scenario => {
      const classification = nassimResults[scenario.id];
      if (!classification) return;

      const badge = document.createElement('div');
      const classLower = classification.classification.toLowerCase();
      badge.className = `taleb-badge-l3 ${classLower}`;

      const labelDiv = document.createElement('div');
      labelDiv.style.fontFamily = 'var(--font-mono)';
      labelDiv.style.fontSize = '10px';
      labelDiv.style.color = '#9B9B9B';
      labelDiv.style.marginBottom = '4px';
      labelDiv.textContent = scenario.label;
      badge.appendChild(labelDiv);

      const word = document.createElement('div');
      word.className = `classification-word ${classLower}`;
      // Plain language labels instead of Taleb jargon
      const plainLabels = { 'FRAGILE': 'HIGH RISK', 'ROBUST': 'RESILIENT', 'ANTIFRAGILE': 'THRIVES IN CHAOS' };
      word.textContent = plainLabels[classification.classification] || classification.classification;
      badge.appendChild(word);

      const pct = document.createElement('div');
      pct.style.fontFamily = 'var(--font-mono)';
      pct.style.fontSize = '13px';
      pct.style.color = '#6B6B6B';
      pct.style.margin = '4px 0';
      pct.textContent = `${classification.percentPositive.toFixed(0)}% of futures positive`;
      badge.appendChild(pct);

      const reasoning = document.createElement('div');
      reasoning.className = 'classification-reasoning';
      reasoning.textContent = classification.reasoning;
      badge.appendChild(reasoning);

      container.appendChild(badge);
    });
  },

  /**
   * Render tornado chart (Plotly) in Layer 3
   */
  renderTornado(sensitivityResults, prismaState) {
    const container = document.getElementById('tornado-chart');
    if (!container) return;

    if (!sensitivityResults || sensitivityResults.length === 0) {
      container.textContent = 'No sensitivity data available';
      return;
    }

    const topVars = sensitivityResults.slice(0, 6);
    const labels = topVars.map(v => v.variableLabel).reverse();
    const impactLow = topVars.map(v => v.impactLow).reverse();
    const impactHigh = topVars.map(v => v.impactHigh).reverse();

    const trace1 = {
      x: impactLow, y: labels, type: 'bar', orientation: 'h', name: 'At Min',
      marker: { color: 'rgba(37,99,235,0.3)' }
    };
    const trace2 = {
      x: impactHigh, y: labels, type: 'bar', orientation: 'h', name: 'At Max',
      marker: { color: 'rgba(37,99,235,0.7)' }
    };

    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Geist Mono, monospace', color: '#6B6B6B', size: 11 },
      xaxis: { title: 'Impact on outcome', gridcolor: '#E5E5E0', zerolinecolor: '#D5D5D0', color: '#6B6B6B' },
      yaxis: { color: '#1A1A1A', automargin: true },
      margin: { t: 20, b: 30, l: 80, r: 20 },
      showlegend: false,
      barmode: 'overlay'
    };

    Plotly.newPlot(container, [trace1, trace2], layout, { responsive: true, displayModeBar: false });
  },

  /**
   * Render Markov timeline (Plotly) in Layer 3
   */
  renderMarkovTimeline(timelines, prismaState) {
    const container = document.getElementById('markov-timeline');
    if (!container) return;

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

      traces.push({
        x: months, y: medians, type: 'scatter', mode: 'lines', name: scenario.label,
        line: { color: scenario.color || '#2563EB', width: 3 }
      });

      traces.push({
        x: [...months, ...months.reverse()],
        y: [...p75s, ...p25s.reverse()],
        type: 'scatter', mode: 'lines', fill: 'toself',
        fillcolor: (scenario.color || '#2563EB') + '20',
        line: { width: 0 }, showlegend: false, hoverinfo: 'skip'
      });
    });

    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Geist Mono, monospace', color: '#6B6B6B', size: 10 },
      xaxis: { title: 'Month', gridcolor: '#E5E5E0', color: '#6B6B6B' },
      yaxis: { title: 'Outcome', gridcolor: '#E5E5E0', zerolinecolor: '#D5D5D0', color: '#6B6B6B' },
      margin: { t: 20, b: 30, l: 80, r: 20 },
      legend: { font: { family: 'Geist Sans, sans-serif', color: '#1A1A1A', size: 10 }, bgcolor: 'transparent' },
      shapes: [{ type: 'line', x0: 0, x1: 0, y0: 0, y1: 1, yref: 'paper', line: { color: '#D5D5D0', width: 1, dash: 'dot' } }],
      annotations: [{ x: 0, y: 1.05, yref: 'paper', xref: 'x', text: 'NOW', showarrow: false, font: { color: '#6B6B6B', size: 11, family: 'Geist Mono, monospace' } }]
    };

    Plotly.newPlot(container, traces, layout, { responsive: true, displayModeBar: false });
  },

  /**
   * Render interactive sliders in Layer 3
   */
  renderSliders(prismaState) {
    const container = document.getElementById('sliders-container');
    if (!container) return;

    container.textContent = '';

    const variables = prismaState.variables || [];
    const inputVars = variables.filter(v => v.isInput);
    if (inputVars.length === 0) return;

    inputVars.forEach(variable => {
      const sliderGroup = document.createElement('div');
      sliderGroup.className = 'slider-group';

      const sliderHeader = document.createElement('div');
      sliderHeader.className = 'slider-header';

      const label = document.createElement('label');
      label.textContent = variable.label || variable.id;
      label.style.fontFamily = 'Geist Sans, sans-serif';
      label.style.fontSize = '12px';
      label.style.fontWeight = '600';
      label.style.color = '#1A1A1A';
      sliderHeader.appendChild(label);

      const valueSpan = document.createElement('span');
      valueSpan.className = 'slider-value';
      valueSpan.textContent = this._formatNumber(variable.value);
      sliderHeader.appendChild(valueSpan);

      if (variable.unit) {
        const unitSpan = document.createElement('span');
        unitSpan.textContent = variable.unit;
        unitSpan.style.fontFamily = 'Geist Mono, monospace';
        unitSpan.style.fontSize = '11px';
        unitSpan.style.color = '#6B6B6B';
        unitSpan.style.marginLeft = '4px';
        sliderHeader.appendChild(unitSpan);
      }

      sliderGroup.appendChild(sliderHeader);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = variable.min || 0;
      input.max = variable.max || 100;
      input.step = this._calculateStep(variable);
      input.value = variable.value || 50;  // Set value AFTER step to avoid float-snap

      let sliderTimeout = null;
      input.addEventListener('input', (e) => {
        valueSpan.textContent = this._formatNumber(parseFloat(e.target.value));
        clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => {
          if (typeof Dashboard !== 'undefined' && Dashboard.rerunWithSliders) {
            Dashboard.rerunWithSliders(variable.id, parseFloat(e.target.value));
          }
        }, 150);
      });

      sliderGroup.appendChild(input);

      const sliderRange = document.createElement('div');
      sliderRange.className = 'slider-range';

      const minSpan = document.createElement('span');
      minSpan.textContent = this._formatNumber(variable.min || 0);
      sliderRange.appendChild(minSpan);

      const maxSpan = document.createElement('span');
      maxSpan.textContent = this._formatNumber(variable.max || 100);
      sliderRange.appendChild(maxSpan);

      sliderGroup.appendChild(sliderRange);
      container.appendChild(sliderGroup);
    });
  },

  /**
   * Render raw statistics table in Layer 3
   */
  renderRawStats(carloResults, prismaState) {
    const container = document.getElementById('raw-stats-container');
    if (!container) return;

    container.textContent = '';
    const scenarios = prismaState.scenarios || [];

    const table = document.createElement('table');
    table.className = 'engine-raw-stats';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Scenario', 'Median', 'Mean', 'P10', 'P25', 'P75', 'P90', 'Min', 'Max', '% Positive'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    scenarios.forEach(scenario => {
      const data = carloResults[scenario.id];
      if (!data || !data.summary) return;

      const s = data.summary;
      const row = document.createElement('tr');
      [
        scenario.label,
        this._formatNumber(s.median),
        this._formatNumber(s.mean),
        this._formatNumber(s.p10),
        this._formatNumber(s.p25),
        this._formatNumber(s.p75),
        this._formatNumber(s.p90),
        this._formatNumber(s.min),
        this._formatNumber(s.max),
        s.percentPositive.toFixed(1) + '%'
      ].forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  },

  // =========================================
  //  HELPERS
  // =========================================

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

  _calculateStep(variable) {
    const range = (variable.max || 100) - (variable.min || 0);
    if (range <= 10) return 0.1;
    if (range <= 100) return 1;
    if (range <= 1000) return 10;
    return 100;
  },

  _formatNumber(num) {
    if (Math.abs(num) >= 1000) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
  },

  /**
   * Map a score (0-100) to its verdict color
   */
  _scoreColor(score) {
    if (score >= 60) return '#10B981';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  }
};
