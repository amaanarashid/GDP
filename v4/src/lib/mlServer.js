// ============================================================
// ML SERVER CLIENT
// Talks to the Python FastAPI server (ml-server/).
// Change ML_SERVER_URL when deploying the Python service online.
// ============================================================

export const ML_SERVER_URL =
  import.meta.env.VITE_ML_SERVER_URL || 'http://localhost:8000'

async function jsonOrThrow(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `ML server error (${res.status})`)
  return data
}

// ── Health / availability ──────────────────────────────────
export async function mlHealth() {
  const res = await fetch(`${ML_SERVER_URL}/health`)
  return jsonOrThrow(res)
}

export async function mlAvailable() {
  try { await mlHealth(); return true } catch { return false }
}

// ── Anomaly detection (unsupervised, DB data) ──────────────
export async function trainAnomaly(machineId) {
  const res = await fetch(`${ML_SERVER_URL}/train-anomaly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ machine_id: machineId }),
  })
  return jsonOrThrow(res)
}

export async function detectAnomaly(machineId, values) {
  const res = await fetch(`${ML_SERVER_URL}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ machine_id: machineId, values }),
  })
  return jsonOrThrow(res)
}

// ── Dataset classification (supervised, CSV) ───────────────
export async function analyzeDataset(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${ML_SERVER_URL}/analyze`, { method: 'POST', body: fd })
  return jsonOrThrow(res)
}

export async function trainClassifier(file, machineId) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('machine_id', machineId)
  const res = await fetch(`${ML_SERVER_URL}/train`, { method: 'POST', body: fd })
  return jsonOrThrow(res)
}

// ── RUL with uncertainty (MetroPT-3 quantile models) ───────
// windows: { dataset_column: [recent values, oldest→newest] }
// Returns { rul_days, low_days, high_days, coverage_target, ... }
export async function predictRulRange(windows) {
  const res = await fetch(`${ML_SERVER_URL}/predict-rul`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ windows }),
  })
  return jsonOrThrow(res)
}

// ── Model evaluation on the held-out real test set ─────────
export async function evaluateRul(points = 400) {
  const res = await fetch(`${ML_SERVER_URL}/evaluate-rul?points=${points}`)
  return jsonOrThrow(res)
}

export async function evaluateDetector() {
  const res = await fetch(`${ML_SERVER_URL}/evaluate-detector`)
  return jsonOrThrow(res)
}

export async function predictRisk(machineId, values) {
  const res = await fetch(`${ML_SERVER_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ machine_id: machineId, values }),
  })
  return jsonOrThrow(res)
}
