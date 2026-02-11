# PRISMA — Build Scope

## Final Decisions

| Decision | Answer |
|---|---|
| **Product name** | Prisma |
| **Tagline** | "See the full spectrum." / "1,000 futures. One decision." |
| **Interface** | Claude Code powered (Option D) — conversation in terminal, output opens in browser |
| **Demo scenario** | Last-mile delivery: 5 drivers, 80 deliveries/day, 2 unreliable drivers, costs climbing |
| **Demo flow** | Tier 1 (talking) → Tier 2 (drop 2 CSV files) → analysis sharpens, discovery moment |
| **Entry point** | "What decision are you facing?" — direct, fast, gets to engines quick |
| **Visual style** | Dark mode, cinematic — glowing Monte Carlo dots, smooth animations |
| **Engine code** | JavaScript (runs in browser for instant interactivity) |
| **Data processing** | Python (for Tier 2/3 file parsing only) |
| **Visualization** | HTML + vanilla JS + Canvas API + Plotly.js (CDN) |
| **Sample data** | Pre-built CSVs with realistic delivery data containing hidden insights |
| **License** | MIT |
| **Team size** | Solo (Muz) |
| **Open source** | GitHub public repo |

---

## The Crew

```
PRISMA — The Product
│
├── CARLO    — The Simulator
│              Runs 1,000 futures using Monte Carlo simulation.
│              Named after the casino of chance.
│
├── MARKOV   — The Oracle
│              Sees how states change through time.
│              Walks the chain, step by step, month by month.
│
└── NASSIM   — The Judge
               Classifies decisions as fragile, robust, or antifragile.
               Runs sensitivity analysis to find what matters most.
               Named after Nassim Nicholas Taleb.
```

---

## What's IN v1 (Hackathon)

### Must Have (P1) — The product doesn't work without these

- [ ] **CLAUDE.md / Skills configuration** — Prisma's reasoning instructions for Claude Code. The "brain" that turns Opus 4.6 into a decision scientist.
- [ ] **Conversational intake** — "What decision are you facing?" → smart follow-up questions → extract variables with ranges/uncertainty.
- [ ] **Causal graph generation** — Opus 4.6 identifies how variables connect, finds feedback loops and cascading effects. Output as structured data.
- [ ] **Carlo: Monte Carlo engine (JS)** — For-loop, 1,000 iterations, random sampling from distributions. Runs IN the browser. Instant recalculation on slider changes.
- [ ] **Causal graph visualization** — Animated network showing variable connections and feedback loops. Dark mode, cinematic.
- [ ] **Monte Carlo visualization** — The hero visual: 1,000 dots scattering and forming a distribution. Glowing on dark canvas. The "holy shit" moment.
- [ ] **Scenario comparison** — Side-by-side distributions for 2-3 decision options. Visual clarity on which option has better odds.
- [ ] **Interactive sliders** — What-if exploration. Drag a slider, Monte Carlo re-runs instantly, distribution updates in real-time.

### Should Have (P2) — Trivial to add, massive impact

- [ ] **Nassim: Taleb classification** — Analyze Monte Carlo output shape → classify each option as FRAGILE / ROBUST / ANTIFRAGILE. ~20-30 lines of JS.
- [ ] **Nassim: Sensitivity analysis** — Re-run Monte Carlo varying each input → rank by impact → tornado diagram. ~30 lines of JS.
- [ ] **Tier 2: File upload processing** — Python script that parses CSV/Excel, extracts real distributions, replaces conversation estimates. Claude Code runs this when user drops files.
- [ ] **Discovery moment** — Opus 4.6 analyzes data and finds insights the user didn't ask about. Cross-references between files.
- [ ] **Confidence bands** — Show wide bands for Tier 1 (estimates), narrow bands for Tier 2 (real data). Visual proof that more data = sharper analysis.
- [ ] **Action output** — Every simulation ends with: (1) WHAT TO DO, (2) WHAT TO WATCH, (3) WHEN TO CHANGE YOUR MIND.

### Nice to Have (P3) — Cut if time pressure on day 5

- [ ] **Markov: Time evolution engine (JS)** — State transition matrices, evolve system forward N months. Wraps inside Monte Carlo (each of 1,000 runs includes Markov time steps).
- [ ] **Markov visualization** — Timeline animation showing two scenarios diverging over 6 months. The slow divergence that reveals hidden danger.
- [ ] **Slider for time** — "Show me month 3 vs month 6" — user scrubs through time.

### NOT in v1 (Post-hackathon)

- Tier 3 full folder monitoring
- Integrations (Slack, WhatsApp, Calendar)
- User accounts / persistence across sessions
- Action execution (sending messages, scheduling)
- Mobile app
- Multi-language support
- Bayesian updating from real outcomes
- Optimization (OR solvers)

---

## Demo Script (3 Minutes)

### Setup (0:00 - 0:05)
Screen: Terminal with Claude Code open in the Prisma project folder.

### The Question (0:05 - 0:15)
```
Prisma: "What decision are you facing?"

User: "I run a small delivery company. 5 drivers, about 80
deliveries a day. Two of my drivers are unreliable — late
starts, missed deliveries. Costs are climbing. I don't know
if I should hire replacements, restructure my routes, or
just deal with it."
```

### Smart Follow-ups (0:15 - 0:45)
Prisma asks 3-4 sharp questions:
- What do drivers cost?
- What's your delivery promise to customers?
- How often are the unreliable drivers actually late?
- What happens when they don't show — who covers?

### Causal Graph (0:45 - 1:05)
"Let me map your business."

**Browser opens. Dark mode dashboard appears.**

Animated causal graph builds showing:
- 2 unreliable drivers → late deliveries → customer complaints
- Other drivers covering → overtime → burnout → MORE unreliability
- **NEGATIVE FEEDBACK LOOP** highlighted and pulsing

"You have a death spiral. Every week you wait, this gets worse."

### Carlo Runs (1:05 - 1:30)
"Carlo is running 1,000 futures..."

**The hero animation:** 1,000 glowing dots scatter across the outcome chart. Three clusters form for three options (hire / restructure / do nothing).

Distributions appear:
- Hire: mostly positive, median +€1,800/mo
- Restructure: mixed, median +€400/mo
- Do nothing: mostly negative, median -€2,100/mo

### Nassim's Verdict (1:30 - 1:45)
"Nassim's verdict:"
- Hire → **ROBUST** ✓
- Restructure → borderline
- Do nothing → **FRAGILE** ✗ ← "This is your riskiest option"

Sensitivity: "This decision hinges on hiring speed. Nothing else matters as much."

### The Tier 2 Drop (1:45 - 2:15)
"But I'm working with your estimates. Got any real data?"

User drops two CSV files:
- `delivery_logs_q4.csv`
- `driver_performance.csv`

"Let me look deeper..."

**Distributions narrow. New insights appear:**

"Your data changes the picture:
- The problem is concentrated on Tuesday/Thursday peaks, not every day
- Driver A's issues started 6 weeks ago — correlates with a route change
- Driver B is declining steadily — burnout pattern
- Different root causes → different solutions

DISCOVERY: Your best driver (Lisa) is doing 35% more than average. At this rate, she burns out within 8 weeks. You're about to lose your best person while worrying about your worst."

### Markov's Look Ahead (2:15 - 2:40)
"Markov is looking ahead — 6 months from now..."

**Timeline animation:**

Two paths diverge:
- HIRE path: dip month 1 → recovery month 3 → growth month 5
- DO NOTHING path: stable month 1 → cracks month 3 → crisis month 5

"They look the same in month 1. By month 4 they're in different worlds."

### Close (2:40 - 3:00)
"Your decision:

**HIRE — but hire 2, not 5. Fix the route change for Driver A.
And talk to Lisa this week before you lose her.**

WATCH: Tuesday/Thursday delivery times.
CHANGE YOUR MIND IF: Daily orders drop below 65 for 2 weeks.

Prisma. See the full spectrum."

---

## Sample Datasets to Create

### File 1: `delivery_logs_q4.csv`
~5,000 rows. Columns:
- `date` (Oct-Jan, ~90 days)
- `driver_id` (D1-D5)
- `scheduled_time`
- `actual_departure`
- `delivery_duration_min`
- `zone` (A, B, C)
- `status` (completed, late, failed)
- `day_of_week`

Hidden patterns to embed:
- Tuesday/Thursday have 30-40% more orders
- Driver D2 (the "route change" driver) was normal until Dec 1, then degraded
- Driver D4 is steadily declining week over week (burnout)
- Driver D3 (Lisa) has consistently high performance but increasing hours
- Cost per delivery is €2.80 Mon/Wed but €4.10 Tue/Thu

### File 2: `driver_performance.csv`
~450 rows (5 drivers x ~90 days). Columns:
- `date`
- `driver_id`
- `shift_start_scheduled`
- `shift_start_actual`
- `deliveries_completed`
- `deliveries_assigned`
- `late_deliveries`
- `hours_worked`
- `overtime_hours`
- `sick_day` (boolean)

Hidden patterns to embed:
- D2: clear break point on Dec 1 (route change date)
- D4: gradual decline in deliveries_completed/hour over 3 months
- D3 (Lisa): hours_worked trending up, overtime increasing
- D1 and D5: stable, reliable
- Correlation: when D2 or D4 miss, D3's overtime spikes next day

---

## Tech Architecture

```
┌─────────────────────────────────────────────────┐
│ CLAUDE CODE (Orchestrator)                       │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ CLAUDE.md + Skills                          │ │
│ │ Prisma reasoning framework:                 │ │
│ │ - How to extract decision variables         │ │
│ │ - How to build causal graphs                │ │
│ │ - How to estimate distributions             │ │
│ │ - How to interpret results                  │ │
│ │ - How to find hidden insights               │ │
│ │ - How to present in Taleb framework         │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌──────────────┐  ┌────────────────────────┐    │
│ │ Python       │  │ HTML/JS Generator      │    │
│ │ (Tier 2/3)   │  │ (Opus 4.6 generates    │    │
│ │              │  │  complete visualization │    │
│ │ Parse CSVs   │  │  with engines embedded) │    │
│ │ Extract      │  │                        │    │
│ │ distributions│  │                        │    │
│ │ Find         │  │                        │    │
│ │ correlations │  │                        │    │
│ └──────┬───────┘  └───────────┬────────────┘    │
│        │                      │                 │
│        │   structured data    │   HTML file     │
│        └──────────┬───────────┘                 │
│                   │                             │
└───────────────────┼─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ BROWSER (User-facing)                            │
│                                                 │
│ Self-contained HTML/JS file                     │
│ ├── Canvas API: Monte Carlo dot animation       │
│ ├── Plotly.js (CDN): charts, tornado diagram    │
│ ├── Vanilla JS: all engines                     │
│ │   ├── Carlo: Monte Carlo simulation           │
│ │   ├── Markov: state transitions               │
│ │   ├── Nassim: Taleb classifier + sensitivity  │
│ │   └── Causal graph renderer                   │
│ ├── CSS: dark mode, cinematic styling           │
│ └── Interactive: sliders, toggles, hover states │
│                                                 │
│ NO SERVER. NO API CALLS. RUNS LOCALLY.          │
└─────────────────────────────────────────────────┘
```

---

## GitHub Repo Structure

```
prisma/
├── README.md              ← Vision, demo GIF, how to use
├── CLAUDE.md              ← Prisma reasoning instructions for Claude Code
├── LICENSE                ← MIT
├── skills/
│   └── prisma.md          ← Claude Code skill definition
├── engines/
│   ├── carlo.js            ← Monte Carlo simulation engine
│   ├── markov.js           ← Markov chain engine
│   └── nassim.js           ← Taleb classifier + sensitivity analysis
├── templates/
│   ├── dashboard.html      ← Base visualization template
│   ├── causal-graph.js     ← Causal graph renderer
│   ├── monte-carlo-viz.js  ← Animated dot simulation
│   ├── scenario-compare.js ← Side-by-side distributions
│   ├── tornado.js          ← Sensitivity tornado diagram
│   ├── timeline.js         ← Markov time evolution visual
│   └── styles.css          ← Dark mode cinematic theme
├── data/
│   ├── delivery_logs_q4.csv    ← Sample dataset for demo
│   └── driver_performance.csv  ← Sample dataset for demo
├── examples/
│   └── delivery-company/       ← Example output from demo scenario
│       └── prisma-output.html  ← Generated dashboard
└── docs/
    ├── PRODUCT_VISION.md   ← Full vision document
    └── SCOPE.md            ← This file
```

---

## Demo Recording

- **Tool:** OBS
- **Format:** Screen recording + face cam (webcam bubble in corner)
- **Audio:** Live voiceover while demoing (not scripted narration added later)
- **Presenter:** Muz — ops leader who lived the problem, not a developer reading a script
- **Key moment to nail:** "I ran operations for 60K packages a day. This is the tool I wish I had."
- **Length:** 3 minutes max (hard limit from hackathon rules)
- **Upload:** YouTube or Loom link

---

## Build Priority Order

```
DAY 1-2: The core that makes it work
         CLAUDE.md + Skills + Carlo engine + basic visualization

DAY 3:   The visual wow
         Dark mode styling, Monte Carlo dot animation, causal graph

DAY 4:   Nassim + Tier 2
         Taleb classification, sensitivity, Python data processing,
         sample datasets, discovery moment

DAY 5:   Markov + Polish
         Time evolution (if time allows), interactive sliders,
         smooth transitions, edge cases

DAY 6:   Demo day
         Record 3-minute video, write README, final GitHub cleanup,
         write 100-200 word summary, SUBMIT by 3PM EST
```

---

*"One decision enters. A thousand futures come out. You see the full spectrum. You decide."*
