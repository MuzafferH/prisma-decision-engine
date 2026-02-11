# Prisma v0 REVISED Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Get a running v0 of Prisma — user describes a decision in Claude Code → Prisma asks follow-ups → generates an interactive dark-mode HTML dashboard with Monte Carlo simulation, causal graph, Taleb classification, sensitivity analysis, scenario comparison, and Markov time evolution.

**Architecture (REVISED):** Hybrid template approach. We build a complete dashboard template (HTML/JS/CSS) with all engines and visualization code. Opus 4.6's job is to generate ONLY the `PRISMA_DATA` JSON object from conversation. The template reads this data and renders everything. This means: dashboard quality is deterministic (we control it), Opus does less work (just structured data), debugging is easy (inspect the JSON).

**Tech Stack:** Vanilla JavaScript (engines + interactivity), Canvas API (visualizations), Plotly.js via CDN (charts), Python + pandas (Tier 2 data processing), HTML/CSS (dark mode cinematic dashboard)

---

## Architecture Diagram

```
USER ──→ Claude Code Terminal (conversation)
              │
              ▼
         OPUS 4.6 (guided by CLAUDE.md)
              │
              ├── Asks follow-up questions
              ├── Builds causal model
              ├── Generates PRISMA_DATA JSON object
              │
              ▼
         TEMPLATE INJECTION
              │
              ├── Reads templates/dashboard.html (static, we built it)
              ├── Injects PRISMA_DATA into <!-- PRISMA_DATA_INJECT --> marker
              ├── Writes output/prisma-dashboard.html
              │
              ▼
         BROWSER opens output file
              │
              ├── dashboard.html parses PRISMA_DATA
              ├── Runs Carlo (Monte Carlo) client-side
              ├── Runs Nassim (Taleb + Sensitivity) client-side
              ├── Runs Markov (time evolution) client-side
              ├── Renders all visualizations
              └── User interacts with sliders, explores scenarios
```

---

## PRISMA_DATA JSON Schema (the contract)

This schema is the SINGLE SOURCE OF TRUTH. The dashboard template expects exactly this format. CLAUDE.md instructs Opus 4.6 to produce exactly this format.

```javascript
window.PRISMA_DATA = {
  // === META ===
  meta: {
    title: "Should I hire new drivers?",           // Decision title
    summary: "5-driver delivery company...",        // 1-2 sentence context
    tier: 1,                                        // 1 = conversation, 2 = with data
    generatedAt: "2026-02-11T14:30:00Z"
  },

  // === CAUSAL GRAPH ===
  variables: [
    {
      id: "driver_count",                           // unique identifier
      label: "Number of Drivers",                   // human-readable
      value: 5,                                     // best estimate (center)
      min: 3,                                       // low bound
      max: 8,                                       // high bound
      distribution: "fixed",                        // fixed|normal|uniform|right_skewed|left_skewed
      unit: "drivers",                              // display unit
      isInput: true                                 // true = user can adjust with slider
    },
    {
      id: "daily_deliveries",
      label: "Daily Deliveries",
      value: 80,
      min: 60,
      max: 110,
      distribution: "right_skewed",
      unit: "deliveries/day",
      isInput: true
    }
    // ... more variables
  ],

  edges: [
    {
      from: "driver_count",                         // source variable id
      to: "capacity",                               // target variable id
      effect: "positive",                           // positive|negative
      strength: 0.8,                                // 0-1 strength multiplier
      formula: "capacity = driver_count * 18"       // optional: explicit formula
    },
    {
      from: "overtime_hours",
      to: "driver_reliability",
      effect: "negative",
      strength: 0.6,
      isFeedbackLoop: true                          // flag for visual highlighting
    }
    // ... more edges
  ],

  feedbackLoops: [
    {
      path: ["driver_reliability", "late_deliveries", "overtime_for_others", "burnout", "driver_reliability"],
      type: "negative",                             // negative = death spiral, positive = virtuous cycle
      label: "Death Spiral"
    }
  ],

  // === SCENARIOS ===
  scenarios: [
    {
      id: "hire",
      label: "Hire 2 New Drivers",
      color: "#4caf50",                             // green
      changes: {                                    // variable overrides for this scenario
        "driver_count": { value: 7, min: 6, max: 8 },
        "monthly_cost": { delta: -6400 }
      },
      assumptions: ["New drivers reach 80% productivity in 4 weeks"]
    },
    {
      id: "restructure",
      label: "Restructure Routes",
      color: "#ffa726",                             // amber
      changes: {
        "route_efficiency": { delta: 0.15 }
      },
      assumptions: ["Route optimization yields 15% efficiency gain"]
    },
    {
      id: "nothing",
      label: "Do Nothing",
      color: "#ef5350",                             // red
      changes: {},
      assumptions: ["Current trends continue, no intervention"]
    }
  ],

  // === OUTCOME DEFINITION ===
  outcome: {
    id: "monthly_profit_delta",
    label: "Monthly Profit Change",
    unit: "€/month",
    formula: "revenue - costs - baseline_costs",    // how to calculate from variables
    positiveLabel: "Profit",
    negativeLabel: "Loss"
  },

  // === MARKOV CONFIG (optional, for time evolution) ===
  markov: {
    enabled: true,
    months: 6,
    entities: [
      {
        id: "driver_kai",
        label: "Driver Kai",
        initialState: "unreliable",
        states: ["reliable", "unreliable", "burned_out", "quit"],
        transitions: {
          "reliable":    { "reliable": 0.80, "unreliable": 0.15, "burned_out": 0.04, "quit": 0.01 },
          "unreliable":  { "reliable": 0.20, "unreliable": 0.55, "burned_out": 0.15, "quit": 0.10 },
          "burned_out":  { "reliable": 0.05, "unreliable": 0.10, "burned_out": 0.60, "quit": 0.25 },
          "quit":        { "reliable": 0.00, "unreliable": 0.00, "burned_out": 0.00, "quit": 1.00 }
        }
      }
    ],
    // How Markov states feed back into the main simulation
    stateEffects: {
      "driver_kai.unreliable": { "driver_reliability": -0.15 },
      "driver_kai.burned_out": { "driver_reliability": -0.30 },
      "driver_kai.quit":       { "driver_count": -1 }
    }
  },

  // === RECOMMENDATION (filled by Opus 4.6) ===
  recommendation: {
    action: "Hire 2 new drivers. Fix the route change for Driver A. Talk to Lisa this week.",
    watch: "Tuesday/Thursday delivery times. Lisa's overtime hours.",
    trigger: "If daily orders drop below 65 for 2 consecutive weeks, pause hiring and reassess."
  },

  // === TIER 2 DISCOVERIES (filled after data analysis, empty for Tier 1) ===
  discoveries: [
    // {
    //   title: "Tuesday/Thursday Peak Problem",
    //   description: "The problem is concentrated on Tue/Thu...",
    //   impact: "€1,200/month in avoidable overtime",
    //   type: "pattern"  // pattern|risk|opportunity
    // }
  ]
};
```

---

## Task List (REVISED — 13 tasks)

### Task 1: Initialize Repo & Folder Structure
**Time estimate:** 15 min
**Subagent:** Sonnet

**What:**
- `git init` in project folder
- Create all directories: `engines/`, `templates/`, `data/`, `examples/delivery-company/`, `docs/plans/`, `skills/`, `output/`
- Create `LICENSE` (MIT)
- Create `.gitignore`
- Create minimal `README.md`
- Move existing docs (`PRODUCT_VISION.md`, `SCOPE.md`) into `docs/`
- Initial commit

**Output:** Clean repo with folder structure, ready for code.

---

### Task 2: Define PRISMA_DATA Schema
**Time estimate:** 20 min
**Subagent:** Sonnet

**What:**
- Create `schemas/prisma-data.example.json` — a complete, realistic example of the delivery company scenario using the exact schema above
- This becomes the test fixture for ALL subsequent tasks
- Every engine and every visualization will be tested against this file first

**Output:** One JSON file that is the single source of truth for data format.

---

### Task 3: Build Carlo Engine (`engines/carlo.js`)
**Time estimate:** 45 min
**Subagent:** Sonnet

**What:**
- `sampleFromDistribution(variable)` — supports: fixed, normal (Box-Muller), uniform, right_skewed (log-normal), left_skewed
- `runSingleSimulation(variables, edges, scenarioChanges)` — topological walk through causal graph
- `runCarlo(prismaData, scenarioId, iterations=1000)` — main loop, returns array of outcome values
- `summarizeResults(outcomes)` — median, mean, p10, p25, p75, p90, min, max, percentPositive
- All functions pure, no DOM access, `export` ready

**Test:** Create `test-carlo.html` that loads engine, runs on example schema data, logs results to console. Verify distributions make sense.

**Output:** Working Monte Carlo engine that takes PRISMA_DATA and produces outcome arrays.

---

### Task 4: Build Nassim Engine (`engines/nassim.js`)
**Time estimate:** 30 min
**Subagent:** Sonnet

**What:**
- `classifyTaleb(outcomes, highVarianceOutcomes)` — returns `{classification, confidence, reasoning}`
  - FRAGILE: >40% negative OR worst 10% catastrophic
  - ROBUST: >65% positive AND worst 10% manageable
  - ANTIFRAGILE: performs better under doubled uncertainty
- `runSensitivity(prismaData, runCarloFn, iterations=500)` — varies each input variable, measures impact, returns sorted array
- All functions pure, no DOM access

**Test:** Feed Carlo output into Nassim, verify classification logic with known inputs.

**Output:** Working Taleb classifier + sensitivity analyzer.

---

### Task 5: Build Markov Engine (`engines/markov.js`)
**Time estimate:** 30 min
**Subagent:** Sonnet

**What:**
- `createTransitionMatrix(entityConfig)` — validate rows sum to 1.0
- `walkChain(initialState, transitions, steps)` — single path through states
- `runMarkovMonteCarlo(markovConfig, iterations=1000, months=6)` — 1,000 paths, aggregate state distributions at each month
- `getMarkovTimeline(prismaData, scenarioId)` — run Markov for a scenario, return month-by-month outcomes incorporating state effects

**Test:** Run driver reliability chain, verify sensible state distributions at month 6.

**Output:** Working Markov engine that integrates with Carlo.

---

### Task 6: Dashboard Shell — HTML Structure + Dark Mode CSS
**Time estimate:** 45 min
**Subagent:** Sonnet

**What:**
Create `templates/dashboard.html` with:
- Complete HTML structure (all 8 sections as defined in SCOPE.md)
- Full dark mode CSS inline (background #0a0a0f, accent #4fc3f7, etc.)
- Plotly.js CDN link
- `<!-- PRISMA_DATA_INJECT -->` marker where JSON gets injected
- Section placeholders with IDs for each visualization
- Empty `<script>` blocks where engine code will be concatenated
- Responsive layout with CSS Grid
- Loading state: "Prisma is analyzing..." animation
- Footer: "Prisma — See the full spectrum"

**CSS musts:**
- Glow effects on key elements (box-shadow with color)
- Smooth transitions on interactive elements
- Card-based layout for sections
- Consistent spacing and typography

**Output:** Beautiful dark mode HTML shell that shows structure but no data yet. Can be opened in browser to verify styling.

---

### Task 7: Dashboard — Carlo Integration + Static Dot Plot
**Time estimate:** 45 min
**Subagent:** Sonnet

**What:**
Wire Carlo engine into the dashboard:
- On page load: parse `PRISMA_DATA`, run Carlo for each scenario
- Render Monte Carlo results as a **static scatter plot** on Canvas
  - X-axis: outcome value (profit/loss)
  - Y-axis: slight random jitter
  - Each dot colored by scenario
  - Glowing dots (canvas shadowBlur)
- Display summary stats below: median, p10-p90 range, % positive
- Scenario labels and colors from PRISMA_DATA

**NOT in this task:** Animation (dots just appear at final positions). We add animation as polish later.

**Test:** Load dashboard with example schema data. Verify 3 scenario distributions appear, dots are colored correctly, stats match Carlo output.

**Output:** Dashboard shows Monte Carlo results as glowing static dots.

---

### Task 8: Dashboard — Scenario Comparison + Taleb Badges + Sensitivity
**Time estimate:** 45 min
**Subagent:** Sonnet

**What:**
Add to dashboard:
- **Scenario comparison:** Plotly violin/box plots side-by-side, one per scenario, color-coded. Dark theme Plotly config (paper_bgcolor, plot_bgcolor, font, gridcolor, etc.)
- **Taleb classification badges:** Glowing cards per scenario showing FRAGILE (red) / ROBUST (green) / ANTIFRAGILE (purple) with percentage and reasoning
- **Sensitivity tornado diagram:** Plotly horizontal bar chart, variables sorted by impact, electric blue accent color
- Wire Nassim engine: run classification + sensitivity on page load after Carlo completes

**Test:** Verify Plotly charts render correctly in dark mode. Verify Taleb badges show correct classifications. Verify tornado ranks variables correctly.

**Output:** Dashboard now shows full analysis — dots, comparison charts, Taleb verdicts, sensitivity ranking.

---

### Task 9: Dashboard — Causal Graph Visualization
**Time estimate:** 45 min
**Subagent:** Sonnet

**What:**
Add causal graph renderer to dashboard:
- Canvas-based network diagram
- Nodes: rounded rectangles with variable labels, glowing border
- Edges: curved lines with arrowheads showing direction
- Edge color: green for positive effects, red for negative
- Feedback loops: pulsing red glow animation (requestAnimationFrame)
- Layout: simple layered layout (inputs left, intermediates center, outcomes right) or force-directed
- Reads from `PRISMA_DATA.variables` and `PRISMA_DATA.edges`

**Test:** Verify graph renders with example data. Feedback loops are visually highlighted.

**Output:** Dashboard shows animated causal graph at the top.

---

### Task 10: Dashboard — Interactive Sliders + Markov Timeline
**Time estimate:** 60 min
**Subagent:** Sonnet

**What:**
Add interactivity + Markov:
- **Sliders:** For each variable where `isInput: true`, generate a range slider. On change: update variable value → re-run Carlo → re-run Nassim → update ALL visualizations. Debounce at 100ms.
- **Markov timeline:** Canvas or Plotly line chart. X-axis: months 1-6. Y-axis: outcome metric. One band (p25-p75) per scenario with median line. Color-coded. Shows divergence over time.
- **Recommendation panel:** Three cards at bottom — WHAT TO DO, WHAT TO WATCH, WHEN TO CHANGE YOUR MIND. Content from `PRISMA_DATA.recommendation`.
- **Discoveries panel:** If `PRISMA_DATA.discoveries` is non-empty, show alert-style cards with insights.

**Test:** Drag sliders, verify distributions update. Verify Markov timeline renders. Verify recommendation shows.

**Output:** Fully interactive dashboard. v0 of the visualization is COMPLETE.

---

### Task 11: Create Sample Datasets
**Time estimate:** 30 min
**Subagent:** Sonnet

**What:**
Create `data/generate_sample_data.py` that generates:
- `data/delivery_logs_q4.csv` (~5,000 rows)
- `data/driver_performance.csv` (~600 rows)

With embedded hidden patterns (from SCOPE.md):
- Tue/Thu 30-40% more orders
- D2 degrades after Dec 1
- D4 gradual decline
- D3 (Lisa) high performance but increasing hours/overtime
- D1, D5 stable
- Cross-correlation: when D2/D4 miss, D3's overtime spikes next day

Run the script, verify CSVs.

**Output:** Two realistic CSVs ready for Tier 2 demo.

---

### Task 12: Build Tier 2 Data Processing
**Time estimate:** 45 min
**Subagent:** Sonnet

**What:**
Create `engines/analyze_data.py`:
- Reads CSV files from command line args
- Detects file type (delivery logs vs driver performance) by column headers
- Extracts distributions: mean, std, min, max, percentiles, by day-of-week
- Finds correlations between variables
- Detects breakpoints (rolling mean shift detection)
- Detects trends (linear regression slope)
- Cross-references between files if multiple provided
- Outputs JSON to stdout with:
  - `distributions`: sharper replacements for conversation estimates
  - `discoveries`: array of hidden insights found
  - `confidence`: "narrow" (indicating Tier 2 precision)

CLAUDE.md will instruct Opus to:
1. Run this script on user's files
2. Parse the JSON output
3. Merge distributions into PRISMA_DATA (replacing estimates)
4. Add discoveries to PRISMA_DATA.discoveries
5. Set meta.tier = 2
6. Regenerate the dashboard

**Test:** Run on sample datasets, verify patterns are discovered.

**Output:** Working data analysis pipeline for Tier 2.

---

### Task 13: Wire Claude Code Integration + GitHub Push
**Time estimate:** 45 min
**Subagent:** Sonnet

**What:**
- Create `skills/prisma.md` — Claude Code skill definition
- Refine `CLAUDE.md` with exact instructions for:
  - Reading the template file
  - Generating PRISMA_DATA JSON
  - Injecting data into template via marker replacement
  - Writing output to `output/prisma-dashboard.html`
  - Opening in browser
  - Handling Tier 2 (running Python analysis, merging results)
- Create `examples/delivery-company/prisma-output.html` — hardcoded example that judges can open immediately
- Expand `README.md` with full documentation
- Create GitHub repo and push

**Test the full flow:**
1. Open Claude Code in project folder
2. Describe a decision
3. Verify Prisma asks follow-ups
4. Verify it generates PRISMA_DATA
5. Verify dashboard opens in browser with all visualizations working

**Output:** Complete, working product. Submission-ready.

---

## Build Order & Checkpoints

```
TASK 1:  Init repo                        [15 min]  ──→ CHECKPOINT: repo exists
TASK 2:  PRISMA_DATA schema               [20 min]  ──→ CHECKPOINT: schema defined
TASK 3:  Carlo engine                     [45 min]  ──→ CHECKPOINT: simulation runs
TASK 4:  Nassim engine                    [30 min]  ──→ CHECKPOINT: classification works
TASK 5:  Markov engine                    [30 min]  ──→ CHECKPOINT: time evolution works

TASK 6:  Dashboard shell + CSS            [45 min]  ──→ CHECKPOINT: beautiful empty page
TASK 7:  Dashboard + Carlo dots           [45 min]  ──→ CHECKPOINT: dots on screen!
TASK 8:  Dashboard + Nassim + Plotly      [45 min]  ──→ CHECKPOINT: full analysis visible
TASK 9:  Dashboard + causal graph         [45 min]  ──→ CHECKPOINT: system map visible
TASK 10: Dashboard + sliders + Markov     [60 min]  ──→ CHECKPOINT: fully interactive

TASK 11: Sample datasets                  [30 min]  ──→ CHECKPOINT: CSVs ready
TASK 12: Tier 2 data processing           [45 min]  ──→ CHECKPOINT: data sharpens analysis
TASK 13: Claude Code wiring + GitHub      [45 min]  ──→ CHECKPOINT: v0 DONE

Total estimated: ~8.5 hours of focused work
```

### Day-by-Day Mapping

**Day 2 (today):** Tasks 1-5 — repo, schema, all three engines
**Day 3:** Tasks 6-8 — dashboard shell, Carlo integration, Nassim + Plotly
**Day 4:** Tasks 9-10 — causal graph, sliders, Markov timeline, full interactivity
**Day 5:** Tasks 11-13 — sample data, Tier 2 processing, Claude Code wiring, GitHub push
**Day 6:** Polish, demo recording, submission

### Critical Checkpoint: End of Day 3
"Dashboard opens in browser showing Monte Carlo dots + Taleb badges + sensitivity tornado in dark mode."

If this checkpoint is NOT met, immediately cut: Markov timeline, causal graph animation, interactive sliders. Focus on getting static visualization working.

---

## Scope Cuts (If Behind Schedule)

**Cut FIRST (minimal demo impact):**
1. Animated dot entrance → static dots at final positions
2. Causal graph force-directed layout → simple grid layout
3. Markov timeline animation → static line chart

**Cut SECOND (hurts but survivable):**
4. Interactive sliders → fixed dashboard, no re-run
5. Markov entirely → demo covers Carlo + Nassim only

**NEVER CUT:**
- Carlo Monte Carlo engine
- Nassim Taleb classification
- Dark mode dashboard in browser
- Scenario comparison
- Recommendation panel

---

*"One decision enters. A thousand futures come out. You see the full spectrum. You decide."*
