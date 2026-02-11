# Sample Datasets for Prisma Tier 2 Demo

This directory contains sample CSV datasets for demonstrating Prisma's Tier 2 analysis capabilities.

## Generating the Datasets

```bash
node generate-samples.js
```

This will create two CSV files:

### 1. delivery_logs_q4.csv (~5000 rows)

Individual delivery records from Oct 1, 2025 to Jan 31, 2026.

**Columns:**
- `date` - Delivery date (YYYY-MM-DD)
- `driver_id` - Driver identifier (D1-D5)
- `scheduled_time` - Scheduled departure time (HH:MM)
- `actual_departure` - Actual departure time (HH:MM)
- `delivery_duration_min` - Duration in minutes
- `zone` - Delivery zone (North/South/East/West/Central)
- `status` - Delivery status (completed/late/failed)
- `day_of_week` - Day of the week
- `cost` - Cost per delivery (€)

**Embedded Patterns:**
- **Tuesday/Thursday spike**: 30-40% more deliveries on these days
- **Driver D2 (Kai)**: Performance degradation after Dec 1, 2025 (more late starts, more failures)
- **Driver D4 (Maya)**: Gradual decline over time (increasing delivery duration, more failures)
- **Driver D3 (Lisa)**: Consistently fast delivery times
- **Cost pattern**: ~€2.80 Mon/Wed, ~€4.10 Tue/Thu

### 2. driver_performance.csv (~600 rows)

Daily performance metrics for each driver (5 drivers × ~120 days).

**Columns:**
- `date` - Date (YYYY-MM-DD)
- `driver_id` - Driver identifier (D1-D5)
- `shift_start_scheduled` - Scheduled shift start (HH:MM)
- `shift_start_actual` - Actual shift start (HH:MM)
- `deliveries_completed` - Number of deliveries completed
- `deliveries_assigned` - Number of deliveries assigned
- `late_deliveries` - Number of late deliveries
- `hours_worked` - Total hours worked
- `overtime_hours` - Overtime hours
- `sick_day` - Binary (0=working, 1=sick)

**Embedded Patterns:**
- **Driver D2 (Kai)**: Breakpoint on Dec 1 - late starts increase, more sick days
- **Driver D4 (Maya)**: Gradual decline - deliveries_completed per hour decreasing
- **Driver D3 (Lisa)**: hours_worked trending up, overtime increasing over time
- **Correlation**: When D2 or D4 have bad days, D3's overtime spikes the next day

## Driver Personas

- **D1 (Marco)**: Stable and reliable throughout
- **D2 (Kai)**: Normal until Dec 1, then degrades sharply (burnout scenario)
- **D3 (Lisa)**: Consistently high performer but taking on increasing workload
- **D4 (Maya)**: Gradual performance decline (progressive burnout)
- **D5 (Alex)**: Stable and reliable throughout

## Usage in Prisma

When users upload these CSVs to Prisma:

1. **CSV Analyzer** (client-side) will detect:
   - Statistical distributions for each numeric column
   - Weekday patterns (Tuesday/Thursday anomaly)
   - Trends (comparing first half vs second half of data)
   - Breakpoints (sharp changes like D2's Dec 1 degradation)

2. **Prisma's analysis** will:
   - Replace estimated distributions with real data
   - Identify the death spiral pattern (reliability → overtime → burnout)
   - Flag hidden correlations (D2/D4 issues → D3 overtime)
   - Present discoveries the user didn't explicitly ask about
   - Generate sharper Monte Carlo simulations with narrower confidence bands

## Testing the Analyzer

```javascript
// In browser console after uploading
const analysis = CSVAnalyzer.analyze(parsedData, 'delivery_logs_q4.csv');
console.log(CSVAnalyzer.formatForChat(analysis));
```

You should see output like:
```
📊 Uploaded: delivery_logs_q4.csv (5023 rows)

Key statistics:
• delivery_duration_min: mean=18.45, median=18.00, range=[12.00, 35.00]
• cost: mean=3.12, median=2.95, range=[2.50, 4.40]

Weekday patterns detected:
• cost: Thursday is 42% higher than Monday

Trends detected:
• delivery_duration_min: ↑ up trend (12.3% change)

Breakpoints detected:
• deliveries_completed: decreased around row 2450 (18.5% shift)
```
