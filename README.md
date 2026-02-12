# PRISMA

**See what happens before it happens.**

Prisma is a decision intelligence engine. Upload your data, and it finds what you're missing — then simulates every path forward so you decide with evidence, not instinct.

> Built for the **"Built with Opus 4.6" Claude Code Hackathon**, Feb 2026.

**Live demo:** [prisma-decision-engine.vercel.app](https://prisma-decision-engine.vercel.app)

---

## How It Works

```
Your CSV  →  Prisma finds patterns  →  You ask "what if?"  →  1,000 simulated futures  →  You decide
```

1. **Upload** — Drop a CSV (sales, ops, finance, logistics — any industry)
2. **Explore** — Prisma generates KPIs, charts, and insight cards automatically
3. **Simulate** — Click "Simulate this" on any insight, or ask your own what-if question
4. **Decide** — See probability distributions, sensitivity analysis, and a clear recommendation

All simulation runs **client-side** in the browser. No data leaves your machine except the column stats sent to Claude for analysis.

## The Crew

Three engines, each named for what they do:

| Engine | Role | What It Does |
|--------|------|--------------|
| **Carlo** | The Simulator | Runs 1,000 Monte Carlo futures per scenario. Shows probability distributions. |
| **Nassim** | The Judge | Classifies decisions as fragile/robust/antifragile using the Taleb framework. Runs sensitivity analysis to find which variables matter most. |
| **Markov** | The Oracle | Models state transitions over time using Markov chains. |

## Architecture

```
public/
├── index.html               Landing page (interactive dot grid, particle buttons, cascade animation)
├── app.html                  Main app (chat panel 25% + dashboard 75%)
├── css/styles.css            Design system (warm palette, rose borders)
├── js/
│   ├── dashboard.js          Orchestrator — routes phases, manages simulation history
│   ├── visualizations.js     Plotly charts (tornado, histogram, sliders, causal graph)
│   ├── chart-renderer.js     Data overview charts, KPI cards, Futures Cascade
│   ├── carlo.js              Monte Carlo engine (1,000 iterations, client-side)
│   ├── nassim.js             Taleb classifier + sensitivity analysis
│   ├── markov.js             State transition modeling
│   ├── chat.js               Chat UI + API communication
│   ├── csv-analyzer.js       Distribution extraction, trend detection, anomaly detection
│   ├── button-particles.js   CTA button particle system
│   └── demo-data.js          Sample dataset
├── fonts/                    Geist Pixel Triangle
└── data/                     Sample CSVs (delivery logs, driver performance)

api/
├── chat.js                   Vercel serverless (Anthropic API proxy, formula validation)
├── system-prompt.js          Prisma's behavior instructions
└── refine-recommendations.js Dynamic recommendation refinement
```

**Stack:** Vanilla JS, no frameworks. Plotly.js for charts, PapaParse for CSV parsing. Vercel serverless functions proxy to Anthropic's API. ~12K lines of code.

## Quick Start

### Local development

```bash
# Clone
git clone https://github.com/MuzafferH/prisma-decision-engine.git
cd prisma-decision-engine

# Install API dependencies
npm install

# Set your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Run locally with Vercel dev (includes serverless functions)
npx vercel dev

# Or serve static files only (no API — demo mode only)
npx serve public
```

### Deploy to Vercel

```bash
npx vercel --prod
```

Set `ANTHROPIC_API_KEY` in your Vercel project environment variables.

## Key Features

### Data Overview
Upload a CSV and Prisma immediately generates:
- **KPI cards** with trend indicators
- **4-6 charts** (time series, distributions, comparisons)
- **Insight cards** with "Simulate this" buttons
- **Sortable data table** with pagination

### Simulation History
Simulations stack as independent cards (newest on top, max 10). Each card includes:
- Probability histogram with Futures Cascade animation
- Sensitivity tornado diagram
- Summary statistics (expected outcome, P10/P90, % positive)
- Recommendation triptych (Do this / Watch this / Change if...)

### Interactive Sliders
After simulation, the top sensitivity variables appear as front-page sliders. Drag them to:
- Re-run 1,000 simulations in real-time
- Watch the verdict score morph
- See dynamic recommendations update (template-based, then AI-refined after 2s idle)

### Landing Page
Four interactive visual systems:
- **Dot grid background** — Canvas with mouse-reactive rose dots
- **Particle CTA buttons** — Brownian motion dots that converge on hover
- **Cascade animation** — Scatter → histogram → bell curve loop
- **Proof count-up** — Orbiting dot with easeOutExpo counter

All animations respect `prefers-reduced-motion`.

## Design System

| Element | Value |
|---------|-------|
| Background | `#F5F0F0` warm off-white |
| Text | `#14141C` near-black |
| Accent | `#2563EB` blue |
| Rose palette | `rgba(245,192,192,0.85)` base, deeper variants for emphasis |
| CTA buttons | `#1A1520` near-black with rose particle dots |
| Fonts | Geist Pixel Triangle (brand), Geist Sans (body), Geist Mono (data) |

## Sample Data

Two realistic datasets in `/public/data/` with embedded patterns for testing:

- **delivery_logs_q4.csv** (5,023 rows) — Delivery operations with Tuesday/Thursday cost spikes, driver burnout breakpoints, zone-based patterns
- **driver_performance.csv** (600 rows) — Daily driver metrics with progressive decline patterns, overtime correlations, sick day triggers

## How Claude Code Built This

This project was built entirely with Claude Code (Opus 4.6) during the hackathon. The conversation-driven workflow:

1. **Architecture** — Described the vision, Claude designed the file structure and engine separation
2. **Engines** — Built Carlo, Nassim, and Markov as standalone JS modules
3. **Dashboard** — Iterative development of the 3-layer progressive disclosure UI
4. **Data mode** — Pivoted from question-first to upload-first flow mid-hackathon
5. **Landing page** — "Design battle" approach: spawned parallel agents with different philosophies, picked the best from each
6. **Bug fixes** — Used parallel agent code review to trace simulation failures across 6 files

## License

MIT
