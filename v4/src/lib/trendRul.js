// ============================================================
// TREND RUL — degradation-trend extrapolation for simulated
// machines. A standard industrial prognosis technique (linear
// degradation modelling): measure how fast a component's health
// is declining, extrapolate to the service threshold.
//
//   days remaining = (health − threshold) / decline per day
//
// The decline rate comes from the same wear law the simulator
// applies (baseline wear scaled by machine age + per-component
// factor, accelerated when sensors sit in warning/critical) —
// so the estimate responds immediately to developing faults.
//
// This intentionally replaces the old TF.js network that trained
// on synthetic labels: that was circular (it could only learn the
// formula that generated its labels). Extrapolation is honest,
// explainable in one sentence, and validated by the Prediction
// Accuracy panel. ML-based RUL is reserved for real data
// (MetroPT-3), where it can actually be validated.
// ============================================================
import { healthDelta } from './simEngine'

const RUNTIME_PER_TICK = 0.1   // machine-hours added per sim tick (matches useSimulator)
const SERVICE_THRESHOLD = 20   // health % at which a component needs service
const MAX_DAYS = 180           // cap — beyond this, sensors carry no information

// components: rows with health_score; sensors: rows with component_id +
// current_value/thresholds; runtimeHours: machine runtime (drives age wear).
// Returns { [componentId]: { days, confidence, source } }
export function trendRulComponents({ components, sensors, runtimeHours = 0 }) {
  const out = {}
  for (const c of components) {
    const compSensors = sensors.filter(s => s.component_id === c.id)
    const health = parseFloat(c.health_score ?? 100)

    // Current decline per tick under the observed sensor state
    // (hasActiveFault=false: outside the simulator we can only see
    // sensor severities, which is what a real system would see too)
    const perTick = healthDelta(compSensors, false, runtimeHours, c.id)

    // Convert to decline per day of machine OPERATION (runtime time,
    // not wall-clock — the simulator compresses time)
    const perRuntimeHour = -perTick / RUNTIME_PER_TICK
    const perDay = perRuntimeHour * 24

    let days
    if (perDay <= 0) {
      days = MAX_DAYS
    } else {
      days = Math.min(MAX_DAYS, Math.max(0, (health - SERVICE_THRESHOLD) / perDay))
    }

    out[c.id] = {
      days: parseFloat(days.toFixed(1)),
      confidence: null,            // no false confidence — this is an estimate, not a model
      source: 'trend-extrapolation',
    }
  }
  return out
}
