# PRISMA — Product Vision & Hackathon Strategy

## Built with Opus 4.6: Claude Code Hackathon
**Date:** February 10-16, 2026
**Participant:** Muz
**Hackathon:** Anthropic + Cerebral Valley — 500 selected from thousands of applicants
**Prize:** $100K in Claude API credits (1st: $50K, 2nd: $30K, 3rd: $10K, Special: $5K each)

---

## Table of Contents
1. [Context & Origin Story](#context--origin-story)
2. [Boris's Hackathon Guidance](#boriss-hackathon-guidance)
3. [Anthropic Economic Index Insights](#anthropic-economic-index-insights)
4. [First Principles — The Latent Need](#first-principles--the-latent-need)
5. [Product Vision](#product-vision)
6. [The Five Engines](#the-five-engines)
7. [The Three Tiers](#the-three-tiers)
8. [Demo Scenarios](#demo-scenarios)
9. [Judging Criteria Alignment](#judging-criteria-alignment)
10. [Risks & Mitigations](#risks--mitigations)
11. [Competitive Landscape](#competitive-landscape)
12. [Build Scope (TBD)](#build-scope)

---

## Context & Origin Story

### How We Got Here

The idea for Prisma emerged from a deep conversation about the future of AI and where we are in the technology adoption cycle. The key insight chain:

1. **AI is removing the bottleneck of implementation.** Just as PCs removed the need for programmers (spreadsheets), the web removed physical distribution (e-commerce), and mobile removed the desk (Uber, Instagram) — AI removes the bottleneck of building. You need an idea, not the ability to code.

2. **The "Shopify of AI-built software" hasn't arrived yet.** Tools like Bolt, V0, Replit Agent, and Claude Code are early sketches. The winner will make software creation accessible to everyone with a problem to solve.

3. **The solo operator explosion is real.** One person with AI tools can now do what 10-20 people did 3 years ago. This is especially powerful when that person has deep domain expertise.

4. **Domain expertise beats coding skill.** The best products in every tech wave weren't built by the best technologists — they were built by people who understood real problems deeply. Muz's 6+ years in operations (Amazon, Tier, Gorillas, Cure — 180 FTE, 800 field workforce, 60K packages/day, 12-city ops) is the competitive advantage, not coding.

5. **"Why not just use ChatGPT?"** — This challenge forced us to go deeper. A chatbot with better prompting is a dead product. The product must do something fundamentally impossible with raw ChatGPT/Claude. That led to: **the product doesn't ADVISE. It SIMULATES.**

6. **Decisions under uncertainty** — the hardest part of operations (and life). Not "optimize my route" (tools exist) but "help me see the consequences of this choice before I commit." This is the latent demand.

7. **Monte Carlo + Markov + Taleb** — Fortune 500 companies pay millions for this exact combination of analytical frameworks. We make it accessible through conversation.

### Muz's Unique Edge

- M.Sc. Operations Research (RWTH Aachen) — understands optimization, mathematical modeling, queuing theory, simulation
- 6+ years scaling distributed operations — Amazon (last-mile), Tier (micromobility), Gorillas (quick commerce), Cure
- Led 180 FTE, ~800 field workforce, 60K packages/day, 12-city multi-country operations
- Six Sigma Green Belt — process improvement methodology
- Knows what decision paralysis FEELS like from running real operations at scale

No other hackathon participant has this combination. Developers will build developer tools. Muz builds an operations decision engine because he's LIVED the problem.

---

## Boris's Hackathon Guidance

Boris Cherny (Claude Code creator) shared critical guidance during the kickoff:

### 1. "Latent Demand"
Build for needs people HAVE but don't know have solutions. People don't search for "decision simulation tool." They lie awake at 2am thinking "should I hire or not?" The pain is real. The product category doesn't exist yet in their minds.

### 2. "Build for the Model in 6 Months"
Don't constrain to what Opus 4.6 does perfectly today. If something works 70-80% now, build it anyway. The model will catch up. Be ambitious. Build the ideal product. Accept imperfection.

### 3. "Work With the Grain of the Model"
Don't force AI to do things it's bad at. Redesign the PRODUCT so AI does what it's naturally great at:

| Opus 4.6 Strengths | Opus 4.6 Weaknesses |
|---|---|
| Understanding messy natural language | Large-scale number crunching |
| Reasoning through multi-step problems | Real-time data streaming |
| Presenting trade-offs with nuance | Guaranteed mathematical precision |
| Generating structured output (code, tables) | Pixel-perfect design |
| Having judgment conversations | Being a database |

**Our product design follows this:** AI understands the problem, structures the model, interprets results, presents trade-offs. Deterministic engines (Monte Carlo, Markov) handle the math. Perfect grain alignment.

### 4. "Look for Ways to Automate with Claude"
Push automation boundaries. The product should automate as much of the analysis pipeline as possible while keeping the human in the loop for decisions.

---

## Anthropic Economic Index Insights

Anthropic's Economic Index report (Jan 2026, 55 pages) analyzed 1M Claude.ai conversations and 1M API transcripts from November 2025. Key findings relevant to our product:

### Finding 1: Input Quality = Output Quality (r = 0.92)
The correlation between the sophistication of user prompts and AI response quality is near-perfect. **This is our core value proposition.** Our product transforms messy business questions ("should I hire?") into structured, rich simulation prompts that unlock Opus 4.6's deepest reasoning. The SMB owner provides the raw problem. Our product provides the structure. Opus 4.6 provides the analysis.

### Finding 2: Augmentation Beats Automation (52% vs 45%)
Users are moving TOWARD collaborative, iterative use. Task iteration and learning modes are growing. This validates our human-in-the-loop approach: AI simulates, human decides.

### Finding 3: Complex Tasks = Bigger Speedup but Lower Success
12x speedup for college-level tasks vs 9x for high school level. But success drops from ~70% to ~66% for complex tasks. **Our product handles this by breaking complex decisions into interconnected simple variables.** Each variable is easy. The system is complex. Monte Carlo handles the complexity.

### Finding 4: Multi-Turn Extends Task Horizon from 3.5h to 19h
Single-shot API: 50% success at 3.5 hours. Multi-turn Claude.ai: 50% success at 19 hours. **Our product is inherently multi-turn** — building a simulation through iterative conversation.

### Finding 5: Bottleneck Tasks = Human Judgment
Productivity gains are constrained by tasks AI can't do. Those bottleneck tasks are judgment calls, ambiguous decisions, trade-offs. **Our product serves the bottleneck — it doesn't replace human judgment, it amplifies it.**

### Finding 6: Non-Coding Usage is Underserved
Computer/math tasks = 34% of Claude.ai usage. Operations, management, and business decisions are wide open territory. Latent demand confirmed.

### Finding 7: AI Diffusion is 10x Faster Than Historical Tech
2-5 years to equalize across US states, vs ~50 years for previous technologies. The market is growing fast.

---

## First Principles — The Latent Need

Strip everything away. What does a human actually need when facing a decision under uncertainty?

**They need to see the future before they commit to it.**

Every decision is a bet on a future you can't see. The pain isn't the decision itself — it's the FEAR of the consequences. "What if I hire and it doesn't work out?" "What if I expand and the market shifts?"

The latent need: **I want to experience the consequences of a choice before I live through them.**

Currently available options:

| Option | Cost | What You Get |
|---|---|---|
| Gut feeling | Free | Anxiety and hope |
| ChatGPT/Claude | Free | Text analysis, pros/cons list |
| Spreadsheet model | Hours of your time | One scenario (best case? worst case?) |
| Consultant | €500/hr | Expert opinion, still uncertain |
| Simulation software | €100K+ | Real modeling — but only for enterprises |
| **Prisma** | **A conversation** | **1,000 simulated futures with your real numbers** |

The gap: accessible, conversational decision simulation doesn't exist. Nobody is searching for it because they don't know it's possible. That's latent demand.

**The one-liner:** Google organized the world's information and made it searchable. Prisma organizes the world's decisions and makes them simulatable.

---

## Product Vision

### What Prisma Is

A decision engine that lets anyone see the consequences of their choices before committing. You describe your situation in plain words. Prisma builds a living model of your system, runs thousands of simulated futures, and shows you which choices are robust vs. fragile — so you decide with confidence, not anxiety.

### What Prisma Is NOT

- Not a chatbot with better prompting (that's a wrapper)
- Not a dashboard (dashboards show the past, we simulate the future)
- Not a code generator (the code is the delivery mechanism, not the product)
- Not an optimization tool (we don't tell you the "optimal" answer — we show you the landscape of possibilities and YOU decide)

### The Philosophy: Deterministic + AI + Human

```
DETERMINISTIC (math):     What's calculable → calculate it exactly
AI (Opus 4.6):            What's ambiguous → reason about it
HUMAN (the user):         What's a value judgment → you decide
```

This three-layer split is the core design principle. Never use AI where math works. Never use math where human judgment is needed. Each layer does what it's best at.

---

## The Five Engines

### Engine 1: Causal Graph (THE STRUCTURE)
**What it does:** Maps how variables in the user's situation connect and cascade.
**Why it matters:** Shows that variables aren't independent — changing one ripples through the system. This is where "death spirals" and "feedback loops" become visible.
**Example:** Driver quits → others overloaded → burnout → MORE quitting → feedback loop identified.
**Implementation:** Dictionary of nodes (variables) and edges (causal relationships). Opus 4.6 identifies these from conversation.

### Engine 2: Monte Carlo Simulation (THE CORE)
**What it does:** Runs the causal model 1,000 times with random variations on uncertain variables. Shows the DISTRIBUTION of possible outcomes.
**Why it matters:** Instead of one answer, you see all possible answers. "Hiring works in 84% of futures" is fundamentally different from "hiring is probably good."
**Example:** 1,000 dots scatter across an outcome chart, forming clusters that show the most likely outcomes.
**Implementation:** For-loop with random sampling from distributions. JavaScript Math.random() or Python numpy. Computationally trivial.

### Engine 3: Markov Chains (THE TIME DIMENSION)
**What it does:** Models how the system evolves through states over time. Variables transition between states (unreliable → reliable → star performer) with probabilities at each time step.
**Why it matters:** Enables "time travel" — watch your business evolve month by month under different decisions. Without Markov, Monte Carlo gives a snapshot. With Markov, it gives a MOVIE.
**Example:** "By month 6, there's a 38% chance Kai is reliable, 22% chance he's quit, 40% chance still unreliable."
**Implementation:** Transition matrices + state tracking per time step. Wraps inside Monte Carlo (each of 1,000 simulations runs Markov forward N months).
**Priority:** P3 — cut if time pressure on day 5. Product works without it, but is exceptional with it.

### Engine 4: Taleb Framework (THE VERDICT)
**What it does:** Classifies each decision option as FRAGILE, ROBUST, or ANTIFRAGILE based on Monte Carlo output.
**Why it matters:** More intuitive and honest than a percentage. "This decision is robust" is actionable. "84.3% probability" feels falsely precise.
**Classification:**
- **Fragile:** Breaks under stress. Most simulated futures are bad. Avoid.
- **Robust:** Survives stress. Consistent across simulations. Safe choice.
- **Antifragile:** Benefits from chaos. Gets better when things go wrong. Best choice.
**Implementation:** ~20-30 lines analyzing Monte Carlo distribution shape, tail behavior, and variance.

### Engine 5: Sensitivity Analysis (THE PRIORITIZER)
**What it does:** Identifies which uncertain variables have the BIGGEST impact on the outcome. Answers "what matters most?"
**Why it matters:** Directly addresses false precision (Risk 4) and usefulness (Risk 6). Tells the user WHERE to focus attention and data-gathering, and WHEN to change their mind.
**Example:** "Your decision depends mostly on fuel costs. Everything else barely moves the needle."
**Implementation:** Re-run Monte Carlo while varying each input independently. Rank by impact on outcome. ~30 lines of code. Visualized as a tornado diagram.

### Engine Stack Summary

```
HEAVY LIFTING (where build time goes):
├── Causal Graph       → The business MODEL (P1)
├── Monte Carlo        → The simulation ENGINE (P1)
└── Markov Chains      → Time evolution EXTENSION (P3 — cut if needed)

LIGHTWEIGHT (post-processing, ~20-30 lines each):
├── Taleb Framework    → Decision CLASSIFICATION (P2)
└── Sensitivity        → Variable RANKING (P2)
```

### Why These Five and Nothing More

Every engine serves a specific beat in the 3-minute demo:
1. Causal graph → "Here's how your business works" (structure)
2. Monte Carlo → "Here are 1,000 possible futures" (the wow moment)
3. Markov → "Watch it play out over 6 months" (time travel)
4. Taleb → "This decision is ROBUST" (the verdict)
5. Sensitivity → "Watch fuel costs, ignore the rest" (actionability)

Remove one: the story has a gap. Add one: the story gets crowded.

Additional frameworks considered and rejected:
- Bayesian updating → needs longitudinal data, not demo-able
- Optimization (OR solvers) → adds whole new complexity, save for v2
- Game theory → too academic for demo
- Decision trees → overlaps with Markov

---

## The Three Tiers

Progressive engagement model — each tier is self-sufficient and delivers value:

### Tier 1: "Just Talk"
- User describes situation in plain words
- Prisma asks about key variables and their ranges
- Builds estimated distributions from conversation
- Runs Monte Carlo with estimated ranges
- Result: rough but directionally correct simulation with wide confidence bands
- **Already more useful than ChatGPT** because output is interactive, probabilistic, and classified

### Tier 2: "Here's Some Data"
- User uploads a spreadsheet, CSV, or file
- Prisma extracts ACTUAL distributions from real data
- Replaces estimates with real numbers, discovers correlations
- Result: sharper simulation with narrower confidence bands
- **Discovers things the user didn't know** (patterns in data, hidden correlations)

### Tier 3: "The Folder"
- User points Prisma at their business data folder
- Full context: financials, operations, people, customers, history
- Builds complex multi-variable model with real correlations
- Result: enterprise-grade simulation
- **Proactive insights, ongoing monitoring, deepest analysis**

The user never HAS to reach Tier 3. The product delivers value from the first sentence.

---

## Demo Scenarios

### Demo 1: Ops Manager — Tier 1 (Just Talking)

**Scenario:** Quick commerce dark store, 10 riders, 300 orders/day. 3 riders quit, remaining burning out. Decision: hire 4, use 3PL for overflow, or cut delivery radius.

**Key moments:**
- Causal graph reveals a DEATH SPIRAL (negative feedback loop: riders leave → others overwork → they leave too)
- Monte Carlo shows "do nothing" is actually the RISKIEST option
- Taleb: Hiring = ROBUST, Doing nothing = FRAGILE
- Sensitivity: "Your decision depends on hiring speed — nothing else matters as much"
- Recommendation: Start with 3PL this week to stop bleeding, simultaneously hire, phase out 3PL when trained

### Demo 2: Same Company — Tier 3 (Full Folder)

**Scenario:** Same company, but now Prisma has access to 6 months of delivery logs, rider performance data, P&L, customer complaints.

**Key moments:**
- Data reveals it's NOT a "rider problem" — it's a "scooter riders on Friday-Saturday" problem
- Reframes the question entirely (hire 2, not 4; adjust bonus structure)
- DISCOVERY: "Convert 2 scooter roles to e-bike roles — saves €4,800/year in turnover costs"
- Confidence bands narrow dramatically (83-91% vs 65-90%)
- Taleb: Combined approach = ANTIFRAGILE (benefits from demand spikes)

### Demo 3: Personal — Muz Picks a Restaurant

**Scenario:** Friday night, Berlin, very hungry. Options: Cocolo Ramen, The Bird, Mustafa's Kebab, Burgermeister. Google Maps data + appetite.

**Key moments:**
- Causal graph: hunger level = HIGH → wait time matters more, portion size matters more
- Monte Carlo: simulates 1,000 Friday nights (wait time variance, satisfaction)
- Taleb: Burgermeister = ROBUST (consistent), Mustafa's = FRAGILE (amazing ceiling, terrible floor when starving in a 55-min line)
- Sensitivity: "This decision hinges on how hungry you are RIGHT NOW"
- Actionable: "Go to Burgermeister. BUT if you walk past Mustafa's and the line is under 5 people, pivot."

### What the Three Demos Show Together

The SAME engine works for a €50K business decision AND picking dinner. Same math. Different stakes. Same clarity. The product is domain-agnostic — it's about decisions under uncertainty, which is universal.

---

## Judging Criteria Alignment

### Demo (30%) — THE BIGGEST CRITERION
- Visual centerpiece: 1,000 dots forming a distribution in real-time
- Story arc: problem → causal graph → simulation → verdict → action
- Three contrasting demos show breadth AND depth
- The "holy shit" moment: watching futures diverge in parallel

### Impact (25%)
- Fortune 500 decision science → accessible to anyone
- Every human and business makes decisions under uncertainty
- Currently locked behind €500/hr consultants and €100K+ software
- "Google organized information. This organizes decisions."

### Opus 4.6 Use (25%)
- NOT just code generation. The AI does:
  - Understand messy business descriptions
  - Identify causal relationships (feedback loops, cascades)
  - Estimate probability distributions from conversation
  - Construct Markov state models
  - Interpret simulation results in context
  - DISCOVER insights the user didn't ask about
  - Classify using Taleb framework with reasoning
- The reasoning IS the product. Code generation is just delivery.

### Depth & Execution (20%)
- Iterated from "routing tool" → "optimization tool" → "decision tool" → "simulation engine"
- Five interconnected engines, each serving a clear purpose
- Three data tiers showing progressive depth
- Taleb + Monte Carlo + Markov = intellectual depth that "Keep Thinking" prize is made for
- Muz's ops expertise encoded in the causal reasoning

### Target Prizes
1. **Top 3** — overall winner
2. **"Keep Thinking" Prize** — iteration depth from concept to final product
3. **"Most Creative Opus 4.6 Exploration"** — using the model for business simulation, not just code generation

---

## Risks & Mitigations

### Risk 1: Scope Overload (HIGHEST RISK)
**Problem:** 5 engines + 3 tiers + polished demo in 6 days.
**Mitigation:** Ruthless priority ordering. P1 (Causal Graph + Monte Carlo) must be perfect. P2 (Taleb + Sensitivity) are trivial to add. P3 (Markov) gets cut if time runs out. Build small, polish hard.

### Risk 2: "They just used Claude to generate a Monte Carlo app"
**Problem:** If Opus 4.6's role looks like code generation, judges yawn.
**Mitigation:** Make the AI's REASONING visible in the demo. Show the causal graph being built, show the AI identifying feedback loops, show it discovering insights. The reasoning is the product, not the generated code.

### Risk 3: False Precision
**Problem:** "84.3% probability" from estimated data looks falsely precise.
**Mitigation:** (a) Show confidence BANDS that narrow with better data. (b) Sensitivity analysis shows where precision matters. (c) Taleb classification is qualitative from quantitative — more honest than fake percentages.

### Risk 4: "Cool but is it useful?"
**Problem:** A probability distribution doesn't tell you what to DO.
**Mitigation:** Every simulation ends with three things: (1) WHAT TO DO — clear recommendation, (2) WHAT TO WATCH — the 1-2 variables that matter, (3) WHEN TO CHANGE YOUR MIND — specific trigger points.

### Risk 5: Competition from Pure Engineers
**Problem:** Ex-FAANG developers building technically impressive projects.
**Mitigation:** Our advantage isn't technical — it's domain expertise + intellectual depth. Nobody else combines OR, Monte Carlo, Markov, and Taleb in a conversational product. Stay in our lane.

---

## Competitive Landscape

| Tool | What It Does | How We Differ |
|---|---|---|
| Causal.app (~$50/mo) | Monte Carlo in spreadsheet interface | Not conversational, not AI-powered, for analysts |
| Guesstimate (free) | Monte Carlo with estimated distributions | Manual variable definition, no AI, no Markov, no Taleb |
| @Risk / Crystal Ball ($1,500+/yr) | Enterprise Monte Carlo for Excel | For quants, not business owners |
| Simul8 / AnyLogic ($5,000+) | Full simulation software | Enterprise only, needs specialists |
| ChatGPT / Claude | Text analysis of decisions | No simulation, no distributions, no interactive exploration |

**What none of these do:** Build the model from conversation. Use AI to identify causal structures. Combine Monte Carlo + Markov. Classify with Taleb's framework. Work from Tier 1 (just talking) with zero data prep.

---

## Build Scope

**TBD — to be defined in next session.**

Key questions to resolve:
- Tech stack (web app? Claude Code extension? both?)
- What specifically gets built each day (day 1-6 plan)
- What's the minimum viable demo?
- How do we record the 3-minute video?
- Open source repo structure

---

*Document created: February 10, 2026*
*Hackathon: Built with Opus 4.6 — Claude Code Hackathon*
*"See the future before you commit to it."*
