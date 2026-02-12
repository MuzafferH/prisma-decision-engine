/**
 * DEMO_DATA.JS — Hardcoded PRISMA_DATA for Demo Mode
 *
 * This is the insurance for the demo recording. If the API fails or ?demo=true,
 * the full dashboard loads with this data.
 *
 * Scenario: A delivery company deciding whether to hire new drivers or restructure routes
 */

const DEMO_DATA = {
  meta: {
    title: "Should I hire new drivers or restructure routes?",
    summary: "A last-mile delivery company with 5 drivers handling 80 deliveries/day faces reliability issues. Deciding between hiring, route optimization, or maintaining status quo.",
    tier: 1,
    generatedAt: "2026-02-11T14:30:00Z"
  },

  variables: [
    {
      id: "driver_count",
      label: "Active Drivers",
      value: 5,
      min: 5,
      max: 5,
      distribution: "fixed",
      unit: "drivers",
      isInput: false
    },
    {
      id: "daily_deliveries",
      label: "Daily Deliveries",
      value: 80,
      min: 60,
      max: 110,
      distribution: "normal",
      unit: "deliveries/day",
      isInput: true
    },
    {
      id: "driver_reliability",
      label: "Driver Reliability Rate",
      value: 0.77,
      min: 0.5,
      max: 0.95,
      distribution: "normal",
      unit: "%",
      isInput: false
    },
    {
      id: "delivery_time_avg",
      label: "Avg Delivery Time",
      value: 18,
      min: 12,
      max: 28,
      distribution: "normal",
      unit: "minutes",
      isInput: true
    },
    {
      id: "cost_per_delivery",
      label: "Cost per Delivery",
      value: 2.80,
      min: 2.40,
      max: 3.60,
      distribution: "normal",
      unit: "€",
      isInput: false
    },
    {
      id: "monthly_driver_cost",
      label: "Monthly Cost per Driver",
      value: 3200,
      min: 3000,
      max: 3400,
      distribution: "normal",
      unit: "€/driver",
      isInput: false
    },
    {
      id: "fuel_cost_monthly",
      label: "Monthly Fuel Cost",
      value: 2000,
      min: 1600,
      max: 2800,
      distribution: "right_skewed",
      unit: "€/month",
      isInput: false
    },
    {
      id: "overtime_hours_weekly",
      label: "Overtime Hours per Week",
      value: 12,
      min: 0,
      max: 30,
      distribution: "right_skewed",
      unit: "hours/week",
      isInput: false
    },
    {
      id: "customer_satisfaction",
      label: "Customer Satisfaction Score",
      value: 4.1,
      min: 3.2,
      max: 4.8,
      distribution: "normal",
      unit: "/5",
      isInput: false
    },
    {
      id: "monthly_revenue",
      label: "Monthly Revenue",
      value: 28800,
      min: 22000,
      max: 38000,
      distribution: "normal",
      unit: "€/month",
      isInput: false
    },
    {
      id: "late_deliveries_pct",
      label: "Late Deliveries",
      value: 0.23,
      min: 0.02,
      max: 0.45,
      distribution: "right_skewed",
      unit: "%",
      isInput: false
    },
    {
      id: "capacity_utilization",
      label: "Fleet Capacity Utilization",
      value: 0.92,
      min: 0.60,
      max: 1.0,
      distribution: "normal",
      unit: "%",
      isInput: false
    }
  ],

  edges: [
    {
      from: "driver_count",
      to: "capacity_utilization",
      effect: "negative",
      strength: 0.85,
      formula: "capacity_utilization = daily_deliveries / (driver_count * 18)",
      isFeedbackLoop: false
    },
    {
      from: "driver_count",
      to: "overtime_hours_weekly",
      effect: "negative",
      strength: 0.75,
      formula: "overtime_hours_weekly = Math.max(0, (daily_deliveries - driver_count * 15) * 0.8)",
      isFeedbackLoop: false
    },
    {
      from: "driver_reliability",
      to: "late_deliveries_pct",
      effect: "negative",
      strength: 0.90,
      formula: "late_deliveries_pct = (1 - driver_reliability) * 0.25 + delivery_time_avg * 0.003",
      isFeedbackLoop: true
    },
    {
      from: "late_deliveries_pct",
      to: "customer_satisfaction",
      effect: "negative",
      strength: 0.80,
      formula: "customer_satisfaction = 4.8 - late_deliveries_pct * 3.2",
      isFeedbackLoop: false
    },
    {
      from: "customer_satisfaction",
      to: "monthly_revenue",
      effect: "positive",
      strength: 0.85,
      formula: "monthly_revenue = daily_deliveries * 30 * 10 * (customer_satisfaction / 5)",
      isFeedbackLoop: false
    },
    {
      from: "overtime_hours_weekly",
      to: "driver_reliability",
      effect: "negative",
      strength: 0.70,
      formula: "driver_reliability = 0.95 - (overtime_hours_weekly / 30) * 0.35",
      isFeedbackLoop: true
    },
    {
      from: "daily_deliveries",
      to: "overtime_hours_weekly",
      effect: "positive",
      strength: 0.65,
      formula: null,
      isFeedbackLoop: false
    },
    {
      from: "fuel_cost_monthly",
      to: "cost_per_delivery",
      effect: "positive",
      strength: 0.55,
      formula: "cost_per_delivery = 1.80 + (fuel_cost_monthly / (daily_deliveries * 30)) + (monthly_driver_cost * driver_count / (daily_deliveries * 30))",
      isFeedbackLoop: false
    },
    {
      from: "delivery_time_avg",
      to: "capacity_utilization",
      effect: "positive",
      strength: 0.60,
      formula: null,
      isFeedbackLoop: false
    }
  ],

  feedbackLoops: [
    {
      path: ["driver_reliability", "late_deliveries_pct", "overtime_hours_weekly", "driver_reliability"],
      type: "negative",
      label: "Death Spiral: Unreliable Drivers → Late Deliveries → Overtime → Burnout"
    }
  ],

  scenarios: [
    {
      id: "hire_two_drivers",
      label: "Hire 2 New Drivers",
      color: "#4caf50",
      changes: {
        driver_count: {
          value: 7,
          min: 7,
          max: 7
        },
        daily_deliveries: {
          value: 100,
          min: 80,
          max: 130
        },
        overtime_hours_weekly: {
          value: 4,
          min: 0,
          max: 12
        },
        driver_reliability: {
          value: 0.88,
          min: 0.75,
          max: 0.95
        }
      },
      assumptions: [
        "New drivers are trained and reliable (85%+ reliability rate)",
        "Hiring cost amortized over 12 months (€1,200 per driver)",
        "Reduced workload improves existing driver morale and reliability",
        "Overtime drops by ~65% due to better capacity",
        "Training period is 2 weeks with minimal impact"
      ]
    },
    {
      id: "restructure_routes",
      label: "Restructure Routes",
      color: "#ffa726",
      changes: {
        delivery_time_avg: {
          value: 15.3,
          min: 10,
          max: 24,
          delta: -2.7
        },
        cost_per_delivery: {
          value: 2.52,
          min: 2.10,
          max: 3.20,
          delta: -0.28
        },
        fuel_cost_monthly: {
          value: 1700,
          min: 1400,
          max: 2400,
          delta: -300
        }
      },
      assumptions: [
        "Route optimization software cost: €450/month (included in cost savings)",
        "15% improvement in delivery time from optimized routes",
        "10% reduction in cost per delivery from fuel savings",
        "Implementation takes 1 week with 10% temporary efficiency loss",
        "Requires driver retraining on new routes (1-2 days per driver)"
      ]
    },
    {
      id: "do_nothing",
      label: "Do Nothing",
      color: "#ef5350",
      changes: {
        daily_deliveries: {
          value: 70,
          min: 50,
          max: 90
        },
        driver_reliability: {
          value: 0.60,
          min: 0.35,
          max: 0.75
        },
        overtime_hours_weekly: {
          value: 20,
          min: 12,
          max: 35
        }
      },
      assumptions: [
        "Current trends continue with no intervention",
        "Driver reliability continues to decline at ~2% per month",
        "Overtime increases by 1.5 hours per week per month",
        "Customer satisfaction drops 0.15 points every 2 months",
        "Risk of losing customers to competitors increases"
      ]
    }
  ],

  outcome: {
    id: "monthly_profit_delta",
    label: "Monthly Profit Change",
    unit: "€/month",
    formula: "(daily_deliveries * 30 * 20) - (cost_per_delivery * daily_deliveries * 30) - (monthly_driver_cost * driver_count) - fuel_cost_monthly",
    positiveLabel: "Profit Gain",
    negativeLabel: "Profit Loss"
  },

  recommendation: {
    action: "Hire 2 new drivers immediately. The death spiral is real — every week you wait, driver reliability drops further and overtime increases. Current trajectory shows high probability that Driver Kai quits within 3 months under status quo.",
    watch: "Monitor driver overtime hours and Tuesday/Thursday delivery completion rates (historically your worst days). Track customer satisfaction scores weekly. Watch for any driver exceeding 15 hours overtime per week — that's your early warning signal.",
    trigger: "If daily order volume drops below 65 deliveries for 2 consecutive weeks, pivot to hiring only 1 driver instead of 2. If route optimization can be implemented within 2 weeks, consider doing both interventions simultaneously for maximum impact."
  },

  // Discoveries are empty for Tier 1 (but include commented example for reference)
  discoveries: [
    // Example discovery (commented out for Tier 1 demo):
    // {
    //   title: "Tuesday/Thursday Delivery Time Anomaly",
    //   description: "Delivery times are 23% longer on Tuesdays and Thursdays compared to other weekdays. This suggests route inefficiency or scheduling issues specific to mid-week operations, not just capacity constraints.",
    //   impact: "medium",
    //   type: "pattern"
    // }
  ]
};
