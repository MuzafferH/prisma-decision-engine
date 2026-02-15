[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code%20(Opus%204.6)-blueviolet?logo=anthropic)](https://claude.ai/claude-code)
[![Anthropic Hackathon 2026](https://img.shields.io/badge/Anthropic-Hackathon%202026-orange)](https://claude.ai/claude-code)
[![Vanilla JS](https://img.shields.io/badge/Vanilla%20JS-~12K%20lines-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://prisma-decision-engine.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

# PRISMA

**See what happens before it happens.**

PRISMA is a decision intelligence engine that puts probabilistic decision support in everyone's hands. Upload any messy spreadsheet — ops, logistics, finance, staffing. PRISMA instantly builds dashboards, surfaces what your data is hiding, and lets you ask "what if?" questions that trigger 1,000 Monte Carlo simulations. You see the probability of every outcome before you commit. No data science degree. No configuration. No code. Just decisions backed by evidence.

> Built for the **"Built with Opus 4.6" Claude Code Hackathon**, Feb 2026.

**Live:** [prisma-decision-engine.vercel.app](https://prisma-decision-engine.vercel.app)
**[Watch the 3-min demo →](https://www.youtube.com/watch?v=wB3x6xUImqQ)**

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

---

## Problem Statements Addressed

**Break the Barriers (Problem Statement 2):**
Probabilistic decision support — Monte Carlo simulation, sensitivity analysis, scenario comparison — has been locked behind data science expertise, Python notebooks, and statistical knowledge. A shift supervisor making a staffing decision at 11pm has never had access to this. PRISMA puts it in their hands: upload a CSV, ask a question in plain language, get probability distributions and a clear recommendation. No statistics degree required. No code. No configuration. And for data scientists who already have the skills — PRISMA compresses a 60-minute notebook workflow into 60 seconds. It doesn't just lower the floor, it raises the ceiling.

**Amplify Human Judgment (Problem Statement 3):**
PRISMA doesn't make decisions. It shows you every possible outcome — with probabilities, risks, and tradeoffs — so YOU make better decisions. The human stays in the loop. The AI provides the analytical firepower that was previously only available to teams with dedicated data scientists. The operator's domain expertise + PRISMA's probabilistic analysis = better decisions than either alone.

---

## How PRISMA Uses Opus 4.6

PRISMA doesn't use Opus 4.6 as a chatbot. It uses it as a reasoning engine across a multi-step analytical pipeline:

**1. Data Understanding (1M token context window)**
When a user uploads a CSV, full dataset statistics — column distributions, trends, breakpoints, anomalies — are fed into Opus 4.6's context. The model reasons about the ACTUAL data (not just metadata) to understand what the dataset represents, what matters, and what's unusual. Most tools send Claude a summary. PRISMA sends the real statistics so Claude can reason about specific patterns.

**2. Structured Tool Calls (not free text)**
Claude responds exclusively via `tool_use` with structured JSON specs for charts, KPI cards, insight cards, and simulation configurations. This isn't "generate some text about the data" — it's "produce a machine-parseable specification that the client renders from raw data." The tool_call architecture means every Claude response is deterministic in structure, even when the analytical reasoning varies.

**3. Multi-Step Reasoning Chain**
Each analysis involves a reasoning chain that requires Opus-level intelligence:
- Data understanding → What does this dataset represent?
- Pattern detection → What's unusual or notable?
- Insight generation → Why does this matter for the business?
- Simulation variable formulation → Which variables should we simulate? What distributions fit?
- Result interpretation → What do the Monte Carlo outputs mean in plain language?
- Recommendation → What should the user actually DO?

This chain requires connecting statistical patterns to business implications to simulation design to actionable advice — exactly the kind of deep, multi-step reasoning Opus 4.6 excels at.

**4. Simulation Parameter Intelligence**
When the user asks "what if?", Opus 4.6 doesn't just pass numbers to the Monte Carlo engine. It REASONS about which variables matter, what probability distributions are appropriate (beta, normal, uniform), what assumptions are reasonable, and what edge cases could break the scenario. It then generates a complete simulation specification that Carlo (the client-side engine) executes. This is the hardest reasoning task in the pipeline — translating a plain-language business question into a statistically rigorous simulation configuration.

**5. Server-Side Validation + Retry Intelligence**
If Claude's simulation spec is incomplete (missing required fields, formula referencing non-existent columns), the server-side validation catches it and retries with enriched context — feeding Claude the exact column names and data types from the CSV. This is an agentic retry loop where Claude self-corrects based on structured feedback, demonstrating the model's ability to recover from errors in multi-step workflows.

**6. Recommendation Refinement**
After Monte Carlo results are computed client-side, the raw outputs (probability distributions, sensitivity rankings) are sent back to Opus 4.6 for interpretation. Claude generates a plain-language recommendation that translates statistical outputs into business advice: "Cut to 37 drivers first, monitor for 4 weeks" instead of "mean=0.72, std=0.14, p(x>0.9)=0.28."

---

## Architecture

```mermaid
flowchart LR
    A[CSV Upload] --> B[PapaParse\nclient-side]
    B --> C[CSV Analyzer\nstats extraction]
    C --> D[Opus 4.6 API\nreasoning]
    D --> E[Tool Call\nJSON spec]
    E --> F[Dashboard\ncharts · KPIs · insights]
    F --> G["User asks\n'What if?'"]
    G --> H[Opus 4.6\nsimulation spec]
    H --> I[Server\nvalidation]
    I --> J[Carlo Engine\n1,000 iterations\nclient-side]
    J --> K[Nassim\nsensitivity analysis]
    K --> L[Opus 4.6\nrecommendation]
    L --> M[Results Card]
```

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

This project was built entirely with Claude Code (Opus 4.6) during the hackathon week:

1. **Architecture design** — Described the vision of "spreadsheet → decisions." Claude Code designed the engine separation: Carlo (Monte Carlo) as standalone modules, dashboard orchestrator, server-side validation layer. Opus 4.6's reasoning depth was critical for getting the architecture right on the first iteration.

2. **Monte Carlo engine (Carlo)** — Built as a standalone client-side JS module. 1,000 iterations per scenario, sampling from beta/normal/uniform distributions as specified by Claude's tool_call output. No external libraries — pure JS random sampling.

3. **Sensitivity analysis (Nassim)** — Named after Nassim Taleb. 2-phase async analysis that identifies which simulation variables have the highest impact on outcomes. Tornado chart visualization.

4. **Data-first pivot** — Mid-hackathon, switched from a question-first flow (user asks question, then uploads data) to upload-first (upload CSV, then explore). This pivot was based on UX reasoning in Claude Code — the model argued that seeing your data first creates context for better questions. It was right.

5. **Landing page design battle** — Used parallel Claude Code agents with different design philosophies competing for the best landing page. Selected the best elements from each — the dot grid, particle buttons, and cascade animation came from different agents.

6. **Reliability engineering** — 5-layer defensive system for simulation cards:
   - Null guards on every simulation data field
   - stopReason mismatch detection and handling
   - Server-side validation of simulation specs before they reach the client
   - Automatic retry with enriched prompts (exact CSV column names injected)
   - Diagnostic cards with retry button when all else fails

   This required parallel agent code review tracing simulation failures across 6 files simultaneously — a use case that leverages Opus 4.6's ability to hold large codebases in context.

7. **~12K lines of vanilla JS** — No React, no frameworks. Intentional choice for hackathon speed and deployment simplicity. Opus 4.6 managed the complexity of a framework-free codebase across 68+ commits without losing coherence.

---

## Who Built This & Why

Built by **Muzaffer Hizel** — scaled operations from warehouse floors to multi-region P&Ls across Big Tech and unicorn startups (Seed through Series C). Launched cities, built teams, designed processes, and made resource decisions daily with spreadsheets and gut instinct.

The gap is real: operators make high-stakes resource decisions daily, but the analytical tools to model outcomes probabilistically are locked behind data science expertise. You either wait 3 weeks for the analytics team or decide on instinct.

PRISMA is the tool I wished I had at 11pm when I was deciding whether to hire two more drivers for Q3. Feed it your ops data, ask "what should I do?", and get probabilistic answers in 60 seconds. No data science degree required.

The long-term vision: AI becomes invisible infrastructure. Users don't know they're using Monte Carlo simulation — they just ask questions and get answers with confidence levels. Like how you don't think about TCP/IP when you open a browser. PRISMA is a step toward making decision science as accessible as search.

## License

MIT
