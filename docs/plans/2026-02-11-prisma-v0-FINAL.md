# Prisma v0 FINAL Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Prisma as a single-page web application. Chat with Prisma directly in the browser, visualizations light up in real-time as conversation progresses, file upload for Tier 2 analysis — all on one screen. Deployed on Vercel.

**Architecture:** Browser-first SPA. Chat panel (left) + visualization grid (right). Vercel serverless function proxies to Anthropic API using **tool_use** for structured output. Engines run client-side. CSV parsing client-side via PapaParse.

**What's Already Built (KEEP AS-IS):**
- ✅ engines/carlo.js — Monte Carlo simulation (namespace: `Carlo`)
- ✅ engines/nassim.js — Taleb classification + sensitivity (namespace: `Nassim`, depends on Carlo)
- ✅ engines/markov.js — State transitions + time evolution (namespace: `Markov`)
- ✅ schemas/prisma-data.example.json — Data schema contract

**Critical Design Decisions (from staff engineer review):**
1. Use **Anthropic tool_use** for structured output — NOT raw JSON in text responses
2. CSV parsing happens **client-side** via PapaParse CDN — NO upload serverless function
3. Causal graph uses **HTML/CSS nodes + SVG edges** — NOT custom Canvas rendering
4. Canvas reserved for **Monte Carlo dots only** (where it matters most)
5. **Hardcoded demo fallback** — known-good data for the demo in case LLM fails
6. **Full last day reserved for polish + demo recording**

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│ BROWSER (Single Page App)                             │
│                                                      │
│ ┌───────────┬───────────────────────────────────┐    │
│ │ CHAT      │  VISUALIZATION GRID               │    │
│ │ PANEL     │  (dormant → lights up per phase)  │    │
│ │           │                                   │    │
│ │ Messages  │  ┌───────────┬───────────────┐    │    │
│ │ Input     │  │ Causal    │ Monte Carlo   │    │    │
│ │ Upload    │  │ Graph     │ 1,000 dots    │    │    │
│ │           │  │ (HTML/SVG)│ (Canvas+glow) │    │    │
│ │           │  ├───────────┼───────────────┤    │    │
│ │           │  │ Taleb     │ Sensitivity   │    │    │
│ │           │  │ Badges    │ Tornado       │    │    │
│ │           │  ├───────────┴───────────────┤    │    │
│ │           │  │ Recommendations           │    │    │
│ │           │  └───────────────────────────┘    │    │
│ └───────────┴───────────────────────────────────┘    │
│                                                      │
│ Script load order (CRITICAL):                        │
│ 1. plotly-2.35.2.min.js (CDN)                        │
│ 2. papaparse.min.js (CDN) — for client-side CSV      │
│ 3. carlo.js                                          │
│ 4. markov.js                                         │
│ 5. nassim.js  ← MUST be after carlo.js               │
│ 6. visualizations.js                                 │
│ 7. dashboard.js                                      │
│ 8. chat.js                                           │
└──────────────────┬───────────────────────────────────┘
                   │ POST /api/chat
                   ▼
┌──────────────────────────────────────────────────────┐
│ VERCEL SERVERLESS FUNCTION (api/chat.js only)         │
│                                                      │
│ Receives: { messages: [...] }                        │
│                                                      │
│ Calls Anthropic API with:                            │
│ ├── System prompt (Prisma instructions)              │
│ ├── User messages (conversation history)             │
│ ├── Tool definition: "update_dashboard"              │
│ │   └── Schema: { phase, prismaData }                │
│ └── model: "claude-opus-4-6-20250918"                │
│                                                      │
│ Returns to browser:                                  │
│ ├── message: model's text response (for chat)        │
│ ├── toolCall: { phase, prismaData } (for dashboard)  │
│ └── OR fallback if no tool call                      │
│                                                      │
│ Security:                                            │
│ ├── API key from process.env.ANTHROPIC_API_KEY       │
│ ├── Input validation: msg < 2000 chars               │
│ ├── History cap: max 30 messages                     │
│ ├── Client-side throttle (no server-side rate limit) │
│ └── Response sanitization before returning           │
│                                                      │
│ Config: vercel.json → maxDuration: 60                │
└──────────────────────────────────────────────────────┘
```

---

## Tool Use Schema (How Opus Returns Structured Data)

Instead of asking Opus to return JSON in text, we define a tool:

```javascript
const tools = [{
  name: "update_dashboard",
  description: "Update the Prisma dashboard with decision analysis data. Call this tool whenever you have new analysis to show — variables, causal relationships, simulation scenarios, or recommendations.",
  input_schema: {
    type: "object",
    properties: {
      phase: {
        type: "string",
        enum: ["gathering", "causal_graph", "simulation", "verdict", "tier2_analysis"],
        description: "Which phase of analysis: gathering (just chatting), causal_graph (show variable connections), simulation (run Monte Carlo), verdict (show Taleb classification + recommendations), tier2_analysis (sharpen with uploaded data)"
      },
      prismaData: {
        type: "object",
        description: "Partial PRISMA_DATA object. Include only the fields relevant to this phase. The dashboard accumulates data across responses."
      }
    },
    required: ["phase"]
  }
}];
```

**The model's text content = chat message. The tool call = dashboard update.**

If the model responds WITHOUT a tool call, it's just a chat message (gathering phase). If it responds WITH a tool call, the dashboard updates.

---

## Conversation → Visualization Pipeline

```
Phase 1: GATHERING
├── Prisma asks questions, user responds
├── No tool calls yet, just conversation
├── Dashboard remains dormant (faint outlines)

Phase 2: CAUSAL_GRAPH (tool call with variables + edges)
├── prismaData includes: variables, edges, feedbackLoops
├── Dashboard: causal graph section lights up
├── Nodes and edges render with feedback loop highlighting

Phase 3: SIMULATION (tool call with scenarios + outcome)
├── prismaData includes: scenarios, outcome definition
├── Dashboard: Monte Carlo section lights up
├── Carlo runs 1,000 iterations client-side
├── Dots animate onto canvas
├── Nassim classifies → Taleb badges light up
├── Sensitivity tornado fills in

Phase 4: VERDICT (tool call with recommendation)
├── prismaData includes: recommendation {action, watch, trigger}
├── Dashboard: recommendation panel lights up
├── All sections now active and interactive
├── Sliders enabled for what-if exploration

Phase 5: TIER2_ANALYSIS (after user uploads CSV)
├── CSV parsed client-side via PapaParse
├── Stats sent to Opus in next chat message
├── prismaData includes: updated distributions, discoveries
├── Dashboard: distributions narrow, discoveries panel appears
```

---

## PrismaData Accumulation (Deep Merge Rules)

The dashboard accumulates prismaData across multiple tool calls:

```javascript
function mergePrismaData(existing, incoming) {
  // Variables: merge by id (update if exists, add if new)
  // Edges: merge by from+to key (update if exists, add if new)
  // Scenarios: merge by id (update if exists, add if new)
  // feedbackLoops: replace entirely
  // recommendation: replace entirely
  // discoveries: concatenate (append new ones)
  // markov: replace entirely
  // outcome: replace entirely
  // meta: shallow merge
}
```

This merge function is CRITICAL and must be tested independently.

---

## File Upload Flow (Client-Side)

```
User clicks 📎 → file picker opens → selects CSV(s)
        │
        ▼
PapaParse parses CSV in browser (instant, no server)
        │
        ▼
Utility function computes:
├── Per-column: mean, std, min, max, p25, p50, p75
├── By day-of-week patterns
├── Trend detection (simple linear regression)
├── Breakpoint detection (rolling mean shift)
        │
        ▼
Stats JSON sent as next chat message:
"I've uploaded delivery data. Here are the key stats: {json}"
        │
        ▼
Opus analyzes stats → returns tool call with:
├── phase: "tier2_analysis"
├── prismaData: { updated distributions, discoveries }
        │
        ▼
Dashboard sharpens: confidence bands narrow, discoveries appear
```

---

## Hardcoded Demo Fallback

File: `public/js/demo-data.js`

Contains a complete, known-good PRISMA_DATA object for the delivery company scenario. If the user presses a hidden key combo (Ctrl+Shift+D) or adds `?demo=true` to the URL, the dashboard loads this data directly — bypassing the LLM entirely.

This is insurance for the live demo recording. If Opus is slow, returns garbage, or the API is down, the demo still works.

---

## Design System

**Based on:** TRIAGE pitch deck (hex.tech inspired) adapted for dark-mode dashboard.

**Fonts (from TRIAGE):**
- `Geist Sans` — UI text, labels, buttons (via Google Fonts)
- `Geist Mono` — data values, numbers, stats, code
- Load via: `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap');`
- Load via: `@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap');`

**Color Palette (dark mode, adapted from TRIAGE + hex.tech dark theme):**
```css
:root {
  /* Backgrounds */
  --bg:     #0a0a0f;     /* near-black base */
  --bg2:    #12121a;     /* card surface */
  --bg3:    #1a1a28;     /* card hover / elevated surface */

  /* Borders + Glass */
  --border:  rgba(79, 195, 247, 0.08);   /* subtle blue-tinted */
  --border2: rgba(79, 195, 247, 0.15);   /* stronger on hover */
  --glass:   rgba(79, 195, 247, 0.03);   /* card glass effect */

  /* Text */
  --text:   #e8e8f0;     /* primary */
  --text2:  #8888a0;     /* secondary / muted */
  --text3:  #555570;     /* tertiary / disabled */

  /* Accent */
  --accent:  #4fc3f7;    /* electric blue — interactive elements */
  --accent2: #29b6f6;    /* hover state */
  --accent3: #0288d1;    /* pressed state */

  /* Classification Colors */
  --robust:      #4caf50;   /* green */
  --fragile:     #ef5350;   /* red */
  --antifragile: #ab47bc;   /* purple */
  --uncertain:   #ffa726;   /* amber */

  /* Glow Effects */
  --glow-accent: rgba(79, 195, 247, 0.08);
  --glow-robust: rgba(76, 175, 80, 0.15);
  --glow-fragile: rgba(239, 83, 80, 0.15);
  --glow-antifragile: rgba(171, 71, 188, 0.15);

  /* Fonts */
  --font-sans: 'Geist', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', monospace;
}
```

**Card Patterns (adapted from TRIAGE):**
- `border-radius: 12px` (same as TRIAGE)
- `padding: 24px` (slightly tighter than TRIAGE for dashboard density)
- `border: 1px solid var(--border)`
- `background: var(--bg2)`
- Hover: `border-color: var(--border2); box-shadow: 0 0 20px var(--glow-accent);`
- Transition: `all 0.3s ease`

**Typography Scale:**
- Section titles: `font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text2);`
- Data values: `font-family: var(--font-mono); font-weight: 600;`
- Percentages + stats: `font-family: var(--font-mono); color: var(--accent);`

**Dormant → Active Transition:**
```css
.viz-card { opacity: 0.15; border-color: transparent; transition: all 0.8s ease; }
.viz-card.active { opacity: 1; border-color: var(--border); box-shadow: 0 0 20px var(--glow-accent); }
```

---

## Task List (FINAL — 11 tasks)

### Already Done ✅
- Repo initialized, PRISMA_DATA schema, Carlo engine, Nassim engine, Markov engine

### R1: Project Restructure for Vercel [15 min]

Restructure repo:
```
prisma/
├── public/
│   ├── index.html              ← the dashboard SPA
│   ├── js/
│   │   ├── carlo.js            ← (moved from engines/)
│   │   ├── markov.js           ← (moved from engines/)
│   │   ├── nassim.js           ← (moved from engines/)
│   │   ├── visualizations.js   ← Canvas + SVG rendering
│   │   ├── dashboard.js        ← orchestrator + merge logic
│   │   ├── chat.js             ← chat panel logic
│   │   ├── csv-analyzer.js     ← client-side CSV processing
│   │   └── demo-data.js        ← hardcoded fallback data
│   └── css/
│       └── styles.css          ← dark mode cinematic theme
├── api/
│   └── chat.js                 ← Vercel serverless: Anthropic API proxy
├── vercel.json                 ← { functions: { "api/chat.js": { maxDuration: 60 } } }
├── package.json                ← { dependencies: { "@anthropic-ai/sdk": "latest" } }
├── data/                       ← sample CSVs for demo
├── schemas/                    ← PRISMA_DATA schema reference
├── docs/                       ← plans, vision
├── CLAUDE.md
├── README.md
└── LICENSE
```

- Move engines from `engines/` to `public/js/`
- Create `vercel.json` with maxDuration config
- Create `package.json` with Anthropic SDK
- Update `.gitignore` for node_modules

---

### R2: Chat API Endpoint + System Prompt [90 min]

**This is the most important task. Get this right.**

Create `api/chat.js`:
- Import `@anthropic-ai/sdk`
- Define the `update_dashboard` tool with schema
- Build the system prompt (adapted from CLAUDE.md for API format)
- Handle request: extract messages from body
- Call `anthropic.messages.create()` with system prompt + messages + tools
- Parse response: extract text content (chat message) + tool_use blocks (dashboard data)
- Return: `{ message, toolCall: { phase, prismaData } | null }`
- Input validation: message length < 2000, history < 30 messages
- Error handling: API errors return graceful error message, not 500

Create `api/system-prompt.js`:
- Full Prisma reasoning instructions
- How to extract variables with distributions
- How to build causal graphs with feedback loops
- How to define scenarios (always include "do nothing")
- When to call update_dashboard at each phase
- How to format prismaData for each phase
- Taleb classification rules
- Recommendation format (action / watch / trigger)

**Test:** curl the endpoint locally, verify Opus responds with tool calls.

---

### R3: Dashboard Layout + Dark Mode CSS [75 min]

Create `public/index.html`:
- Single-screen layout (no scrolling on desktop)
- Left panel (30%): chat messages + input + upload button
- Right panel (70%): 2x2 viz grid + full-width recommendation row
- All sections start DORMANT (opacity 0.15, faint borders)
- `dormant → active` CSS transition (opacity, border glow, 0.8s ease)
- Plotly CDN + PapaParse CDN script tags
- Engine script tags in correct load order
- Data injection point for demo fallback

Create `public/css/styles.css`:
- Color palette: #0a0a0f bg, #12121a cards, #4fc3f7 accent, classification colors
- Typography: system sans-serif, gradient section titles
- Card styling: 12px radius, subtle glow on hover
- Taleb badges: glowing borders in classification color
- Recommendation cards: colored left border + glow
- Slider styling: blue glowing thumb
- Chat panel: message bubbles (user right, prisma left), typing indicator
- Responsive: works at 1920px and 1280px
- Loading animation: pulsing "Prisma is analyzing..."

---

### R4: Chat Interface [60 min]

Create `public/js/chat.js`:
- Conversation state management (messages array)
- Send message → POST to `/api/chat` with full conversation history
- Display user messages (right-aligned, blue accent)
- Display Prisma messages (left-aligned, with typing indicator while waiting)
- Parse API response: display `message` in chat, pass `toolCall` to dashboard.js
- Handle errors gracefully (show error in chat, don't crash)
- File upload handler: trigger file picker, parse with PapaParse, format stats, send as chat message
- Enter to send (Shift+Enter for newline)
- Auto-scroll to latest message
- Initial greeting: "What decision are you facing?"

JSON response fallback parsing (in case tool_use fails):
```javascript
function parseResponse(apiResponse) {
  // Primary: extract text content + tool_use blocks from API response
  // Fallback: if response is raw text, try to extract JSON
  // Last resort: treat entire response as chat message, no dashboard update
}
```

---

### R5: Dashboard Orchestrator + Merge Logic [90 min]

Create `public/js/dashboard.js`:

**Phase state machine:**
- Tracks current phase: gathering → causal_graph → simulation → verdict → tier2
- When toolCall received: advance phase, activate corresponding sections
- Enforce ordering: if simulation received but causal_graph not yet shown, show both
- Activate section = add `.active` CSS class (triggers transition)

**PrismaData accumulator:**
- `window.PRISMA_STATE = {}` — accumulated prismaData
- `mergePrismaData(existing, incoming)` — deep merge by rules:
  - variables: merge by id
  - edges: merge by from+to composite key
  - scenarios: merge by id
  - feedbackLoops, markov, outcome, recommendation: replace
  - discoveries: append
  - meta: shallow merge
- After merge: trigger re-render of affected sections

**Section renderers (calls into visualizations.js):**
- `renderCausalGraph()` — when variables + edges available
- `renderMonteCarlo()` — runs Carlo, renders dots
- `renderTalebBadges()` — runs Nassim classification
- `renderTornado()` — runs Nassim sensitivity
- `renderMarkovTimeline()` — runs Markov (if config present)
- `renderRecommendations()` — fills recommendation cards
- `renderDiscoveries()` — shows Tier 2 insights
- `renderSliders()` — generates interactive sliders

**Re-run on slider change:**
- When slider changes: update variable value in PRISMA_STATE
- Re-run Carlo + Nassim
- Re-render Monte Carlo dots + Taleb badges + tornado
- Debounce at 150ms

**Demo mode:**
- Check URL for `?demo=true`
- If set: load demo-data.js, skip chat, populate full dashboard immediately

---

### R6: Monte Carlo Dot Visualization (Canvas) [60 min]

Create `public/js/visualizations.js` (Part 1 — the HERO visual):

**Monte Carlo Canvas:**
- Canvas element sized to container (use ResizeObserver)
- X-axis: outcome value (profit/loss in €)
- Y-axis: random jitter (so dots don't stack)
- One cluster of dots per scenario, arranged side by side
- Each dot: 3px circle with `shadowBlur: 6, shadowColor: scenarioColor` for glow
- Green dots for positive outcomes, red for negative, using scenario color
- Entrance animation: dots appear in batches of 100, quick fade-in (not physics simulation)
- After animation: translucent distribution curve overlay
- Summary stats below canvas: median line, p10-p90 band, % positive
- Zero line marked with dashed white line

**Responsive:**
- Canvas redraws on container resize
- Dot positions recalculated proportionally

---

### R7: Causal Graph + Taleb Badges + Tornado [60 min]

Continue `public/js/visualizations.js` (Part 2):

**Causal Graph (HTML/CSS + SVG, NOT Canvas):**
- Each variable = a styled `<div>` node (rounded rect, glow border, label + value)
- Positioned with CSS flexbox: input variables left, intermediates center, outputs right
- Edges drawn with SVG `<line>` or `<path>` elements (green=positive, red=negative)
- Feedback loops: pulsing red glow animation on involved edges (CSS animation)
- Entrance: nodes fade in left-to-right, then edges draw

**Taleb Classification Badges:**
- One card per scenario
- Badge: FRAGILE (red glow) / ROBUST (green glow) / ANTIFRAGILE (purple glow)
- Shows: % positive, median outcome, confidence level, reasoning text
- Entrance: scale up from 0 with spring easing

**Sensitivity Tornado (Plotly):**
- Horizontal bar chart via Plotly
- Variables sorted by totalSwing (biggest impact at top)
- Bidirectional bars: left = impact at min, right = impact at max
- Electric blue (#4fc3f7) color
- Dark mode Plotly theme (paper_bgcolor, plot_bgcolor, font, gridcolor all dark)
- Responsive to container

---

### R8: Sliders + Markov Timeline + Recommendations + Discoveries [60 min]

Continue `public/js/visualizations.js` (Part 3):

**Interactive Sliders:**
- Generated from PRISMA_STATE.variables where isInput=true
- HTML range input with current value label
- Styled: blue glowing thumb, dark track
- onChange: update variable → re-run Carlo + Nassim → re-render (debounced 150ms)

**Markov Timeline (Plotly line chart):**
- X-axis: months 0-6
- Y-axis: outcome metric (€/month)
- One band (p25-p75 filled area) per scenario + median line
- Color-coded by scenario
- Shows divergence over time
- Dark mode Plotly theme

**Recommendation Panel:**
- Three cards: WHAT TO DO (green border) / WHAT TO WATCH (amber) / WHEN TO CHANGE YOUR MIND (blue)
- Content from PRISMA_STATE.recommendation
- Entrance: fade + slide up
- Use textContent (NOT innerHTML) for LLM-generated content — XSS protection

**Discoveries Panel:**
- Shown when PRISMA_STATE.discoveries has items
- Golden glow alert cards
- Type badges: pattern / risk / opportunity
- Entrance: slide in from right

---

### R9: CSV Analyzer + Demo Data [45 min]

Create `public/js/csv-analyzer.js`:
- Uses PapaParse (loaded from CDN) to parse CSV in browser
- `analyzeCSV(csvData)` → computes per-column stats:
  - mean, std, min, max, p25, p50, p75
  - by day-of-week breakdown (if date column detected)
  - trend detection: simple linear regression slope
  - breakpoint detection: compare first-half mean vs second-half mean
- `formatForChat(analysis)` → formats stats as readable text for Opus
- Returns structured JSON that gets sent as a chat message

Create `public/js/demo-data.js`:
- Hardcoded complete PRISMA_DATA for delivery company scenario
- All variables, edges, scenarios, Markov config, recommendation, discoveries
- Used when `?demo=true` in URL or Ctrl+Shift+D pressed
- This is the INSURANCE for the demo recording

Create sample CSVs:
- `data/delivery_logs_q4.csv` (~5000 rows with embedded patterns)
- `data/driver_performance.csv` (~600 rows with embedded patterns)
- Generate via a quick Node.js or Python script

---

### R10: Deploy to Vercel + GitHub [45 min]

- Install dependencies: `npm install @anthropic-ai/sdk`
- Create GitHub repo: `gh repo create prisma-decision-engine --public --source . --push`
- Connect to Vercel: `vercel` CLI or dashboard
- Set environment variable: `ANTHROPIC_API_KEY` in Vercel dashboard
- Deploy and test live URL
- Verify: chat works, tool_use returns structured data, visualizations render
- Test the demo flow end-to-end on the live URL

---

### R11: Polish + Demo Recording [FULL DAY]

**Morning: Polish**
- Smooth all animations (timing, easing, entrance sequences)
- Test edge cases: empty responses, slow API, malformed tool calls
- Add loading states throughout (typing indicator, "Carlo is running...")
- Test demo fallback mode (?demo=true)
- Fix any visual glitches on different screen sizes
- Expand README.md with: demo GIF/screenshot, architecture, how to use, the crew

**Afternoon: Demo**
- Write demo script (exact words to say, exact things to show)
- Practice 3-5 times
- Set up OBS: screen recording + face cam
- Record the 3-minute video
- Write 100-200 word submission summary
- Upload video to YouTube
- **SUBMIT by 3PM EST**

---

## Build Schedule

```
TODAY (Day 2 — remaining):
  R1: Restructure              [15 min]
  R2: Chat API + system prompt [90 min]  ← MOST IMPORTANT
  → CHECKPOINT: can chat with Prisma via API, get tool_use responses

DAY 3:
  R3: Dashboard layout + CSS   [75 min]
  R4: Chat interface           [60 min]
  R5: Dashboard orchestrator   [90 min]
  → CHECKPOINT: chat in browser → sections light up

DAY 4:
  R6: Monte Carlo dots         [60 min]  ← the HERO visual
  R7: Causal graph + Taleb + tornado [60 min]
  R8: Sliders + Markov + recs  [60 min]
  → CHECKPOINT: full dashboard works from conversation

DAY 5:
  R9: CSV analyzer + demo data [45 min]
  R10: Deploy + GitHub         [45 min]
  → CHECKPOINT: live URL, demo data works, CSVs uploadable
  → Record BACKUP demo (even if rough)

DAY 6:
  R11: Polish + final demo recording
  → SUBMIT by 3PM EST
```

## Critical Checkpoint: End of Day 3

"User opens the website, chats with Prisma, and after describing a decision, the causal graph and Monte Carlo sections light up with real data from Opus 4.6."

If NOT met: cut Markov, cut sliders, cut file upload. Focus on: chat → Monte Carlo dots → Taleb badges → recommendations.

## Scope Cuts (If Behind)

**Cut FIRST (minimal demo impact):**
1. Markov timeline → skip entirely
2. Interactive sliders → fixed visualization
3. CSV upload / Tier 2 → demo only Tier 1
4. Animated dot entrance → static dots at final positions

**Cut SECOND (hurts but survivable):**
5. Sensitivity tornado → show only Taleb badges
6. Causal graph → skip, go straight to Monte Carlo
7. Vercel deployment → run locally, screen record

**NEVER CUT:**
- Chat interface in browser (that IS the product)
- Carlo Monte Carlo simulation
- Nassim Taleb classification
- Dark mode cinematic dashboard
- Recommendation panel
- Hardcoded demo fallback

---

## Security Considerations

- API key: Vercel environment variable only, never in code or client
- Input validation: message length cap, history cap
- XSS: use textContent (not innerHTML) for ALL LLM-generated content
- File upload: client-side only, files never leave the browser
- Rate limiting: client-side throttle (1 request per 3 seconds)
- No persistent storage of user data anywhere
- CORS: same-origin (Vercel serves both static + API), no issues

---

*"One decision enters. A thousand futures come out. You see the full spectrum."*
