# PRISMA

**See what happens before it happens.**

Prisma is a decision intelligence engine. Upload your data, and it finds what you're missing — patterns, risks, opportunities. Then simulate every path forward with 1,000 Monte Carlo futures, so you decide with evidence, not instinct.

> Built for the **"Built with Opus 4.6" Claude Code Hackathon**, Feb 2026.

**Live:** [prisma-decision-engine.vercel.app](https://prisma-decision-engine.vercel.app)

---

## What Prisma Does

```
Upload CSV  →  Instant dashboards  →  Spot challenges  →  Simulate decisions  →  Act with confidence
```

### 1. Upload your data
Drop any CSV — sales, ops, finance, logistics, growth. Any industry, any size (up to 10MB).

### 2. Get dashboards that make your data valuable
Prisma instantly generates KPI cards, charts, and insight cards. No configuration. It reads your columns, detects patterns, finds anomalies, and surfaces what matters — all in one tool call.

### 3. Spot challenges and simulate them
Each insight card comes with a "Simulate this" button. Click it, and **Carlo** (our Monte Carlo engine) runs 1,000 randomized futures across multiple scenarios. You see probability distributions, sensitivity analysis, and a clear recommendation: what to do, what to watch, when to change your mind.

Simulations stack as independent cards — run as many as you want, compare results side by side.

### 4. Talk to your data
Ask anything in the chat. "Show me details about late deliveries." "Break down costs by zone." "What's driving the Tuesday spike?" Prisma creates a new analysis card with charts and KPIs focused on your question — your original dashboard stays untouched. Analysis cards stack and are collapsible, so you can compare findings across multiple questions.

### 5. Never stare at a blank screen
While Prisma analyzes your CSV, you see a dot-flow animation and rotating facts about the simulation engine — no dead loading states.

### 6. Resilient simulations
If a simulation fails (missing data, formula mismatch, engine error), you get an amber diagnostic card with a specific error message and a **Retry** button. Retry automatically enriches your prompt with exact column names from your data for better results. Behind the scenes, Prisma validates simulation data server-side and retries with Claude before it even reaches the browser.

## Architecture

```
public/
├── index.html               Landing page (dot grid, particle buttons, cascade animation)
├── app.html                  Main app (chat 25% + dashboard 75%)
├── css/styles.css            Design system (warm rose palette)
├── js/
│   ├── dashboard.js          Orchestrator — phase routing, simulation history
│   ├── chart-renderer.js     KPI cards, charts, insights, Futures Cascade
│   ├── visualizations.js     Plotly charts (histogram, tornado, score circle)
│   ├── carlo.js              Monte Carlo engine (1,000 iterations, client-side)
│   ├── nassim.js             Sensitivity analysis (2-phase async)
│   ├── chat.js               Chat UI + API communication
│   ├── csv-analyzer.js       Stats extraction, trend detection, anomaly detection
│   ├── button-particles.js   CTA particle system
│   └── demo-data.js          Sample dataset
├── fonts/                    Geist Pixel Triangle
└── data/                     Sample CSVs

api/
├── _auth.js                  Password gate helper
├── gate.js                   Gate status + password validation
├── chat.js                   Vercel serverless (Anthropic proxy, formula validation, simulation validation+retry)
├── system-prompt.js          Prisma's behavior instructions
└── refine-recommendations.js Recommendation refinement endpoint
```

**Stack:** Vanilla JS — no frameworks. Plotly.js for charts, PapaParse for CSV. Vercel serverless functions proxy to Anthropic's API. ~12K lines.

## How It Works Under the Hood

1. **CSV upload** → PapaParse parses client-side → CSVAnalyzer extracts distributions, trends, breakpoints → stats sent to Claude
2. **Claude responds** with a `tool_call` containing chart specs, KPI definitions, and insight cards → client renders everything from raw data
3. **Simulation trigger** → Claude generates variables, scenarios, outcome formula → server validates required fields (retries if missing) → Carlo runs 1,000 iterations per scenario in the browser → sensitivity analysis ranks variables by impact → success card or diagnostic card with retry
4. **Conversational follow-ups** → Claude re-calls `data_overview` with new chart/KPI specs → analysis card stacks below original dashboard (original preserved) → simulation cards stay untouched

All simulation math runs **client-side**. No data leaves your machine except column statistics sent to Claude for reasoning.

## Quick Start

```bash
# Clone
git clone https://github.com/MuzafferH/prisma-decision-engine.git
cd prisma-decision-engine

# Install
npm install

# Set API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Run (includes serverless functions)
npx vercel dev
```

Or deploy directly:

```bash
npx vercel --prod
```

Set `ANTHROPIC_API_KEY` in your Vercel project environment variables.

## Sample Data

Two realistic datasets in `/public/data/` with embedded patterns for testing:

- **delivery_logs_q4.csv** (5,023 rows) — Delivery operations with Tuesday/Thursday cost spikes, driver burnout breakpoints, zone patterns
- **driver_performance.csv** (600 rows) — Daily driver metrics with progressive decline, overtime correlations, sick day triggers

## Landing Page

Four interactive visual systems built with Canvas API:

- **Dot grid** — Full-viewport canvas, mouse-reactive rose dots (scale + color shift within proximity)
- **Particle CTA buttons** — Brownian motion dots that converge on hover with connection web
- **Cascade animation** — 3 canvases showing scatter → histogram → bell curve (~8.5s loop)
- **Proof count-up** — Orbiting dot with easeOutExpo counter animation

All animations respect `prefers-reduced-motion`.

## Built with Claude Code

This project was built entirely with Claude Code (Opus 4.6) during the hackathon:

1. **Architecture** — Described the vision, Claude designed the engine separation and file structure
2. **Monte Carlo engine** — Carlo built as standalone client-side JS module
3. **Data-first pivot** — Switched from question-first to upload-first flow mid-hackathon
4. **Dashboard system** — Iterative development of charts, KPIs, insights, simulation cards
5. **Landing page** — "Design battle" approach: parallel agents with different philosophies, best of each
6. **Bug fixes** — Parallel agent code review to trace simulation failures across 6 files simultaneously
7. **Reliability** — 5-layer defensive fix for simulation cards: null guards, stopReason mismatch fix, server-side validation+retry, prompt enrichment with CSV stats, diagnostic failed cards with retry

## License

MIT
