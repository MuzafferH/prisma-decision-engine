/**
 * CHART-RENDERER.JS — Prisma 2.0 Data Overview Renderer
 *
 * Takes chart specs from Claude + raw CSV data, renders:
 * - Summary card, KPI cards (with count-up), Plotly charts, Insight cards, Data table
 *
 * All aggregations computed CLIENT-SIDE from raw data — Claude only provides the SPEC.
 */

// Plotly layout constant matching Prisma design system
const PRISMA_CHART_LAYOUT = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { family: 'Geist Mono, SF Mono, monospace', color: '#9B9B9B', size: 11 },
  xaxis: { gridcolor: '#EEEEE8', linecolor: '#E5E5E0', zerolinecolor: '#D5D5D0', tickfont: { size: 10 } },
  yaxis: { gridcolor: '#EEEEE8', linecolor: '#E5E5E0', zerolinecolor: '#D5D5D0', tickfont: { size: 10 } },
  margin: { t: 8, b: 36, l: 48, r: 16 },
  showlegend: false,
  hoverlabel: {
    bgcolor: '#1A1A1A',
    font: { color: '#FAFAF8', family: 'Geist, sans-serif', size: 12 },
    bordercolor: 'transparent'
  }
};

// Chart color palette
const PRISMA_COLORS = {
  primary: '#2563EB',
  secondary: '#7C3AED',
  positive: '#10B981',
  warning: '#F59E0B',
  negative: '#EF4444',
  neutral: '#6B7280',
  // Multi-series palette (primary at different opacities)
  series: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#7C3AED', '#6B7280']
};

const ChartRenderer = {

  // ==================== MAIN ENTRY ====================

  /**
   * Render the full data overview: summary, KPIs, charts, insights, table
   */
  renderDataOverview(prismaData, csvData, csvAnalysis) {
    if (!prismaData) return;

    if (prismaData.dataSummary) {
      this.renderSummaryCard(prismaData.dataSummary);
    }
    if (prismaData.kpiCards) {
      this.renderKPICards(prismaData.kpiCards);
    }
    if (prismaData.charts && csvData) {
      this.renderCharts(prismaData.charts, csvData);
    }
    if (prismaData.insights) {
      this.renderInsights(prismaData.insights);
    }
    if (csvData) {
      const columns = Object.keys(csvData[0] || {});
      this.renderDataTable(csvData, columns, 25);
    }
  },

  // ==================== SKELETON LOADING ====================

  renderSkeletonLoading() {
    const overview = document.getElementById('data-overview');
    if (!overview) return;

    // Show the overview container
    const dormant = document.getElementById('panel-dormant');
    if (dormant) dormant.style.display = 'none';
    overview.style.display = 'block';

    // Summary skeleton
    const summaryCard = document.getElementById('data-summary-card');
    if (summaryCard) {
      summaryCard.className = 'data-summary-card skeleton-loading';
      summaryCard.textContent = '';
      const bar = document.createElement('div');
      bar.className = 'skeleton-bar';
      bar.style.width = '60%';
      summaryCard.appendChild(bar);
    }

    // KPI skeletons
    const kpiStrip = document.getElementById('kpi-strip');
    if (kpiStrip) {
      kpiStrip.textContent = '';
      for (let i = 0; i < 4; i++) {
        const card = document.createElement('div');
        card.className = 'kpi-card skeleton-loading';
        const valBar = document.createElement('div');
        valBar.className = 'skeleton-bar';
        valBar.style.width = '50%';
        valBar.style.height = '28px';
        const labelBar = document.createElement('div');
        labelBar.className = 'skeleton-bar';
        labelBar.style.width = '80%';
        labelBar.style.height = '12px';
        labelBar.style.marginTop = '8px';
        card.appendChild(valBar);
        card.appendChild(labelBar);
        kpiStrip.appendChild(card);
      }
    }

    // Chart skeletons
    const chartGrid = document.getElementById('chart-grid');
    if (chartGrid) {
      chartGrid.textContent = '';
      for (let i = 0; i < 4; i++) {
        const card = document.createElement('div');
        card.className = 'chart-card skeleton-loading';
        chartGrid.appendChild(card);
      }
    }
  },

  // ==================== SUMMARY CARD ====================

  renderSummaryCard(dataSummary) {
    const container = document.getElementById('data-summary-card');
    if (!container) return;

    container.className = 'data-summary-card';
    container.textContent = '';

    const filename = document.createElement('span');
    filename.className = 'summary-filename';
    filename.textContent = dataSummary.filename || 'data.csv';

    const rowCount = document.createElement('span');
    rowCount.className = 'summary-row-count';
    rowCount.textContent = (dataSummary.rowCount || 0).toLocaleString() + ' rows';

    const dateRange = document.createElement('span');
    dateRange.className = 'summary-date-range';
    dateRange.textContent = dataSummary.dateRange || '';

    const desc = document.createElement('span');
    desc.className = 'summary-description';
    desc.textContent = dataSummary.description || '';

    container.appendChild(filename);
    container.appendChild(rowCount);
    if (dataSummary.dateRange) container.appendChild(dateRange);
    if (dataSummary.description) container.appendChild(desc);
  },

  // ==================== KPI CARDS ====================

  renderKPICards(kpiCards) {
    const container = document.getElementById('kpi-strip');
    if (!container) return;

    container.textContent = '';

    kpiCards.forEach((kpi, index) => {
      const card = document.createElement('div');
      card.className = 'kpi-card';
      card.style.animationDelay = (index * 100) + 'ms';

      // Trend arrow (top-right)
      if (kpi.trend) {
        const trend = document.createElement('span');
        trend.className = 'kpi-trend ' + (kpi.trend === 'up' ? 'negative' : kpi.trend === 'down' ? 'positive' : 'neutral');
        const arrow = kpi.trend === 'up' ? '\u2191' : kpi.trend === 'down' ? '\u2193' : '\u2192';
        trend.textContent = arrow;
        card.appendChild(trend);
      }

      // Value (large number with count-up)
      const value = document.createElement('div');
      value.className = 'kpi-value';
      value.textContent = kpi.value || '—';
      card.appendChild(value);

      // Count-up animation for numeric values
      const numericMatch = String(kpi.value).replace(/[^0-9.]/g, '');
      if (numericMatch && !isNaN(parseFloat(numericMatch))) {
        const targetNum = parseFloat(numericMatch);
        const prefix = String(kpi.value).match(/^[^0-9]*/)?.[0] || '';
        const suffix = String(kpi.value).match(/[^0-9.]*$/)?.[0] || '';
        value.textContent = prefix + '0' + suffix;

        setTimeout(() => {
          this._countUp(value, 0, targetNum, 800, prefix, suffix);
        }, index * 100 + 200);
      }

      // Label
      const label = document.createElement('div');
      label.className = 'kpi-label';
      label.textContent = kpi.label || '';
      card.appendChild(label);

      // Context
      if (kpi.context) {
        const context = document.createElement('div');
        context.className = 'kpi-context';
        context.textContent = kpi.context;
        card.appendChild(context);
      }

      container.appendChild(card);
    });
  },

  /**
   * Count-up animation for KPI values
   */
  _countUp(element, start, end, duration, prefix, suffix) {
    const startTime = performance.now();
    const isInteger = Number.isInteger(end) || end > 100;

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const current = start + (end - start) * easedProgress;

      const formatted = isInteger
        ? Math.round(current).toLocaleString()
        : current.toFixed(current < 10 ? 2 : 1);

      element.textContent = prefix + formatted + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  },

  // ==================== CHARTS ====================

  renderCharts(chartSpecs, csvData) {
    const container = document.getElementById('chart-grid');
    if (!container) return;

    container.textContent = '';
    const columnNames = Object.keys(csvData[0] || {});

    // Stagger chart renders with requestAnimationFrame
    chartSpecs.forEach((spec, index) => {
      const card = document.createElement('div');
      card.className = 'chart-card';
      card.style.opacity = '0';
      card.style.transform = 'translateY(8px)';

      const title = document.createElement('div');
      title.className = 'chart-card-title';
      title.textContent = spec.title || 'Chart';
      card.appendChild(title);

      const plotContainer = document.createElement('div');
      plotContainer.className = 'chart-plot';
      plotContainer.id = 'chart-plot-' + (spec.id || index);
      card.appendChild(plotContainer);

      container.appendChild(card);

      // Stagger render: 150ms apart
      setTimeout(() => {
        const validated = this.validateChartSpec(spec, columnNames);
        if (validated) {
          this.renderChart(validated, csvData, plotContainer);
        }

        // Fade in
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 150);
    });
  },

  /**
   * Validate a chart spec against actual column names.
   * Returns validated spec or null if invalid.
   */
  validateChartSpec(spec, columnNames) {
    const validTypes = ['bar', 'line', 'pie', 'scatter'];
    if (!validTypes.includes(spec.type)) {
      console.warn('[ChartRenderer] Invalid chart type:', spec.type, '— skipping');
      return null;
    }

    // Check x column exists (allow '*' for count)
    if (spec.x !== '*' && !columnNames.includes(spec.x)) {
      console.warn('[ChartRenderer] Unknown x column:', spec.x, '— available:', columnNames.join(', '));
      return null;
    }

    // Check y column exists (allow '*' for count)
    if (spec.y !== '*' && !columnNames.includes(spec.y)) {
      console.warn('[ChartRenderer] Unknown y column:', spec.y, '— available:', columnNames.join(', '));
      return null;
    }

    return spec;
  },

  /**
   * Render a single Plotly chart from spec + raw data
   */
  renderChart(spec, csvData, container) {
    try {
      const { labels, values, groups } = this.aggregate(
        csvData, spec.x, spec.y, spec.aggregation, spec.groupBy
      );

      // Sort if requested
      if (spec.sortOrder && !spec.groupBy) {
        const paired = labels.map((l, i) => ({ label: l, value: values[i] }));
        paired.sort((a, b) => spec.sortOrder === 'desc' ? b.value - a.value : a.value - b.value);
        labels.length = 0;
        values.length = 0;
        paired.forEach(p => { labels.push(p.label); values.push(p.value); });
      }

      const color = spec.color || PRISMA_COLORS.primary;
      let traces;

      if (groups && Object.keys(groups).length > 0) {
        // Grouped chart — multiple traces
        traces = Object.entries(groups).map(([groupName, groupValues], i) => {
          const seriesColor = PRISMA_COLORS.series[i % PRISMA_COLORS.series.length];
          return this._getTrace(spec.type, labels, groupValues, seriesColor, groupName);
        });
      } else {
        traces = [this._getTrace(spec.type, labels, values, color)];
      }

      const layout = {
        ...PRISMA_CHART_LAYOUT,
        showlegend: groups && Object.keys(groups).length > 1,
        legend: { font: { size: 10 }, orientation: 'h', y: -0.15 }
      };

      // Pie charts need different layout
      if (spec.type === 'pie') {
        layout.margin = { t: 8, b: 8, l: 8, r: 8 };
      }

      Plotly.newPlot(container, traces, layout, {
        responsive: true,
        displayModeBar: false
      });

    } catch (err) {
      console.error('[ChartRenderer] Failed to render chart:', spec.title, err);
      container.textContent = 'Chart unavailable';
      container.style.color = '#9B9B9B';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.fontSize = '13px';
    }
  },

  /**
   * Build a Plotly trace object from chart type and data
   */
  _getTrace(type, labels, values, color, name) {
    switch (type) {
      case 'bar':
        return {
          x: labels, y: values, type: 'bar', name: name || '',
          marker: { color: color, borderRadius: 4 }
        };
      case 'line':
        return {
          x: labels, y: values, type: 'scatter', mode: 'lines+markers', name: name || '',
          line: { color: color, width: 2 },
          marker: { color: color, size: 4 }
        };
      case 'scatter':
        return {
          x: labels, y: values, type: labels.length > 1000 ? 'scattergl' : 'scatter',
          mode: 'markers', name: name || '',
          marker: { color: color, size: 5, opacity: 0.7 }
        };
      case 'pie':
        return {
          labels: labels, values: values, type: 'pie', name: name || '',
          marker: { colors: PRISMA_COLORS.series },
          textinfo: 'percent+label',
          textfont: { size: 10 },
          hole: 0.35
        };
      default:
        return { x: labels, y: values, type: 'bar', marker: { color: color } };
    }
  },

  // ==================== AGGREGATION ENGINE ====================

  /**
   * Compute aggregation from raw data.
   * Values are computed CLIENT-SIDE — not from Claude.
   */
  aggregate(data, xCol, yCol, aggregation, groupBy) {
    const groups = {};
    const xGroups = {};

    for (const row of data) {
      const xKey = String(row[xCol] ?? 'Unknown');

      if (!xGroups[xKey]) xGroups[xKey] = [];

      if (yCol === '*') {
        xGroups[xKey].push(1); // count mode
      } else {
        const val = parseFloat(row[yCol]);
        if (!isNaN(val)) xGroups[xKey].push(val);
      }

      // Handle groupBy
      if (groupBy && row[groupBy] !== undefined) {
        const gKey = String(row[groupBy]);
        if (!groups[gKey]) groups[gKey] = {};
        if (!groups[gKey][xKey]) groups[gKey][xKey] = [];
        if (yCol === '*') {
          groups[gKey][xKey].push(1);
        } else {
          const val = parseFloat(row[yCol]);
          if (!isNaN(val)) groups[gKey][xKey].push(val);
        }
      }
    }

    const labels = Object.keys(xGroups);
    const values = labels.map(label => this._applyAggregation(xGroups[label], aggregation));

    // Build grouped values if groupBy is set
    let groupedResult = null;
    if (groupBy && Object.keys(groups).length > 0) {
      groupedResult = {};
      for (const [gKey, gData] of Object.entries(groups)) {
        groupedResult[gKey] = labels.map(label =>
          gData[label] ? this._applyAggregation(gData[label], aggregation) : 0
        );
      }
    }

    return { labels, values, groups: groupedResult };
  },

  _applyAggregation(arr, aggregation) {
    if (!arr || arr.length === 0) return 0;

    switch (aggregation) {
      case 'count': return arr.length;
      case 'sum':   return arr.reduce((a, b) => a + b, 0);
      case 'avg':   return arr.reduce((a, b) => a + b, 0) / arr.length;
      case 'min':   return Math.min(...arr);
      case 'max':   return Math.max(...arr);
      default:      return arr.length;
    }
  },

  // ==================== INSIGHT CARDS ====================

  renderInsights(insights) {
    const container = document.getElementById('insights-section');
    if (!container) return;

    container.textContent = '';

    insights.forEach(insight => {
      const card = document.createElement('div');
      card.className = 'insight-card';
      card.setAttribute('data-type', insight.type || 'pattern');

      // Type badge
      const badge = document.createElement('span');
      badge.className = 'insight-card-badge';
      badge.textContent = (insight.type || 'pattern').toUpperCase();
      card.appendChild(badge);

      // Severity indicator
      if (insight.severity) {
        const severity = document.createElement('span');
        severity.className = 'insight-severity ' + insight.severity;
        severity.textContent = insight.severity.toUpperCase();
        card.appendChild(severity);
      }

      // Title
      const title = document.createElement('div');
      title.className = 'insight-title';
      title.textContent = insight.title || '';
      card.appendChild(title);

      // Description
      const desc = document.createElement('div');
      desc.className = 'insight-description';
      desc.textContent = insight.description || '';
      card.appendChild(desc);

      // Actions row: Simulate this + probability teaser
      if (insight.simulatable && insight.simulationPrompt) {
        const actions = document.createElement('div');
        actions.className = 'insight-actions';

        const simBtn = document.createElement('button');
        simBtn.className = 'simulate-btn';
        simBtn.textContent = 'Simulate this';
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = ' \u2192';
        simBtn.appendChild(arrow);
        simBtn.addEventListener('click', () => {
          // Pulse the card
          card.classList.add('simulating');
          setTimeout(() => card.classList.remove('simulating'), 600);
          // Trigger simulation via chat
          if (typeof Chat !== 'undefined') {
            Chat.triggerSimulation(insight.simulationPrompt);
          }
        });
        actions.appendChild(simBtn);

        // Probability teaser
        if (insight.estimatedProbability) {
          const teaser = document.createElement('span');
          teaser.className = 'probability-teaser';
          const probText = document.createTextNode('Est. ');
          const probValue = document.createElement('span');
          probValue.className = 'prob-value';
          probValue.textContent = insight.estimatedProbability;
          teaser.appendChild(probText);
          teaser.appendChild(probValue);
          teaser.appendChild(document.createTextNode(' positive'));
          actions.appendChild(teaser);
        }

        card.appendChild(actions);
      }

      container.appendChild(card);
    });
  },

  // ==================== DATA TABLE ====================

  _currentPage: 0,
  _sortColumn: null,
  _sortDirection: 'asc',
  _tableData: null,
  _tableColumns: null,
  _pageSize: 25,

  renderDataTable(csvData, columns, pageSize) {
    const container = document.getElementById('data-table-section');
    if (!container) return;

    this._tableData = csvData;
    this._tableColumns = columns;
    this._pageSize = pageSize || 25;
    this._currentPage = 0;

    container.textContent = '';

    // Toggle button
    const toggle = document.createElement('button');
    toggle.className = 'data-table-toggle';
    toggle.textContent = 'Show raw data (' + csvData.length.toLocaleString() + ' rows)';
    let tableVisible = false;

    const tableWrap = document.createElement('div');
    tableWrap.className = 'data-table-wrap hidden';

    toggle.addEventListener('click', () => {
      tableVisible = !tableVisible;
      tableWrap.classList.toggle('hidden', !tableVisible);
      toggle.textContent = tableVisible
        ? 'Hide raw data'
        : 'Show raw data (' + csvData.length.toLocaleString() + ' rows)';
    });

    container.appendChild(toggle);

    // Table element
    const table = document.createElement('table');
    table.className = 'data-table';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col;
      th.addEventListener('click', () => {
        if (this._sortColumn === col) {
          this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this._sortColumn = col;
          this._sortDirection = 'asc';
        }
        this._renderTablePage(table);
      });
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    tbody.id = 'data-table-body';
    table.appendChild(tbody);

    tableWrap.appendChild(table);

    // Pagination
    const pagination = document.createElement('div');
    pagination.className = 'data-table-pagination';
    pagination.id = 'data-table-pagination';
    tableWrap.appendChild(pagination);

    container.appendChild(tableWrap);

    this._renderTablePage(table);
  },

  _renderTablePage(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    let data = [...this._tableData];

    // Sort
    if (this._sortColumn) {
      data.sort((a, b) => {
        const aVal = a[this._sortColumn];
        const bVal = b[this._sortColumn];
        const numA = parseFloat(aVal);
        const numB = parseFloat(bVal);

        if (!isNaN(numA) && !isNaN(numB)) {
          return this._sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        const strA = String(aVal || '');
        const strB = String(bVal || '');
        return this._sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    // Paginate
    const start = this._currentPage * this._pageSize;
    const pageData = data.slice(start, start + this._pageSize);

    tbody.textContent = '';
    pageData.forEach(row => {
      const tr = document.createElement('tr');
      this._tableColumns.forEach(col => {
        const td = document.createElement('td');
        const val = row[col];
        td.textContent = val !== null && val !== undefined ? String(val) : '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // Update pagination
    const pagination = document.getElementById('data-table-pagination');
    if (pagination) {
      const totalPages = Math.ceil(data.length / this._pageSize);
      pagination.textContent = '';

      const info = document.createElement('span');
      info.className = 'pagination-info';
      info.textContent = 'Page ' + (this._currentPage + 1) + ' of ' + totalPages;
      pagination.appendChild(info);

      if (this._currentPage > 0) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '\u2190 Prev';
        prevBtn.addEventListener('click', () => { this._currentPage--; this._renderTablePage(table); });
        pagination.appendChild(prevBtn);
      }

      if (this._currentPage < totalPages - 1) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = 'Next \u2192';
        nextBtn.addEventListener('click', () => { this._currentPage++; this._renderTablePage(table); });
        pagination.appendChild(nextBtn);
      }
    }
  }
};
