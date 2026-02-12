# DecisionPilot — Hackathon Project Spec
## Built with Opus 4.6 Hackathon (Feb 10-16, 2026)

---

## PROJECT OVERVIEW

DecisionPilot is an AI-powered data analysis and decision simulation tool. The user uploads any messy CSV file. The AI automatically understands it, cleans it, generates interactive dashboards, proactively surfaces insights and anomalies, and — the key differentiator — lets the user ask "what if?" questions that trigger Monte Carlo simulations to model decision outcomes with probability distributions.

The flow is: Upload → Auto-Dashboard → AI Insights → Decision Simulation (Monte Carlo)

This is NOT just another dashboard builder. The dashboards are the foundation. The real product is the decision layer on top — where the AI tells you what to DO about your data and simulates outcomes before you commit.

---

## TECH STACK

- **Frontend:** React (Next.js) deployed on Vercel
- **Backend/API:** Next.js API routes or serverless functions on Vercel
- **AI Engine:** Claude Opus 4.6 API (claude-opus-4-6) — used for data understanding, insight generation, and Monte Carlo parameter formulation
- **Charts/Visualization:** Recharts or Plotly.js for interactive dashboards, plus a probability distribution chart for Monte Carlo results
- **Monte Carlo Engine:** Run simulations either server-side (Python via Vercel serverless) or client-side (JavaScript with a simulation library). If client-side JS is simpler for the Vercel stack, use that — NumPy is not required, we can run Monte Carlo in pure JS with simple random sampling loops
- **Deployment:** GitHub → Vercel (already connected)
- **Styling:** Tailwind CSS

---

## UI LAYOUT

Split-screen interface:

```
┌──────────────────────────────────────────────────────────────┐
│  DecisionPilot                                    [Upload CSV]│
├─────────────────────────┬────────────────────────────────────┤
│                         │                                    │
│   CHAT PANEL            │   DASHBOARD PANEL                  │
│   (left side, ~35%)     │   (right side, ~65%)               │
│                         │                                    │
│   - AI messages         │   - Auto-generated charts          │
│   - User messages       │   - KPI cards                      │
│   - Insight cards       │   - Tables                         │
│   - Monte Carlo results │   - Monte Carlo visualizations     │
│   - Suggestions         │   - Probability distributions      │
│                         │                                    │
│   [Type message...]     │                                    │
│                         │                                    │
└─────────────────────────┴────────────────────────────────────┘
```

The dashboard panel is REACTIVE — it updates in real-time as the user chats. When the user asks for a new chart, it appears on the right. When Monte Carlo runs, the distribution chart appears on the right. The chat and dashboard are tightly coupled.

---

## DETAILED FEATURE SPEC

### PHASE 1: Upload & Auto-Understand

**What happens when the user uploads a CSV:**

1. File is parsed client-side (use PapaParse or similar)
2. Raw data (or a representative sample if very large) is sent to Opus 4.6 with this prompt structure:

```
You are a data analyst. The user has uploaded a CSV file. Here is the raw data:

[CSV DATA — headers + first 100 rows + last 10 rows + row count + column count]

Analyze this dataset and respond in JSON format:

{
  "summary": "Plain language description of what this dataset contains, who would use it, and what it covers",
  "row_count": number,
  "column_count": number,
  "date_range": "if temporal data exists, the range",
  "columns": [
    {
      "name": "column name",
      "type": "numeric|categorical|date|text|boolean",
      "description": "what this column represents",
      "missing_values": number,
      "unique_values": number,
      "sample_values": ["a", "b", "c"]
    }
  ],
  "data_quality_issues": [
    "list of issues found: missing values, duplicates, inconsistent formats, outliers"
  ],
  "cleaning_actions_taken": [
    "list of what was auto-cleaned"
  ],
  "suggested_dashboards": [
    {
      "title": "Dashboard name",
      "description": "What this dashboard shows and why it matters",
      "charts": [
        {
          "type": "bar|line|pie|scatter|kpi_card|table",
          "title": "Chart title",
          "x_axis": "column name or derived",
          "y_axis": "column name or derived",
          "aggregation": "sum|avg|count|etc",
          "reasoning": "why this chart is useful"
        }
      ]
    }
  ],
  "key_metrics": [
    {
      "name": "metric name (e.g. Total Revenue, Avg Order Value, Churn Rate)",
      "value": "calculated value",
      "trend": "up|down|stable",
      "context": "why this matters"
    }
  ]
}
```

3. The AI response populates the dashboard panel with:
   - A summary card at the top ("This dataset contains 2,847 customer records spanning 14 months...")
   - KPI cards showing key metrics
   - Suggested dashboard buttons the user can click to generate

4. In the chat panel, the AI says something like:
   "I've analyzed your dataset. It contains [summary]. I found [issues] and cleaned them. I've identified [N] key metrics and suggest [N] dashboard views. Click any dashboard suggestion on the right to generate it, or tell me what you'd like to see."

**Important UX details:**
- The upload should accept .csv and .xlsx files
- Show a loading state while Opus 4.6 processes ("Analyzing your data...")
- If the file is very large (>10,000 rows), send a statistical sample to Opus but keep full data client-side for chart rendering
- The data cleaning should be transparent — show what was changed

---

### PHASE 2: Auto-Dashboard Generation

**When the user clicks a suggested dashboard or asks for one in chat:**

1. The system takes the dashboard specification from Phase 1 (or generates a new one from the chat request)
2. Charts are rendered on the right panel using the actual data (not AI-generated fake data — real aggregations computed from the CSV)
3. Each chart is interactive (hover for values, click to filter)

**Chart types to support:**
- Bar chart (vertical and horizontal)
- Line chart (for time series)
- Pie/donut chart (for proportions)
- KPI cards (big number + trend arrow)
- Data table (sortable, searchable)
- Scatter plot (for correlations)

**Chat-driven dashboard editing:**
The user can type things like:
- "Show me revenue by month" → line chart appears
- "Break that down by customer segment" → chart updates with segments
- "Add a chart showing top 10 customers by spend" → new chart appears
- "Remove the pie chart" → chart removed
- "Focus on Segment B only" → all charts filter to Segment B

**How this works technically:**
- User message goes to Opus 4.6 with the current dashboard state and data schema
- Opus returns a JSON instruction for what chart to add/modify/remove
- Frontend renders the chart using the actual CSV data
- The dashboard state is maintained in React state

**Dashboard state structure:**
```json
{
  "filters": { "segment": "B", "date_range": ["2025-01", "2025-12"] },
  "charts": [
    {
      "id": "chart_1",
      "type": "line",
      "title": "Monthly Revenue",
      "config": { ... }
    },
    {
      "id": "chart_2", 
      "type": "bar",
      "title": "Revenue by Segment",
      "config": { ... }
    }
  ],
  "kpi_cards": [
    { "label": "Total Revenue", "value": "$1.2M", "trend": "+12%" }
  ]
}
```

---

### PHASE 3: Proactive AI Insights (Highlights & Lowlights)

**After dashboards are generated, the AI proactively analyzes the data for anomalies, risks, and opportunities.**

This is NOT just showing metrics — this is the AI saying "hey, look at THIS."

The AI generates insight cards that appear in the chat panel, each with:
- An icon (warning for risks, lightbulb for opportunities, trending for changes)
- A headline ("Customer churn spiked 68% last quarter")
- A short explanation ("Segment B churn went from 4.2% to 7.1%. 23 high-value customers show pre-churn signals: declining purchase frequency and smaller basket sizes")
- A suggested action ("Consider targeted retention offers for at-risk customers")
- A "Simulate this" button that pre-loads a Monte Carlo scenario

**Prompt to Opus 4.6 for insight generation:**

```
You are a senior business analyst. Based on the following dataset and dashboard state, identify the most important insights — things a business leader NEEDS to know.

[FULL DATA CONTEXT]

For each insight, provide:
{
  "insights": [
    {
      "type": "risk|opportunity|trend|anomaly",
      "severity": "critical|high|medium|low",
      "headline": "short attention-grabbing headline",
      "explanation": "2-3 sentences explaining the finding with specific numbers",
      "affected_metric": "which KPI this impacts",
      "suggested_action": "what the user should consider doing",
      "simulation_scenario": {
        "question": "What if we [suggested action]?",
        "variables_to_simulate": ["variable1", "variable2"],
        "assumptions": ["assumption1", "assumption2"]
      }
    }
  ]
}

Prioritize insights that are:
1. Actionable (the user can do something about it)
2. Significant (material impact on the business)
3. Non-obvious (not just restating a metric, but connecting dots)

Limit to the top 3-5 most important insights. Quality over quantity.
```

**UX for insights:**
- Insights appear as cards in the chat panel after dashboard generation
- Each card is expandable for more detail
- The "Simulate this" button on each card transitions to Phase 4
- User can also ask their own "what if?" questions in the chat

---

### PHASE 4: Monte Carlo Decision Simulation

**This is the core differentiator. When the user asks a "what if?" question or clicks "Simulate this" on an insight card:**

**Example flow:**

User: "What if we offer 15% discount to at-risk customers?"

**Step 1: AI formulates the simulation parameters**

Opus 4.6 receives the question + full data context and returns:

```json
{
  "scenario_name": "15% Discount for At-Risk Customers",
  "description": "Simulating the impact of offering a 15% discount to 23 identified at-risk high-value customers",
  "target_cohort": {
    "size": 23,
    "current_revenue": "$184,000/year",
    "churn_probability_without_action": 0.65
  },
  "simulation_variables": [
    {
      "name": "discount_take_up_rate",
      "description": "Probability that an at-risk customer accepts the discount offer",
      "distribution": "beta",
      "params": { "alpha": 6, "beta": 4 },
      "mean": 0.60,
      "reasoning": "Based on industry benchmarks for targeted discount campaigns"
    },
    {
      "name": "retention_probability_if_accepted",
      "description": "Probability customer stays if they accept the discount",
      "distribution": "beta",
      "params": { "alpha": 7, "beta": 3 },
      "mean": 0.70,
      "reasoning": "Customers who engage with retention offers show 70% retention rates"
    },
    {
      "name": "revenue_impact_per_retained_customer",
      "description": "Annual revenue per retained customer after discount",
      "distribution": "normal",
      "params": { "mean": 6800, "std": 1200 },
      "reasoning": "Based on average revenue of at-risk cohort minus 15% discount"
    },
    {
      "name": "cost_of_discount",
      "description": "Direct cost of the 15% discount per customer who accepts",
      "distribution": "fixed",
      "value": 1200,
      "reasoning": "15% of average annual spend"
    }
  ],
  "iterations": 10000,
  "output_metrics": [
    {
      "name": "net_revenue_impact",
      "formula": "retained_revenue - discount_cost - lost_revenue_from_churned",
      "unit": "dollars"
    },
    {
      "name": "roi",
      "formula": "net_revenue_impact / total_discount_cost",
      "unit": "ratio"
    },
    {
      "name": "customers_retained",
      "formula": "count of customers who accept AND stay",
      "unit": "count"
    }
  ],
  "assumptions": [
    "At-risk customers are correctly identified based on declining purchase frequency",
    "Discount is applied for 3 months, then regular pricing resumes",
    "No cannibalization from non-at-risk customers seeking discounts",
    "Response rates based on industry benchmarks for similar e-commerce businesses"
  ]
}
```

**Step 2: Run the Monte Carlo simulation**

Using the parameters from Opus 4.6, run 10,000 iterations:

```javascript
// Pseudocode for the Monte Carlo engine
function runSimulation(params, iterations = 10000) {
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    // Sample from each variable's distribution
    const takeUpRate = sampleBeta(params.discount_take_up_rate);
    const retentionProb = sampleBeta(params.retention_probability);
    const revenuePerCustomer = sampleNormal(params.revenue_impact);
    
    // Calculate outcomes for this iteration
    const customersOffered = params.target_cohort.size;
    const customersAccepted = Math.round(customersOffered * takeUpRate);
    const customersRetained = Math.round(customersAccepted * retentionProb);
    const customersChurned = customersOffered - customersRetained;
    
    const retainedRevenue = customersRetained * revenuePerCustomer;
    const discountCost = customersAccepted * params.cost_of_discount;
    const lostRevenue = customersChurned * params.target_cohort.avg_revenue;
    
    const netImpact = retainedRevenue - discountCost - lostRevenue;
    
    results.push({
      netImpact,
      roi: netImpact / discountCost,
      customersRetained,
      retainedRevenue,
      discountCost
    });
  }
  
  return results;
}
```

**Step 3: Visualize the results**

On the dashboard panel (right side), show:

1. **Probability Distribution Histogram**
   - X-axis: Net revenue impact (in dollars)
   - Y-axis: Frequency
   - Color-coded: green for positive outcomes, red for negative
   - Vertical lines showing: mean, median, P10, P90

2. **Key Statistics Card**
   ```
   Expected Net Impact: +$47,200
   Best Case (P90): +$82,000
   Worst Case (P10): +$12,400
   Probability of Positive ROI: 87%
   Expected Customers Retained: 11 of 23
   Break-even Probability: 92%
   ```

3. **Sensitivity Analysis** (optional but impressive)
   - Which variable has the biggest impact on the outcome?
   - "If take-up rate drops below 40%, the scenario becomes unprofitable"
   - Tornado chart showing variable sensitivity

4. **AI Recommendation**
   After the simulation, Opus 4.6 interprets the results:
   
   "Based on the simulation, offering a 15% discount to at-risk customers has an 87% probability of positive ROI, with an expected net revenue impact of +$47,200. The biggest risk factor is discount take-up rate — if fewer than 40% of customers respond, the initiative breaks even. 
   
   Recommendation: Proceed with a pilot targeting the top 10 highest-value at-risk customers first. This limits downside risk while validating the take-up rate assumption."

**Step 4: Iterative refinement**

The user can then chat to adjust:
- "What if we only offer 10% instead of 15%?" → re-run with adjusted params
- "What if we also add free shipping?" → AI adjusts simulation variables
- "Show me the scenario for Segment A instead" → new cohort, new simulation
- "Compare both scenarios side by side" → dual distribution charts

---

## SAMPLE DEMO DATA

For the hackathon demo, include a pre-loaded sample CSV that showcases all features. Use an e-commerce customer dataset with these columns:

```csv
customer_id, name, email, segment, signup_date, last_purchase_date, total_orders, total_spend, avg_order_value, purchase_frequency_monthly, product_category, region, discount_history, support_tickets, nps_score, churn_risk_score
```

Generate ~3,000 rows of realistic synthetic data with built-in patterns:
- A visible churn spike in the last quarter
- One underperforming segment
- Seasonal patterns
- A few high-value customers showing pre-churn signals
- Some data quality issues (missing values, inconsistent date formats, duplicates) to demonstrate the auto-clean capability

---

## LEVERAGING OPUS 4.6 CAPABILITIES

This project specifically showcases Opus 4.6's strengths:

1. **1M token context window**: Feed the ENTIRE dataset into context (up to ~3,000-5,000 rows depending on column count). Most tools only show Opus metadata — we show it the actual data so it can reason about specific records, not just summaries.

2. **Extended thinking / adaptive reasoning**: The insight generation and Monte Carlo parameter formulation require multi-step reasoning — connecting data patterns to business implications to simulation design. This is exactly what Opus 4.6 excels at.

3. **128K output tokens**: The simulation parameter JSON + insight analysis + recommendation can be substantial. Opus 4.6 can produce comprehensive analysis in a single response.

4. **Agentic workflow**: The system uses Opus 4.6 as a reasoning agent that drives a multi-step workflow (understand → visualize → analyze → simulate → recommend) rather than just answering questions.

---

## IMPLEMENTATION PRIORITIES

If time is limited, build in this order:

1. **CSV upload + Opus 4.6 auto-understanding** (MUST HAVE — this is the entry point)
2. **Auto-dashboard generation with chat refinement** (MUST HAVE — this is the visible wow factor)
3. **Monte Carlo simulation with visualization** (MUST HAVE — this is the differentiator)
4. **Proactive AI insights** (IMPORTANT — connects dashboards to Monte Carlo)
5. **Iterative scenario comparison** (NICE TO HAVE — side-by-side simulations)
6. **Sensitivity analysis / tornado chart** (NICE TO HAVE — adds analytical depth)

---

## EXISTING PROJECT CONTEXT

This project already has:
- A Vercel deployment pipeline (GitHub → Vercel, auto-deploy)
- CSV parser functionality
- Claude API connection (Opus 4.6)
- Monte Carlo simulation logic

The task is to restructure and connect these components into the unified flow described above, with the split-screen chat + dashboard UI as the primary interface.

---

## SUCCESS CRITERIA

The demo should show a judge this flow in under 3 minutes:
1. Upload a messy CSV → "wow, it understood my data instantly"
2. Click to generate dashboards → "the charts are relevant and interactive"
3. See AI insights pop up → "it found something I didn't notice"
4. Ask "what if?" → Monte Carlo runs → probability distribution appears → "this tells me whether my decision is worth the risk"
5. Refine via chat → "I can iterate on decisions conversationally"

The judge should walk away thinking: "This isn't just another dashboard tool. This is a decision engine."
