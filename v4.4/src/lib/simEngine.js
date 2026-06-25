// ============================================================
// SIMULATION ENGINE
// Pure functions that compute the next sensor value given the
// sensor config, its current value, and any active faults.
// ============================================================

import { clamp } from '../utils/helpers'

// Gaussian-ish noise
function noise(amount) {
  return (Math.random() - 0.5) * 2 * amount
}

// Resolve the target value a fault drives a sensor toward
function faultTarget(sensor, toward) {
  const warn = parseFloat(sensor.warning_threshold)
  const crit = parseFloat(sensor.critical_threshold)
  if (toward === 'critical') return crit
  return warn
}

// Baseline (healthy) center value for a sensor
function baseline(sensor) {
  const lo = parseFloat(sensor.normal_min)
  const hi = parseFloat(sensor.normal_max)
  // Center of normal range, biased slightly low
  return lo + (hi - lo) * 0.45
}

// ── Compute next value for one sensor ──────────────────────
// sensor: row from DB (has thresholds, units, current_value)
// activeEffects: array of { mode, toward } currently hitting this sensor
// intensity: 0..1 ramp of how strongly faults apply
export function nextValue(sensor, activeEffects, intensity) {
  const base = baseline(sensor)
  const noiseAmt = (parseFloat(sensor.normal_max) - parseFloat(sensor.normal_min)) * 0.015

  // No fault → drift back toward baseline + noise
  if (!activeEffects || activeEffects.length === 0) {
    const cur = parseFloat(sensor.current_value ?? base)
    const next = cur + (base - cur) * 0.15 + noise(noiseAmt)
    return clampToSensor(sensor, next)
  }

  // Apply strongest fault effect
  let target = base
  let strongest = 0

  for (const eff of activeEffects) {
    const t = faultTarget(sensor, eff.toward)
    let effTarget = t
    // "spike" overshoots past threshold, "rise/drop" approaches it
    if (eff.mode === 'spike') {
      const crit = parseFloat(sensor.critical_threshold)
      effTarget = crit + (crit - base) * 0.15  // overshoot 15% past critical
    }
    const strength = eff.mode === 'spike' ? 1.0 : 0.7
    if (strength > strongest) { strongest = strength; target = effTarget }
  }

  const cur = parseFloat(sensor.current_value ?? base)
  // Lerp toward fault target scaled by intensity
  const goal = base + (target - base) * intensity
  const next = cur + (goal - cur) * 0.2 + noise(noiseAmt * 1.5)
  return clampToSensor(sensor, next)
}

function clampToSensor(sensor, val) {
  // Allow going a bit past critical for realism, but not absurd
  const lo = parseFloat(sensor.normal_min)
  const crit = parseFloat(sensor.critical_threshold)
  const hardMax = crit + (crit - lo) * 0.3
  // Oil Level / RPM / Belt Speed can go DOWN below normal_min
  const lowSensors = ['Oil Level', 'RPM', 'Belt Speed', 'Pressure', 'DC Bus Voltage']
  const hardMin = lowSensors.includes(sensor.name) ? Math.max(0, lo - (sensor.normal_max - lo) * 0.5) : lo * 0.8
  return clamp(parseFloat(val.toFixed(3)), hardMin, hardMax)
}

// ── Health degradation ─────────────────────────────────────
// Given a component's sensors and their severities, compute
// how much health should change this tick.
export function healthDelta(componentSensors, hasActiveFault) {
  let critical = 0, warning = 0
  for (const s of componentSensors) {
    const sev = sensorSeverityRaw(s)
    if (sev === 'critical') critical++
    else if (sev === 'warning') warning++
  }
  if (critical > 0) return -0.8 * critical      // fast degradation
  if (warning > 0)  return -0.25 * warning      // slow degradation
  if (!hasActiveFault) return +0.15             // slow self-recovery toward 100
  return 0
}

export function sensorSeverityRaw(sensor) {
  const v = parseFloat(sensor.current_value)
  if (isNaN(v)) return 'normal'
  if (sensor.name === 'Oil Level') {
    if (v <= sensor.critical_threshold) return 'critical'
    if (v <= sensor.warning_threshold)  return 'warning'
    return 'normal'
  }
  // Low-is-bad sensors
  if (['RPM', 'Belt Speed', 'Pressure', 'DC Bus Voltage'].includes(sensor.name)) {
    // For these, dropping below warning/critical (interpreted as low bound) is bad
    // but our thresholds are high-bound; treat drop below normal_min as severity
    const lo = parseFloat(sensor.normal_min)
    if (v < lo * 0.6) return 'critical'
    if (v < lo * 0.85) return 'warning'
  }
  if (v >= sensor.critical_threshold) return 'critical'
  if (v >= sensor.warning_threshold)  return 'warning'
  return 'normal'
}
