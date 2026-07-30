// ============================================================
// REAL RUL MODEL (Python-trained, MetroPT-3)
// Loads the offline-trained network (model_weights.json) and
// feature scaler (scaler.json) produced by train_rul_model.py,
// and runs inference in plain JS — replicating the exact
// feature engineering used during training:
//   per sensor: value, rolling mean, rolling std, rolling slope
// ============================================================

let cache = null

// Dataset column → app sensor name (as created by add_metropt_machine.sql)
export const COL_TO_SENSOR = {
  TP2:             'TP2 Pressure',
  TP3:             'TP3 Pressure',
  H1:              'H1 Filter Drop',
  DV_pressure:     'DV Pressure',
  Reservoirs:      'Reservoir Pressure',
  Oil_temperature: 'Oil Temperature',
  Motor_current:   'Motor Current',
}

// ── Detect whether a machine matches the trained model ─────
export function isRealModelMachine(sensors) {
  if (!sensors?.length) return false
  const names = new Set(sensors.map(s => s.name))
  return Object.values(COL_TO_SENSOR).every(n => names.has(n))
}

// ── Raw sensor windows for the ML server (/predict-rul) ────
// The server owns feature engineering; we just ship the recent
// values per dataset column (oldest → newest).
export function buildRulWindows({ sensors, readingsBySensor }, win = 60) {
  const windows = {}
  for (const [col, appName] of Object.entries(COL_TO_SENSOR)) {
    const sensor = sensors.find(s => s.name === appName)
    let vals = []
    if (sensor) {
      const hist = readingsBySensor?.[sensor.id] || []
      vals = hist.slice(-win).map(r => parseFloat(r.value))
      if (!vals.length && sensor.current_value != null) vals = [parseFloat(sensor.current_value)]
    }
    windows[col] = vals
  }
  return windows
}

// ── Load model + scaler (once) ─────────────────────────────
export async function loadRealModel() {
  if (cache) return cache
  const [wRes, sRes] = await Promise.all([
    fetch('/rul_model/model_weights.json'),
    fetch('/rul_model/scaler.json'),
  ])
  if (!wRes.ok || !sRes.ok) throw new Error('Trained model files not found in /public/rul_model/')
  const weights = await wRes.json()
  const scaler  = await sRes.json()
  cache = { weights, scaler }
  return cache
}

// ── Rolling stats matching the Python pipeline ─────────────
function windowStats(values) {
  const v = values.filter(x => !isNaN(x))
  if (!v.length) return { val: 0, mean: 0, std: 0, slope: 0 }
  const val  = v[v.length - 1]
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  let std = 0
  if (v.length > 1) {
    const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1) // sample std (pandas default)
    std = Math.sqrt(variance)
  }
  let slope = 0
  if (v.length > 1) {
    const diffs = []
    for (let i = 1; i < v.length; i++) diffs.push(v[i] - v[i - 1])
    slope = diffs.reduce((a, b) => a + b, 0) / diffs.length
  }
  return { val, mean, std, slope }
}

// ── Forward pass through the exported dense layers ─────────
function forward(weights, x) {
  let a = x
  for (const layer of weights.layers) {
    const out = new Array(layer.bias.length)
    for (let j = 0; j < layer.bias.length; j++) {
      let s = layer.bias[j]
      for (let i = 0; i < a.length; i++) s += a[i] * layer.kernel[i][j]
      out[j] = layer.activation === 'relu' ? Math.max(0, s) : s
    }
    a = out
  }
  return a[0]
}

// ── Predict machine RUL from live sensor history ───────────
// sensors: app sensor rows; readingsBySensor: sensorId -> [{value,timestamp}]
export async function predictRealRUL({ sensors, readingsBySensor }) {
  const { weights, scaler } = await loadRealModel()

  // Build the feature vector in the exact training order:
  // for each sensor in scaler.sensors: val, mean, std, slope
  // Window size comes from training metadata (default 60 readings).
  const win = scaler.window || 60
  const features = []
  for (const col of scaler.sensors) {
    const appName = COL_TO_SENSOR[col]
    const sensor = sensors.find(s => s.name === appName)
    let vals = []
    if (sensor) {
      const hist = readingsBySensor?.[sensor.id] || []
      vals = hist.slice(-win).map(r => parseFloat(r.value))
      if (!vals.length && sensor.current_value != null) vals = [parseFloat(sensor.current_value)]
    }
    const { val, mean, std, slope } = windowStats(vals)
    features.push(val, mean, std, slope)
  }

  // Standardize with the training scaler
  const x = features.map((f, i) => (f - scaler.mean[i]) / (scaler.scale[i] || 1))

  // Inference
  const rawHours = forward(weights, x)
  const hours = Math.max(0, Math.min(scaler.rul_cap, rawHours))
  const days = hours / 24

  // Confidence derived from the model's test MAE relative to its range
  const confidence = Math.round(100 * (1 - scaler.metrics.mae_hours / scaler.rul_cap))

  return {
    hours: parseFloat(hours.toFixed(1)),
    days: parseFloat(days.toFixed(1)),
    confidence,
    modelVersion: 'metropt3-python-v1',
    metrics: scaler.metrics,
  }
}
