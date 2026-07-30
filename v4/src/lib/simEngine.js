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
  const hi = parseFloat(sensor.normal_max)
  const warn = parseFloat(sensor.warning_threshold)
  const crit = parseFloat(sensor.critical_threshold)

  // Inverted sensors (LOW = bad, e.g. Oil Level): thresholds sit BELOW
  // the normal range. Danger direction is DOWN, so the floor is a bit
  // past critical and the ceiling is a bit above the normal range.
  // (Without this branch, hardMax computed from crit pins the value
  // below critical and the component faults with no injection.)
  if (crit < warn) {
    const hardMin = Math.max(0, crit - (lo - crit) * 0.3)
    const hardMax = hi + (hi - lo) * 0.1
    return clamp(parseFloat(val.toFixed(3)), hardMin, hardMax)
  }

  // Standard sensors (HIGH = bad)
  const hardMax = crit + (crit - lo) * 0.3
  // These can also drop below normal_min when faults drive them down
  const lowSensors = ['Oil Level', 'RPM', 'Belt Speed', 'Pressure', 'DC Bus Voltage']
  const hardMin = lowSensors.includes(sensor.name) ? Math.max(0, lo - (hi - lo) * 0.5) : lo * 0.8
  return clamp(parseFloat(val.toFixed(3)), hardMin, hardMax)
}

// ── Health degradation ─────────────────────────────────────
// Given a component's sensors and their severities, compute
// how much health should change this tick.
//
// Design: health NEVER self-recovers — only completing maintenance
// restores it (that's the whole point of a maintenance app). With no
// faults, components still lose health slowly through baseline wear,
// which grows with machine runtime (older machines wear faster) and
// varies per component so the fleet doesn't degrade in lockstep.

const WEAR_BASE = 0.02           // health lost per tick when running normally
const WEAR_AGE_HOURS = 800       // runtime hours to double the wear rate
const WEAR_AGE_CAP = 3           // wear never exceeds 3x base from age

// Deterministic per-component variation (0.7–1.3) from its id,
// so the same component always wears at the same relative rate.
export function wearFactor(componentId) {
  let h = 0
  const s = String(componentId)
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  h = (((h ^ (h >>> 13)) * 2654435761) >>> 0)   // avalanche so similar ids differ
  return 0.7 + (h % 1000) / 1000 * 0.6
}

export function healthDelta(componentSensors, hasActiveFault, runtimeHours = 0, componentId = '') {
  let critical = 0, warning = 0
  for (const s of componentSensors) {
    const sev = sensorSeverityRaw(s)
    if (sev === 'critical') critical++
    else if (sev === 'warning') warning++
  }
  if (critical > 0) return -0.8 * critical      // fast degradation
  if (warning > 0)  return -0.25 * warning      // slow degradation
  if (hasActiveFault) return 0                  // fault active but sensors not over thresholds yet

  // Normal running: baseline wear, accelerated by machine age
  const ageFactor = Math.min(WEAR_AGE_CAP, 1 + (runtimeHours || 0) / WEAR_AGE_HOURS)
  return -WEAR_BASE * ageFactor * wearFactor(componentId)
}

export function sensorSeverityRaw(sensor) {
  const v = parseFloat(sensor.current_value)
  if (isNaN(v)) return 'normal'

  const warn = parseFloat(sensor.warning_threshold)
  const crit = parseFloat(sensor.critical_threshold)

  // Inverted sensors: warning/critical thresholds are BELOW normal range,
  // meaning a DROP in value is the failure (e.g. Oil Level, pressure loss
  // from an air leak — TP3, Reservoir Pressure). Detect by crit < warn.
  if (crit < warn) {
    if (v <= crit) return 'critical'
    if (v <= warn) return 'warning'
    return 'normal'
  }

  // Named low-is-bad sensors that use normal_min as the reference
  if (['RPM', 'Belt Speed', 'DC Bus Voltage'].includes(sensor.name)) {
    const lo = parseFloat(sensor.normal_min)
    if (v < lo * 0.6) return 'critical'
    if (v < lo * 0.85) return 'warning'
  }

  // Standard high-is-bad
  if (v >= crit) return 'critical'
  if (v >= warn) return 'warning'
  return 'normal'
}
