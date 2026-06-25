// ============================================================
// FEATURE ENGINEERING for RUL model
// Turns a window of sensor readings into numeric features.
// ============================================================

// Linear regression slope (trend) over an array of values
export function trendSlope(values) {
  const n = values.length
  if (n < 2) return 0
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean)
    den += (i - xMean) ** 2
  }
  return den === 0 ? 0 : num / den
}

export function mean(values) {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function std(values) {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// Normalize a sensor value to 0..1 based on its range
function normalize(value, lo, hi) {
  if (hi === lo) return 0
  return Math.max(0, Math.min(1, (value - lo) / (hi - lo)))
}

// ── Extract features for ONE sensor ────────────────────────
// readings: array of numbers (oldest → newest)
// sensor: { normal_min, normal_max, warning_threshold, critical_threshold, name }
export function sensorFeatures(readings, sensor) {
  const lo = parseFloat(sensor.normal_min)
  const hi = parseFloat(sensor.critical_threshold)
  const warn = parseFloat(sensor.warning_threshold)

  if (!readings || readings.length === 0) {
    return { mean: 0, std: 0, slope: 0, last: 0, timeAboveWarn: 0, pctOfCritical: 0 }
  }

  const m = mean(readings)
  const s = std(readings)
  const slope = trendSlope(readings)
  const last = readings[readings.length - 1]

  // fraction of readings above warning threshold
  const isOilLevel = sensor.name === 'Oil Level'
  const aboveWarn = readings.filter(v => isOilLevel ? v <= warn : v >= warn).length / readings.length

  return {
    mean: normalize(m, lo, hi),
    std: Math.min(1, s / (hi - lo)),
    slope: Math.max(-1, Math.min(1, slope / ((hi - lo) / 50))), // scaled
    last: normalize(last, lo, hi),
    timeAboveWarn: aboveWarn,
    pctOfCritical: isOilLevel
      ? 1 - normalize(last, parseFloat(sensor.critical_threshold), parseFloat(sensor.normal_max))
      : normalize(last, lo, hi),
  }
}

// ── Aggregate features for a COMPONENT (its sensors) ───────
// Returns a fixed-length feature vector for the model.
export function componentFeatures(componentSensors, readingsBySensor) {
  let aggMean = 0, aggStd = 0, aggSlope = 0, aggLast = 0, aggAboveWarn = 0, aggCrit = 0
  let worstCrit = 0
  const n = componentSensors.length || 1

  componentSensors.forEach(sensor => {
    const readings = (readingsBySensor[sensor.id] || []).map(r => r.value)
    const f = sensorFeatures(readings, sensor)
    aggMean += f.mean
    aggStd += f.std
    aggSlope += f.slope
    aggLast += f.last
    aggAboveWarn += f.timeAboveWarn
    aggCrit += f.pctOfCritical
    worstCrit = Math.max(worstCrit, f.pctOfCritical)
  })

  return [
    aggMean / n,
    aggStd / n,
    aggSlope / n,
    aggLast / n,
    aggAboveWarn / n,
    aggCrit / n,
    worstCrit,
    Math.min(1, n / 4), // component complexity
  ]
}

export const FEATURE_COUNT = 8
