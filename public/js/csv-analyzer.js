/**
 * CSV-ANALYZER.JS — Client-side CSV Analysis Utility
 *
 * Analyzes parsed CSV data (from PapaParse) to extract:
 * - Basic statistics (mean, median, min, max, std, percentiles)
 * - Weekday patterns (if date column exists)
 * - Trends (comparing first half vs second half)
 * - Breakpoints (where rolling mean shifts significantly)
 *
 * Used when user uploads CSV files to enhance Prisma's Tier 2 analysis
 */

const CSVAnalyzer = {
  /**
   * Analyze parsed CSV data (from PapaParse)
   * @param {Array} data - array of row objects from Papa.parse
   * @param {string} filename - original filename for context
   * @returns {Object} analysis results
   */
  analyze(data, filename) {
    if (!data || data.length === 0) {
      return {
        filename,
        error: 'No data to analyze',
        rowCount: 0
      };
    }

    const columns = Object.keys(data[0] || {});
    const numericColumns = columns.filter(col => {
      const sample = data.slice(0, 10).map(row => row[col]);
      return sample.some(v => !isNaN(parseFloat(v)) && v !== '' && v !== null);
    });

    const analysis = {
      filename,
      rowCount: data.length,
      columns: columns,
      numericColumns: numericColumns,
      stats: {}
    };

    // For each numeric column, compute stats
    for (const col of numericColumns) {
      const values = data
        .map(row => parseFloat(row[col]))
        .filter(v => !isNaN(v) && v !== null);

      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);

      analysis.stats[col] = {
        count: values.length,
        mean: mean(values),
        median: median(sorted),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        std: std(values),
        p25: percentile(sorted, 0.25),
        p75: percentile(sorted, 0.75)
      };
    }

    // Detect date column and compute by-weekday stats
    const dateCol = columns.find(c =>
      c.toLowerCase().includes('date') ||
      c.toLowerCase().includes('day') ||
      c.toLowerCase().includes('time')
    );

    if (dateCol) {
      analysis.dateColumn = dateCol;
      analysis.byWeekday = computeByWeekday(data, dateCol, numericColumns);
    }

    // Detect trends (simple: compare first half vs second half)
    if (data.length >= 20) {
      analysis.trends = detectTrends(data, numericColumns);
    }

    // Detect breakpoints (simple: find where rolling mean shifts)
    if (data.length >= 30) {
      analysis.breakpoints = detectBreakpoints(data, numericColumns, dateCol);
    }

    return analysis;
  },

  /**
   * Format analysis as a readable string for sending to Prisma
   * @param {Object} analysis - analysis object from analyze()
   * @returns {string} formatted text
   */
  formatForChat(analysis) {
    if (analysis.error) {
      return `❌ ${analysis.filename}: ${analysis.error}`;
    }

    let text = `📊 Uploaded: ${analysis.filename} (${analysis.rowCount} rows)\n\n`;

    // Key statistics
    if (Object.keys(analysis.stats).length > 0) {
      text += `Key statistics:\n`;
      for (const [col, stats] of Object.entries(analysis.stats)) {
        text += `• ${col}: mean=${stats.mean.toFixed(2)}, median=${stats.median.toFixed(2)}, range=[${stats.min.toFixed(2)}, ${stats.max.toFixed(2)}]\n`;
      }
      text += `\n`;
    } else {
      text += `No numeric columns found for statistical analysis.\n\n`;
    }

    // Weekday patterns
    if (analysis.byWeekday) {
      text += `Weekday patterns detected:\n`;
      for (const [col, weekdayStats] of Object.entries(analysis.byWeekday)) {
        const days = Object.keys(weekdayStats);
        if (days.length > 0) {
          const values = days.map(d => weekdayStats[d]);
          const minDay = days[values.indexOf(Math.min(...values))];
          const maxDay = days[values.indexOf(Math.max(...values))];
          const variance = (Math.max(...values) - Math.min(...values)) / mean(values) * 100;

          if (variance > 15) {
            text += `• ${col}: ${maxDay} is ${variance.toFixed(0)}% higher than ${minDay}\n`;
          }
        }
      }
      text += `\n`;
    }

    // Trends
    if (analysis.trends && analysis.trends.length > 0) {
      text += `Trends detected:\n`;
      for (const t of analysis.trends) {
        const direction = t.direction === 'up' ? '↑' : '↓';
        text += `• ${t.column}: ${direction} ${t.direction} trend (${Math.abs(t.magnitude).toFixed(1)}% change)\n`;
      }
      text += `\n`;
    }

    // Breakpoints
    if (analysis.breakpoints && analysis.breakpoints.length > 0) {
      text += `Breakpoints detected:\n`;
      for (const bp of analysis.breakpoints) {
        const direction = bp.afterMean > bp.beforeMean ? 'increased' : 'decreased';
        const change = Math.abs((bp.afterMean - bp.beforeMean) / bp.beforeMean * 100);
        text += `• ${bp.column}: ${direction} around row ${bp.position} (${change.toFixed(1)}% shift)\n`;
      }
      text += `\n`;
    }

    text += `What would you like me to analyze from this data?`;

    return text;
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate mean (average)
 */
function mean(arr) {
  if (arr.length === 0) return 0;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

/**
 * Calculate median (assumes array is already sorted)
 */
function median(sortedArr) {
  if (sortedArr.length === 0) return 0;
  const mid = Math.floor(sortedArr.length / 2);
  if (sortedArr.length % 2 === 0) {
    return (sortedArr[mid - 1] + sortedArr[mid]) / 2;
  }
  return sortedArr[mid];
}

/**
 * Calculate standard deviation
 */
function std(arr) {
  if (arr.length === 0) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map(v => Math.pow(v - avg, 2));
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate percentile (assumes array is already sorted)
 * @param {Array} sortedArr - sorted array of numbers
 * @param {number} p - percentile (0-1)
 */
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const index = p * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sortedArr[lower];
  }

  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

/**
 * Compute statistics grouped by day of week
 * @param {Array} data - parsed CSV data
 * @param {string} dateCol - column name containing dates
 * @param {Array} numericCols - list of numeric column names
 * @returns {Object} weekday stats for each numeric column
 */
function computeByWeekday(data, dateCol, numericCols) {
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byWeekday = {};

  for (const col of numericCols) {
    const grouped = {};

    for (const row of data) {
      const dateStr = row[dateCol];
      const value = parseFloat(row[col]);

      if (!dateStr || isNaN(value)) continue;

      // Try to parse date
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;

      const dayOfWeek = date.getDay();
      const dayName = weekdayNames[dayOfWeek];

      if (!grouped[dayName]) {
        grouped[dayName] = [];
      }
      grouped[dayName].push(value);
    }

    // Compute mean for each weekday
    const weekdayMeans = {};
    for (const [day, values] of Object.entries(grouped)) {
      if (values.length > 0) {
        weekdayMeans[day] = mean(values);
      }
    }

    if (Object.keys(weekdayMeans).length > 0) {
      byWeekday[col] = weekdayMeans;
    }
  }

  return Object.keys(byWeekday).length > 0 ? byWeekday : null;
}

/**
 * Detect trends by comparing first half vs second half
 * @param {Array} data - parsed CSV data
 * @param {Array} numericCols - list of numeric column names
 * @returns {Array} trend objects
 */
function detectTrends(data, numericCols) {
  const trends = [];
  const midpoint = Math.floor(data.length / 2);

  for (const col of numericCols) {
    const firstHalf = data.slice(0, midpoint)
      .map(row => parseFloat(row[col]))
      .filter(v => !isNaN(v));

    const secondHalf = data.slice(midpoint)
      .map(row => parseFloat(row[col]))
      .filter(v => !isNaN(v));

    if (firstHalf.length === 0 || secondHalf.length === 0) continue;

    const firstMean = mean(firstHalf);
    const secondMean = mean(secondHalf);
    const change = (secondMean - firstMean) / firstMean;

    // Flag if change is > 10%
    if (Math.abs(change) > 0.10) {
      trends.push({
        column: col,
        direction: change > 0 ? 'up' : 'down',
        magnitude: change * 100,
        firstHalfMean: firstMean,
        secondHalfMean: secondMean
      });
    }
  }

  return trends;
}

/**
 * Detect breakpoints using sliding window mean comparison
 * @param {Array} data - parsed CSV data
 * @param {Array} numericCols - list of numeric column names
 * @param {string} dateCol - optional date column for better positioning
 * @returns {Array} breakpoint objects
 */
function detectBreakpoints(data, numericCols, dateCol) {
  const breakpoints = [];
  const windowSize = Math.max(5, Math.floor(data.length * 0.1)); // 10% of data or min 5

  for (const col of numericCols) {
    const values = data.map(row => parseFloat(row[col]));

    // Compute rolling mean
    const rollingMeans = [];
    for (let i = windowSize; i < values.length - windowSize; i++) {
      const window = values.slice(i - windowSize, i + windowSize);
      const validWindow = window.filter(v => !isNaN(v));
      if (validWindow.length > 0) {
        rollingMeans.push({
          index: i,
          mean: mean(validWindow)
        });
      }
    }

    // Find largest shift
    let maxShift = 0;
    let maxShiftIndex = -1;

    for (let i = 1; i < rollingMeans.length; i++) {
      const shift = Math.abs(rollingMeans[i].mean - rollingMeans[i - 1].mean);
      if (shift > maxShift) {
        maxShift = shift;
        maxShiftIndex = rollingMeans[i].index;
      }
    }

    // Calculate before/after means
    if (maxShiftIndex > 0) {
      const beforeValues = values.slice(0, maxShiftIndex).filter(v => !isNaN(v));
      const afterValues = values.slice(maxShiftIndex).filter(v => !isNaN(v));

      if (beforeValues.length > 0 && afterValues.length > 0) {
        const beforeMean = mean(beforeValues);
        const afterMean = mean(afterValues);
        const change = Math.abs((afterMean - beforeMean) / beforeMean);

        // Flag if change is > 20%
        if (change > 0.20) {
          const breakpoint = {
            column: col,
            position: maxShiftIndex,
            beforeMean: beforeMean,
            afterMean: afterMean,
            changePercent: change * 100
          };

          // Add date if available
          if (dateCol && data[maxShiftIndex] && data[maxShiftIndex][dateCol]) {
            breakpoint.date = data[maxShiftIndex][dateCol];
          }

          breakpoints.push(breakpoint);
        }
      }
    }
  }

  return breakpoints;
}
