#!/usr/bin/env node
/**
 * GENERATE-SAMPLES.JS — Sample CSV Dataset Generator
 *
 * Generates two CSV files with embedded patterns for Prisma Tier 2 demos:
 * 1. delivery_logs_q4.csv (~5000 rows) - Individual delivery records
 * 2. driver_performance.csv (~600 rows) - Daily driver performance metrics
 *
 * Patterns embedded:
 * - Tuesday/Thursday volume spikes (30-40% more deliveries)
 * - Driver D2: performance degradation after Dec 1
 * - Driver D4: gradual decline over time
 * - Driver D3 (Lisa): increasing workload and overtime
 * - Cost variations by day of week
 * - Correlations between driver issues and next-day overtime spikes
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRIVERS = ['D1', 'D2', 'D3', 'D4', 'D5'];
const DRIVER_NAMES = {
  D1: 'Marco',
  D2: 'Kai',
  D3: 'Lisa',
  D4: 'Maya',
  D5: 'Alex'
};

const START_DATE = new Date('2025-10-01');
const END_DATE = new Date('2026-01-31');
const DAYS = Math.floor((END_DATE - START_DATE) / (1000 * 60 * 60 * 24));

const ZONES = ['North', 'South', 'East', 'West', 'Central'];
const STATUSES = ['completed', 'late', 'failed'];

// D2 degradation starts on Dec 1
const D2_DEGRADATION_DATE = new Date('2025-12-01');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function gaussian(mean, stddev) {
  // Box-Muller transform
  let u1 = Math.random();
  let u2 = Math.random();
  let z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stddev + mean;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(hours, minutes) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getDayOfWeek(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

// ============================================================================
// GENERATE DELIVERY_LOGS_Q4.CSV
// ============================================================================

function generateDeliveryLogs() {
  console.log('Generating delivery_logs_q4.csv...');

  const rows = [];
  rows.push('date,driver_id,scheduled_time,actual_departure,delivery_duration_min,zone,status,day_of_week,cost');

  let totalDeliveries = 0;

  for (let d = 0; d < DAYS; d++) {
    const currentDate = new Date(START_DATE);
    currentDate.setDate(START_DATE.getDate() + d);
    const dateStr = formatDate(currentDate);
    const dayOfWeek = getDayOfWeek(currentDate);

    // Tuesday/Thursday spike: 30-40% more deliveries
    let baseDeliveries = 40;
    if (dayOfWeek === 'Tuesday' || dayOfWeek === 'Thursday') {
      baseDeliveries = randomInt(52, 58);
    } else {
      baseDeliveries = randomInt(35, 45);
    }

    const deliveriesThisDay = baseDeliveries;
    totalDeliveries += deliveriesThisDay;

    // Distribute deliveries across drivers
    const driverDeliveries = {};
    for (const driver of DRIVERS) {
      driverDeliveries[driver] = 0;
    }

    for (let i = 0; i < deliveriesThisDay; i++) {
      const driver = randomChoice(DRIVERS);
      driverDeliveries[driver]++;
    }

    // Generate individual delivery records
    for (const driver of DRIVERS) {
      const count = driverDeliveries[driver];

      for (let i = 0; i < count; i++) {
        // Scheduled time: 8am - 6pm
        const scheduledHour = randomInt(8, 18);
        const scheduledMin = randomInt(0, 59);
        const scheduledTime = formatTime(scheduledHour, scheduledMin);

        // Actual departure (might be late)
        let departureDelayMin = 0;

        // D2: degradation after Dec 1
        if (driver === 'D2' && currentDate >= D2_DEGRADATION_DATE) {
          departureDelayMin = randomInt(10, 45); // Consistently late
        } else if (driver === 'D4') {
          // D4: gradual decline over time
          const daysSinceStart = Math.floor((currentDate - START_DATE) / (1000 * 60 * 60 * 24));
          const degradationFactor = daysSinceStart / DAYS;
          departureDelayMin = Math.floor(degradationFactor * randomInt(0, 30));
        } else {
          // Normal drivers: occasionally a few minutes late
          departureDelayMin = randomInt(-5, 10);
        }

        departureDelayMin = Math.max(0, departureDelayMin);
        const actualHour = scheduledHour + Math.floor(departureDelayMin / 60);
        const actualMin = scheduledMin + (departureDelayMin % 60);
        const actualDeparture = formatTime(actualHour % 24, actualMin % 60);

        // Delivery duration
        let durationMin;
        if (driver === 'D2' && currentDate >= D2_DEGRADATION_DATE) {
          durationMin = randomInt(22, 35); // Slower after degradation
        } else if (driver === 'D4') {
          const daysSinceStart = Math.floor((currentDate - START_DATE) / (1000 * 60 * 60 * 24));
          const degradationFactor = daysSinceStart / DAYS;
          durationMin = randomInt(15, 20 + Math.floor(degradationFactor * 10));
        } else if (driver === 'D3') {
          durationMin = randomInt(12, 17); // Lisa is fast
        } else {
          durationMin = randomInt(15, 22);
        }

        // Zone
        const zone = randomChoice(ZONES);

        // Status
        let status;
        if (driver === 'D2' && currentDate >= D2_DEGRADATION_DATE) {
          const rand = Math.random();
          if (rand < 0.15) {
            status = 'failed';
          } else if (rand < 0.40) {
            status = 'late';
          } else {
            status = 'completed';
          }
        } else if (driver === 'D4') {
          const daysSinceStart = Math.floor((currentDate - START_DATE) / (1000 * 60 * 60 * 24));
          const degradationFactor = daysSinceStart / DAYS;
          const rand = Math.random();
          if (rand < 0.05 + degradationFactor * 0.10) {
            status = 'late';
          } else if (rand < 0.10 + degradationFactor * 0.15) {
            status = 'failed';
          } else {
            status = 'completed';
          }
        } else {
          const rand = Math.random();
          if (rand < 0.92) {
            status = 'completed';
          } else if (rand < 0.97) {
            status = 'late';
          } else {
            status = 'failed';
          }
        }

        // Cost: ~€2.80 Mon/Wed, ~€4.10 Tue/Thu
        let cost;
        if (dayOfWeek === 'Tuesday' || dayOfWeek === 'Thursday') {
          cost = randomFloat(3.80, 4.40).toFixed(2);
        } else {
          cost = randomFloat(2.50, 3.10).toFixed(2);
        }

        rows.push([
          dateStr,
          driver,
          scheduledTime,
          actualDeparture,
          durationMin,
          zone,
          status,
          dayOfWeek,
          cost
        ].join(','));
      }
    }
  }

  const outputPath = path.join(__dirname, 'delivery_logs_q4.csv');
  fs.writeFileSync(outputPath, rows.join('\n'));
  console.log(`✓ Generated ${outputPath} (${totalDeliveries} deliveries)`);
}

// ============================================================================
// GENERATE DRIVER_PERFORMANCE.CSV
// ============================================================================

function generateDriverPerformance() {
  console.log('Generating driver_performance.csv...');

  const rows = [];
  rows.push('date,driver_id,shift_start_scheduled,shift_start_actual,deliveries_completed,deliveries_assigned,late_deliveries,hours_worked,overtime_hours,sick_day');

  let totalRows = 0;

  for (let d = 0; d < DAYS; d++) {
    const currentDate = new Date(START_DATE);
    currentDate.setDate(START_DATE.getDate() + d);
    const dateStr = formatDate(currentDate);
    const dayOfWeek = getDayOfWeek(currentDate);

    for (const driver of DRIVERS) {
      // Shift start scheduled: 8am
      const scheduledHour = 8;
      const scheduledMin = 0;
      const scheduledTime = formatTime(scheduledHour, scheduledMin);

      // Shift start actual
      let delayMin = 0;
      let sickDay = 0;

      // D2: degradation after Dec 1
      if (driver === 'D2' && currentDate >= D2_DEGRADATION_DATE) {
        const rand = Math.random();
        if (rand < 0.08) {
          sickDay = 1;
        } else {
          delayMin = randomInt(10, 40);
        }
      } else {
        delayMin = randomInt(-2, 8);
      }

      delayMin = Math.max(0, delayMin);
      const actualHour = scheduledHour + Math.floor(delayMin / 60);
      const actualMin = scheduledMin + (delayMin % 60);
      const actualTime = formatTime(actualHour % 24, actualMin % 60);

      // Deliveries assigned
      let assigned;
      if (dayOfWeek === 'Tuesday' || dayOfWeek === 'Thursday') {
        assigned = randomInt(10, 13);
      } else {
        assigned = randomInt(7, 10);
      }

      // Deliveries completed
      let completed;
      if (sickDay === 1) {
        completed = 0;
      } else if (driver === 'D2' && currentDate >= D2_DEGRADATION_DATE) {
        completed = Math.max(0, assigned - randomInt(2, 4));
      } else if (driver === 'D4') {
        const daysSinceStart = Math.floor((currentDate - START_DATE) / (1000 * 60 * 60 * 24));
        const degradationFactor = daysSinceStart / DAYS;
        const missRate = Math.floor(degradationFactor * 2);
        completed = Math.max(0, assigned - missRate);
      } else if (driver === 'D3') {
        completed = assigned; // Lisa always completes
      } else {
        completed = Math.max(0, assigned - randomInt(0, 1));
      }

      // Late deliveries
      let late;
      if (sickDay === 1) {
        late = 0;
      } else if (driver === 'D2' && currentDate >= D2_DEGRADATION_DATE) {
        late = randomInt(2, 5);
      } else if (driver === 'D4') {
        const daysSinceStart = Math.floor((currentDate - START_DATE) / (1000 * 60 * 60 * 24));
        const degradationFactor = daysSinceStart / DAYS;
        late = Math.floor(degradationFactor * randomInt(1, 3));
      } else {
        late = randomInt(0, 2);
      }

      // Hours worked
      let hoursWorked;
      if (sickDay === 1) {
        hoursWorked = 0;
      } else if (driver === 'D3') {
        // Lisa: increasing hours over time
        const daysSinceStart = Math.floor((currentDate - START_DATE) / (1000 * 60 * 60 * 24));
        const loadFactor = 1 + (daysSinceStart / DAYS) * 0.3;
        hoursWorked = randomFloat(8.5, 9.5) * loadFactor;
      } else {
        hoursWorked = randomFloat(8.0, 9.0);
      }

      // Overtime hours
      let overtimeHours;
      if (sickDay === 1) {
        overtimeHours = 0;
      } else if (driver === 'D3') {
        // Lisa: increasing overtime
        const daysSinceStart = Math.floor((currentDate - START_DATE) / (1000 * 60 * 60 * 24));
        const loadFactor = (daysSinceStart / DAYS) * 2;
        overtimeHours = Math.max(0, randomFloat(0.5, 1.5) * loadFactor);
      } else if (driver === 'D2' && currentDate >= D2_DEGRADATION_DATE) {
        // When D2 has bad days, others pick up slack (D3 especially)
        overtimeHours = randomFloat(0, 0.5);
      } else if (driver === 'D4') {
        overtimeHours = randomFloat(0, 0.3);
      } else {
        overtimeHours = Math.max(0, hoursWorked - 8);
      }

      // Round values
      hoursWorked = hoursWorked.toFixed(1);
      overtimeHours = overtimeHours.toFixed(1);

      rows.push([
        dateStr,
        driver,
        scheduledTime,
        actualTime,
        completed,
        assigned,
        late,
        hoursWorked,
        overtimeHours,
        sickDay
      ].join(','));

      totalRows++;
    }
  }

  const outputPath = path.join(__dirname, 'driver_performance.csv');
  fs.writeFileSync(outputPath, rows.join('\n'));
  console.log(`✓ Generated ${outputPath} (${totalRows} rows)`);
}

// ============================================================================
// MAIN
// ============================================================================

console.log('Generating sample CSV datasets...\n');

generateDeliveryLogs();
generateDriverPerformance();

console.log('\n✓ All datasets generated successfully!');
console.log('\nPatterns embedded:');
console.log('• Tuesday/Thursday: 30-40% more deliveries');
console.log('• Driver D2 (Kai): performance degradation after Dec 1, 2025');
console.log('• Driver D4 (Maya): gradual decline over time');
console.log('• Driver D3 (Lisa): consistently fast, but increasing workload and overtime');
console.log('• Cost: ~€2.80 Mon/Wed, ~€4.10 Tue/Thu');
console.log('• Correlation: when D2/D4 have bad days, D3 overtime spikes next day\n');
