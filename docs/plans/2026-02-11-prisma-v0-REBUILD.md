# Prisma v0 REBUILD Plan — Web App Architecture

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild Prisma as a single-page web application. Chat with Prisma directly in the browser, visualizations light up in real-time as the conversation progresses, file upload for Tier 2 analysis — all on one screen. Deployed on Vercel.

**Architecture Change:** From "Claude Code terminal → generates HTML → opens in browser" to "ALL in the browser — chat panel + live visualizations on one screen, backed by Vercel serverless functions."

**What's Already Built (KEEP):**
- ✅ engines/carlo.js — Monte Carlo simulation
- ✅ engines/nassim.js — Taleb classification + sensitivity
- ✅ engines/markov.js — State transitions + time evolution
- ✅ schemas/prisma-data.example.json — Data schema contract

**What Changes:**
- Dashboard HTML → complete redesign (compact grid + chat panel)
- Backend → Vercel serverless functions (API proxy + file upload)
- Chat → embedded in dashboard, real-time
- Deployment → Vercel (prisma.vercel.app or similar)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│ BROWSER (Single Page App)                        │
│                                                 │
│ ┌──────────┬────────────────────────────────┐   │
│ │ CHAT     │  VISUALIZATION GRID            │   │
│ │ PANEL    │  (lights up as conversation    │   │
│ │          │   progresses)                  │   │
│ │ Messages │  ┌──────────┬──────────┐       │   │
│ │ Input    │  │ Causal   │ Monte    │       │   │
│ │ Upload   │  │ Graph    │ Carlo    │       │   │
│ │          │  ├──────────┼──────────┤       │   │
│ │          │  │ Taleb    │ Tornado  │       │   │
│ │          │  ├──────────┴──────────┤       │   │
│ │          │  │ Recommendations     │       │   │
│ │          │  └─────────────────────┘       │   │
│ └──────────┴────────────────────────────────┘   │
│                                                 │
│ Engines: carlo.js, nassim.js, markov.js         │
│ (all run CLIENT-SIDE in the browser)            │
└────────────────┬────────────────────────────────┘
                 │ POST /api/chat
                 │ POST /api/upload
                 ▼
┌─────────────────────────────────────────────────┐
│ VERCEL SERVERLESS FUNCTIONS                      │
│                                                 │
│ api/chat.js                                     │
│ ├── Receives user message + conversation history│
│ ├── Adds Prisma system prompt                   │
│ ├── Calls Anthropic API (Opus 4.6)              │
│ ├── Rate limiting (20 conversations/day/IP)     │
│ ├── Input length cap (2000 chars per message)   │
│ └── Returns structured response                 │
│                                                 │
│ api/upload.js                                   │
│ ├── Receives CSV file                           │
│ ├── Parses with Papa Parse or built-in CSV      │
│ ├── Extracts distributions + patterns           │
│ ├── Returns analysis JSON                       │
│ └── File never stored (processed in memory)     │
│                                                 │
│ Environment: ANTHROPIC_API_KEY (secret)          │
└─────────────────────────────────────────────────┘
```

## Conversation → Visualization Pipeline

The key innovation: as the conversation progresses, the dashboard BUILDS UP:

```
STATE 1: "Empty Dashboard"
├── Chat panel active, greeting shown
├── Right side: dark grid with faint section outlines
├── Sections labeled but empty: "Awaiting your decision..."
└── Mood: mysterious, inviting

STATE 2: "Decision Understood" (after 2-3 messages)
├── Prisma has extracted variables and ranges
├── CAUSAL GRAPH lights up → shows variable connections
├── Feedback loops pulsing red
└── Mood: "I see your business"

STATE 3: "Carlo Running" (after variables confirmed)
├── "Carlo is exploring 1,000 futures..."
├── MONTE CARLO canvas animates → dots scatter and cluster
├── Scenario stats appear below dots
└── Mood: anticipation → revelation

STATE 4: "Nassim's Verdict" (immediately after Carlo)
├── TALEB BADGES glow to life → ROBUST / FRAGILE labels
├── SENSITIVITY TORNADO fills in → "This variable matters most"
├── RECOMMENDATION panel lights up → action / watch / trigger
└── Mood: clarity, confidence

STATE 5: "Tier 2 — Data Sharpens" (after file upload)
├── Distributions narrow (confidence bands tighten)
├── DISCOVERIES panel appears → "I found something you didn't ask about..."
├── New insights highlighted with golden glow
└── Mood: "Now I REALLY see your business"
```

## How the Chat Works

The Prisma system prompt tells Opus 4.6 to respond in a specific JSON format that includes both the chat message AND structured data:

```json
{
  "message": "I see a death spiral in your operation. Let me map it out.",
  "prismaData": {
    "phase": "causal_graph",
    "variables": [...],
    "edges": [...],
    "feedbackLoops": [...]
  }
}
```

The frontend:
1. Displays `message` in the chat panel
2. Reads `prismaData` to update the visualization
3. Each response can update different parts of the dashboard
4. The `phase` field tells the frontend WHICH section to light up

Phases in order:
- `gathering` → just conversation, no visuals yet
- `causal_graph` → light up causal graph section
- `simulation` → run Carlo, show Monte Carlo dots
- `verdict` → show Taleb badges + sensitivity + recommendations
- `tier2_analysis` → sharpen everything with uploaded data

## Dashboard Layout (Compact, Single-Screen)

```html
<body>
  <div class="prisma-app">
    <!-- HEADER BAR -->
    <header class="prisma-header">
      <div class="logo">PRISMA</div>
      <div class="tagline">1,000 futures. One decision.</div>
      <div class="tier-badge" id="tier-badge">Tier 1</div>
    </header>

    <!-- MAIN CONTENT: Chat + Visualizations -->
    <div class="prisma-main">

      <!-- LEFT: Chat Panel (30% width) -->
      <div class="chat-panel">
        <div class="chat-messages" id="chat-messages">
          <!-- Messages appear here -->
        </div>
        <div class="chat-input-area">
          <textarea id="chat-input" placeholder="Describe your decision..."></textarea>
          <div class="chat-actions">
            <button id="send-btn">Send</button>
            <label class="upload-btn" for="file-upload">📎 Upload Data</label>
            <input type="file" id="file-upload" accept=".csv,.xlsx" multiple hidden>
          </div>
        </div>
      </div>

      <!-- RIGHT: Visualization Grid (70% width) -->
      <div class="viz-grid">
        <!-- Top Row: Causal Graph + Monte Carlo -->
        <div class="viz-card" id="causal-section">
          <div class="viz-label">How Your Business Connects</div>
          <canvas id="causal-graph"></canvas>
        </div>
        <div class="viz-card" id="monte-carlo-section">
          <div class="viz-label">1,000 Possible Futures</div>
          <canvas id="monte-carlo-canvas"></canvas>
          <div id="scenario-stats" class="scenario-stats"></div>
        </div>

        <!-- Middle Row: Taleb + Sensitivity -->
        <div class="viz-card" id="taleb-section">
          <div class="viz-label">Nassim's Verdict</div>
          <div id="taleb-badges"></div>
        </div>
        <div class="viz-card" id="sensitivity-section">
          <div class="viz-label">What Matters Most</div>
          <div id="tornado-chart"></div>
        </div>

        <!-- Bottom Row: Recommendations (full width) -->
        <div class="viz-card viz-full-width" id="recommendation-section">
          <div class="rec-grid">
            <div class="rec-card rec-action" id="rec-action">
              <h4>WHAT TO DO</h4>
              <p>Awaiting analysis...</p>
            </div>
            <div class="rec-card rec-watch" id="rec-watch">
              <h4>WHAT TO WATCH</h4>
              <p>Awaiting analysis...</p>
            </div>
            <div class="rec-card rec-trigger" id="rec-trigger">
              <h4>WHEN TO CHANGE YOUR MIND</h4>
              <p>Awaiting analysis...</p>
            </div>
          </div>
        </div>

        <!-- Discoveries (hidden until Tier 2) -->
        <div class="viz-card viz-full-width hidden" id="discoveries-section">
          <div class="viz-label">Hidden Insights</div>
          <div id="discoveries-container"></div>
        </div>
      </div>
    </div>
  </div>
</body>
```

CSS Grid for the viz area:
```css
.viz-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr auto;
  gap: 12px;
  height: 100%;
}
.viz-full-width {
  grid-column: 1 / -1;
}
```

## System Prompt for Prisma (API version)

The system prompt sent with every API call tells Opus 4.6 how to behave AND what format to respond in:

```
You are Prisma, a decision intelligence engine. You help people see the consequences of their decisions before committing.

RESPONSE FORMAT: Always respond with valid JSON:
{
  "message": "Your conversational response to the user",
  "phase": "gathering|causal_graph|simulation|verdict|tier2_analysis",
  "prismaData": null or { partial PRISMA_DATA update }
}

WORKFLOW:
1. Start: Ask "What decision are you facing?"
2. Gather: Ask 3-5 sharp follow-up questions to extract variables with ranges
3. Causal Graph: When you have enough info, build the causal graph. Set phase="causal_graph" and include variables + edges in prismaData.
4. Simulation: Set phase="simulation" and include full scenarios + outcome definition in prismaData.
5. Verdict: Set phase="verdict" and include recommendation in prismaData.

For each variable, extract: id, label, value (center), min, max, distribution type, unit.
For each edge, identify: from, to, effect (positive/negative), strength (0-1).
Always look for FEEDBACK LOOPS — they're the most important insight.
Always include a "do nothing" scenario.

[... rest of CLAUDE.md reasoning instructions adapted for API format ...]
```

## Task List (REBUILD)

### Already Done ✅
- Task 1: Repo initialized
- Task 2: PRISMA_DATA schema defined
- Task 3: Carlo engine (engines/carlo.js)
- Task 4: Nassim engine (engines/nassim.js)
- Task 5: Markov engine (engines/markov.js)

### New Tasks

---

### Task R1: Project Restructure for Vercel
**Time: 20 min**

Restructure the repo for Vercel deployment:
```
prisma/
├── public/                    ← static files served by Vercel
│   ├── index.html             ← the dashboard (single page app)
│   ├── js/
│   │   ├── carlo.js           ← Monte Carlo engine
│   │   ├── nassim.js          ← Taleb classifier
│   │   ├── markov.js          ← Markov chains
│   │   ├── chat.js            ← chat panel logic
│   │   ├── dashboard.js       ← visualization orchestrator
│   │   └── visualizations.js  ← Canvas rendering (graphs, dots)
│   └── css/
│       └── styles.css         ← all styling
├── api/                       ← Vercel serverless functions
│   ├── chat.js                ← Anthropic API proxy
│   └── upload.js              ← CSV analysis endpoint
├── data/                      ← sample datasets
├── schemas/                   ← PRISMA_DATA schema
├── docs/                      ← documentation
├── vercel.json                ← Vercel configuration
├── package.json               ← dependencies
├── CLAUDE.md                  ← Prisma instructions (for reference)
├── README.md
└── LICENSE
```

- Move existing engines from `engines/` to `public/js/`
- Create `vercel.json` with routes config
- Create `package.json` with Anthropic SDK dependency
- Keep old dashboard.html as reference, create new `public/index.html`

---

### Task R2: Backend — Chat API Endpoint
**Time: 45 min**

Create `api/chat.js` — Vercel serverless function:
- Receives: `{ messages: [...], conversationId: string }`
- Adds Prisma system prompt to the messages
- Calls Anthropic API (Opus 4.6) via `@anthropic-ai/sdk`
- Rate limiting: track by IP, max 20 requests/hour (use in-memory or Vercel KV)
- Input validation: message length < 2000 chars, max 20 messages in history
- Returns: the structured JSON response from Opus 4.6
- API key from `process.env.ANTHROPIC_API_KEY`

Also create the system prompt file `api/system-prompt.js`:
- Adapted from CLAUDE.md for the API response format
- Instructs Opus to respond with JSON: {message, phase, prismaData}
- Contains all the Prisma reasoning instructions

---

### Task R3: Backend — File Upload Endpoint
**Time: 30 min**

Create `api/upload.js` — Vercel serverless function:
- Receives: multipart form data with CSV file(s)
- Parses CSV in memory (use `csv-parse` or built-in parsing)
- Extracts distributions: mean, std, min, max, percentiles, by-weekday patterns
- Detects trends: simple linear regression on time series
- Detects breakpoints: rolling mean shift detection
- Cross-references if multiple files uploaded
- Returns: JSON with `{ distributions, discoveries, confidence: "narrow" }`
- File is NEVER stored — processed in memory only
- Max file size: 5MB

Note: Since Vercel serverless functions run Node.js, we rewrite the Python analysis logic in JavaScript. This is simpler than running Python on Vercel.

---

### Task R4: Dashboard — Compact Layout + Styling
**Time: 60 min**

Create `public/index.html` and `public/css/styles.css`:
- Single-screen layout (NO SCROLLING on desktop)
- Chat panel (left, 30% width) + Visualization grid (right, 70% width)
- All sections start in "dormant" state (dark, faint outlines, "Awaiting..." labels)
- Full dark mode cinematic CSS (same color palette as before)
- Responsive: works at 1920px and 1280px
- Header bar with PRISMA logo + tagline
- Chat panel: messages area (scrollable), input textarea, send button, upload button
- Viz grid: 2x2 grid (causal graph, monte carlo, taleb, tornado) + full-width bottom (recommendations)
- All canvas elements sized correctly within their grid cells
- CSS transitions for sections "lighting up" (opacity 0.2 → 1.0, border glow appears)

The dormant → active transition CSS:
```css
.viz-card {
  opacity: 0.15;
  border: 1px solid #1a1a2a;
  transition: all 0.8s ease;
}
.viz-card.active {
  opacity: 1;
  border: 1px solid #2a2a4a;
  box-shadow: 0 0 20px rgba(79, 195, 247, 0.08);
}
```

---

### Task R5: Chat Interface Logic
**Time: 45 min**

Create `public/js/chat.js`:
- Manages conversation state (messages array)
- Sends messages to `/api/chat` endpoint
- Displays messages in chat panel (user messages right-aligned, Prisma left-aligned)
- Shows typing indicator while waiting for API response
- Parses JSON response: displays `message` in chat, passes `prismaData` to dashboard orchestrator
- Handles file upload: sends to `/api/upload`, shows upload progress, passes results to orchestrator
- Keyboard shortcut: Enter to send (Shift+Enter for newline)
- Auto-scroll chat to latest message
- Initial greeting message from Prisma: "What decision are you facing?"

---

### Task R6: Dashboard Orchestrator
**Time: 45 min**

Create `public/js/dashboard.js`:
- Receives prismaData updates from chat.js
- Manages the progressive build-up of visualizations
- Based on `phase`, activates the corresponding dashboard sections:
  - `gathering` → no visual changes, just chat
  - `causal_graph` → activate causal graph section, render graph
  - `simulation` → activate Monte Carlo section, run Carlo, render dots + stats; then activate Taleb + Sensitivity sections, run Nassim
  - `verdict` → activate recommendation section, fill in cards
  - `tier2_analysis` → sharpen all visualizations, show discoveries
- Accumulates PRISMA_DATA across multiple responses (each response adds/updates parts)
- Triggers re-renders when data changes
- Manages the dormant → active CSS transitions on sections

---

### Task R7: Visualizations — Causal Graph + Monte Carlo Dots
**Time: 60 min**

Create `public/js/visualizations.js` (part 1):

**Causal Graph (Canvas):**
- Render nodes as rounded rectangles with labels and glow
- Edges as curved lines with arrowheads (green=positive, red=negative)
- Feedback loops highlighted with pulsing red glow animation
- Layout: simple layered positioning (inputs left, outputs right)
- Responsive to container size
- Entrance animation: nodes fade in one by one, then edges draw

**Monte Carlo Dots (Canvas):**
- Static scatter plot first: X=outcome value, Y=random jitter per scenario
- Each dot: small circle with shadowBlur for glow
- Color: scenario color from PRISMA_DATA
- Summary stats below: median marker, p10-p90 range band
- Separate cluster per scenario (side by side or stacked)
- Entrance: dots appear in batches (100 at a time, quick animation)

---

### Task R8: Visualizations — Plotly Charts + Taleb Badges
**Time: 45 min**

Continue `public/js/visualizations.js` (part 2):

**Scenario Comparison (Plotly):**
- Violin or box plots, one per scenario, color-coded
- Dark theme Plotly layout (all backgrounds, grid colors, fonts)
- Responsive to container

**Taleb Badges (HTML/CSS):**
- Generate badge cards dynamically from Nassim classification results
- Each badge: scenario name, classification label, % positive, reasoning text
- Glowing border in classification color
- Entrance animation: badges scale up from 0

**Sensitivity Tornado (Plotly):**
- Horizontal bar chart, variables sorted by total swing
- Bidirectional bars (impact at min vs. max)
- Electric blue color
- Dark theme

---

### Task R9: Visualizations — Markov + Sliders + Recommendations
**Time: 45 min**

Continue `public/js/visualizations.js` (part 3):

**Markov Timeline (Canvas or Plotly):**
- Line chart: X=months (0-6), Y=outcome metric
- One band (p25-p75 shaded) per scenario with median line
- Color-coded by scenario
- Shows divergence over time
- Entrance animation: draws left to right

**Interactive Sliders:**
- Generated from PRISMA_DATA.variables where isInput=true
- Range input with current value display
- On change: re-run Carlo + Nassim, update all visualizations
- Debounced at 150ms
- Styled: glowing blue thumb

**Recommendation Panel:**
- Three cards filled from PRISMA_DATA.recommendation
- Colored left borders (green/amber/blue)
- Entrance: fade + slide up

**Discoveries Panel (Tier 2):**
- Shown when PRISMA_DATA.discoveries is non-empty
- Alert-style cards with golden glow
- Type badges: pattern / risk / opportunity

---

### Task R10: Sample Datasets + Integration Test
**Time: 30 min**

- Create `data/generate_sample_data.js` (Node.js version, for Vercel compatibility)
- Generate `data/delivery_logs_q4.csv` and `data/driver_performance.csv`
- Same patterns as defined in SCOPE.md
- Test the full flow manually: open site → chat → get visualizations → upload CSV → see sharpened analysis

---

### Task R11: Vercel Deployment + GitHub
**Time: 30 min**

- Create GitHub repo: `gh repo create prisma-decision-engine --public`
- Push all code
- Connect to Vercel: `vercel` or through Vercel dashboard
- Set environment variable: `ANTHROPIC_API_KEY`
- Deploy
- Test live URL
- Expand README.md with: demo GIF, architecture, how to use, the crew, hackathon context

---

### Task R12: Polish + Demo Prep
**Time: 60 min**

- Smooth all animations (entrance timing, transitions)
- Test edge cases (empty responses, slow API, large files)
- Add loading states and error handling throughout
- Add rate limit feedback ("You've reached the daily limit")
- Test with the demo scenario end-to-end
- Write demo script (what to say, what to show)
- Practice the 3-minute flow
- Record demo with OBS

---

## Build Order + Day Mapping

```
TODAY (Day 2):
  R1: Project restructure          [20 min]
  R2: Chat API endpoint            [45 min]
  R3: Upload API endpoint          [30 min]
  R4: Dashboard layout + CSS       [60 min]
  → CHECKPOINT: site loads, chat sends/receives messages

DAY 3:
  R5: Chat interface logic         [45 min]
  R6: Dashboard orchestrator       [45 min]
  R7: Causal graph + Monte Carlo   [60 min]
  → CHECKPOINT: chat with Prisma → causal graph + dots appear

DAY 4:
  R8: Plotly charts + Taleb        [45 min]
  R9: Markov + Sliders + Recs      [45 min]
  R10: Sample datasets             [30 min]
  → CHECKPOINT: full dashboard lights up from conversation

DAY 5:
  R11: Deploy to Vercel + GitHub   [30 min]
  R12: Polish + demo prep          [60 min]
  → CHECKPOINT: live URL works, demo rehearsed

DAY 6:
  Record demo video
  Write submission summary (100-200 words)
  Submit by 3PM EST
```

## Critical Checkpoint: End of Day 3

"User chats with Prisma in the browser. After describing a delivery company decision, the causal graph lights up showing the death spiral, and 1,000 Monte Carlo dots form distributions for three scenarios."

If this checkpoint is NOT met: cut Markov, cut sliders, focus on getting the core chat → visualization pipeline working.

## Scope Cuts (If Behind)

**Cut FIRST:**
1. Markov timeline → show only Carlo + Nassim
2. Animated dot entrance → static dots at final positions
3. Interactive sliders → fixed visualization, no re-run
4. File upload/Tier 2 → demo only Tier 1

**Cut SECOND:**
5. Sensitivity tornado → show only Taleb badges
6. Causal graph animation → static image
7. Vercel deployment → run locally, screen record

**NEVER CUT:**
- Chat interface (that IS the product)
- Carlo Monte Carlo simulation
- Nassim Taleb classification
- Dark mode dashboard
- Recommendation panel

---

*"One decision enters. A thousand futures come out. You see the full spectrum."*
