# PRISMA_DATA Schema Reference

This directory contains the PRISMA_DATA JSON schema — the contract between Prisma's AI engine (which generates decision intelligence data) and the dashboard (which visualizes it).

## Files

- **`prisma-data.example.json`** — Complete example using a delivery company scenario
- This README

## Schema Overview

PRISMA_DATA is a single JSON object with 9 top-level sections:

| Section | Purpose | Required |
|---------|---------|----------|
| `meta` | Decision title, summary, tier, timestamp | ✅ |
| `variables` | All decision variables with ranges and distributions | ✅ |
| `edges` | Causal relationships between variables | ✅ |
| `feedbackLoops` | Identified feedback loops (death spirals, virtuous cycles) | ✅ |
| `scenarios` | Decision options to compare (always include "do nothing") | ✅ |
| `outcome` | How to calculate success/failure | ✅ |
| `markov` | Markov chain configuration for state evolution over time | Optional |
| `recommendation` | What to do, what to watch, when to pivot | ✅ |
| `discoveries` | Data-driven insights (Tier 2 only) | Tier 2 only |

## Variable Structure

```json
{
  "id": "driver_count",              // Unique identifier (snake_case)
  "label": "Active Drivers",         // Human-readable name
  "value": 5,                        // Best estimate (center)
  "min": 5,                          // Lower bound
  "max": 5,                          // Upper bound
  "distribution": "fixed",           // Distribution type
  "unit": "drivers",                 // Display unit
  "isInput": false                   // Can user adjust with slider?
}
```

**Distribution types:**
- `fixed` — No uncertainty (min = value = max)
- `normal` — Bell curve centered on value
- `uniform` — Equally likely anywhere in range
- `right_skewed` — Clusters near min, long tail toward max
- `left_skewed` — Clusters near max, long tail toward min

## Edge Structure

```json
{
  "from": "driver_reliability",      // Source variable id
  "to": "late_deliveries",           // Target variable id
  "effect": "negative",              // "positive" | "negative"
  "strength": 0.90,                  // Impact multiplier (0-1)
  "formula": "late_deliveries = (1 - driver_reliability) * 25 + delivery_time_avg * 0.3",
  "isFeedbackLoop": true             // Is this edge part of a loop?
}
```

**Effect types:**
- `positive` — When source increases, target increases
- `negative` — When source increases, target decreases

**Formula (optional):**
- If provided, engines use this explicit calculation
- If omitted, engines infer relationship from effect + strength
- Use JavaScript expression syntax
- Can reference any variable by id

## Scenario Structure

```json
{
  "id": "hire_two_drivers",          // Unique identifier
  "label": "Hire 2 New Drivers",     // Human-readable name
  "color": "#10b981",                // Hex color for charts
  "changes": {                       // Variable overrides
    "driver_count": {
      "value": 7,                    // Set new value
      "min": 7,
      "max": 7
    },
    "monthly_driver_cost": {
      "delta": 6400                  // Add delta to baseline
    }
  },
  "assumptions": [                   // List of assumptions
    "New drivers are trained and reliable (85%+ reliability rate)",
    "Hiring cost amortized over 12 months (€1,200 per driver)"
  ]
}
```

**Changes can use:**
- `value` / `min` / `max` — Override baseline
- `delta` — Add to baseline value

## Markov Chain Structure

Models how entities transition between states over time.

```json
{
  "enabled": true,
  "months": 12,                      // Simulation horizon
  "entities": [
    {
      "id": "driver_kai",
      "label": "Driver Kai (Currently Unreliable)",
      "initialState": "unreliable",
      "states": ["reliable", "unreliable", "burned_out", "quit"],
      "transitions": {
        "unreliable": {              // From state "unreliable"
          "reliable": 0.15,          // 15% chance → reliable
          "unreliable": 0.55,        // 55% chance → stay unreliable
          "burned_out": 0.25,        // 25% chance → burned_out
          "quit": 0.05               // 5% chance → quit
        }
        // (each row must sum to 1.0)
      },
      "scenarioTransitions": {
        "hire_two_drivers": {
          "unreliable": {
            "reliable": 0.40,        // Better odds under this scenario
            "unreliable": 0.45,
            "burned_out": 0.12,
            "quit": 0.03
          }
        }
      }
    }
  ],
  "stateEffects": {
    "driver_kai.unreliable": {       // When Kai is unreliable
      "driver_reliability": -0.04,   // Overall reliability drops 4%
      "late_deliveries": 4           // Late deliveries increase by 4%
    }
  }
}
```

## Recommendation Structure

```json
{
  "action": "Hire 2 new drivers immediately. The death spiral is real...",
  "watch": "Monitor driver overtime hours and Tuesday/Thursday delivery rates...",
  "trigger": "If daily orders drop below 65 for 2 consecutive weeks, hire 1 instead of 2..."
}
```

**Three critical outputs:**
1. **Action** — WHAT TO DO (clear, decisive recommendation)
2. **Watch** — WHAT TO WATCH (1-2 key variables to monitor)
3. **Trigger** — WHEN TO CHANGE YOUR MIND (specific conditions to pivot)

## Tier 1 vs. Tier 2

| Feature | Tier 1 | Tier 2 |
|---------|--------|--------|
| **Data source** | Conversation only | Conversation + uploaded data |
| **Distributions** | Estimated | Calculated from real data |
| **Discoveries** | Empty array | 3-5 insights from data analysis |
| **Confidence** | Wide bands | Narrow bands |

Tier 2 runs Python analysis on CSV/Excel files to extract:
- Real distributions (mean, std, min, max)
- Correlations between variables
- Patterns and anomalies

## Engine Requirements

All three engines (Carlo, Markov, Nassim) must be able to:
1. Parse this JSON structure
2. Run simulations based on the causal graph
3. Output results compatible with Plotly.js and Canvas API
4. Execute entirely client-side (no server dependencies)

## Example Use Case

The included example (`prisma-data.example.json`) models:
- **Decision:** Should a delivery company hire drivers, optimize routes, or do nothing?
- **Variables:** 13 variables (drivers, reliability, costs, satisfaction, etc.)
- **Edges:** 11 causal relationships (including 2 feedback loop edges)
- **Feedback Loops:** Death spiral (overtime → burnout) and virtuous cycle (satisfaction → revenue)
- **Scenarios:** Hire 2 drivers, restructure routes, do nothing
- **Markov:** Track 2 unreliable drivers over 12 months
- **Recommendation:** Hire immediately, watch overtime, pivot trigger at 65 deliveries/day

## Validation

To validate a PRISMA_DATA file:

```bash
python3 -c "import json; json.load(open('your-file.json')); print('Valid JSON')"
```

For schema validation (once schema definition exists):
```bash
# TODO: Create JSON Schema definition and validate against it
```

## Next Steps

1. Build Carlo engine to consume this format
2. Build Markov engine to run state transitions
3. Build Nassim engine to classify fragility and run sensitivity
4. Build dashboard template to visualize everything
5. Test with this example data
