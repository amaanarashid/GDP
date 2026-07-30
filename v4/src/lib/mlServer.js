// ============================================================
// ML SERVER CLIENT
// Talks to the Python FastAPI server (ml-server/).
//
// The server address is resolved at RUNTIME, in this order:
//   1. ?ml=https://...   URL parameter (also remembered after)
//   2. a previously remembered address (localStorage)
//   3. VITE_ML_SERVER_URL   (build-time, set in Vercel)
//   4. http://localhost:8000   (local development default)
//
// Why runtime: when the Python server is exposed through a
// temporary tunnel (cloudflared/ngrok) the address changes on
// every restart. Resolving at runtime means you paste the new
// address into the URL once instead of rebuilding the site.
//   e.g.  https://your-app.vercel.app/model?ml=https://abc.trycloudflare.com
// Clear it again with  ?ml=reset
// ============================================================

function resolveMlServerUrl() {
  const strip = u => String(u).trim().replace(/\/+$/, '')
  try {
    const param = new URLSearchParams(window.location.search).get('ml')
    if (param === 'reset') {
      localStorage.removeItem('mlServerUrl')
    } else if (param) {
      localStorage.setItem('mlServerUrl', strip(param))
      return strip(param)
    }
    const saved = localStorage.getItem('mlServerUrl')
    if (saved) return strip(saved)
  } catch {
    // localStorage unavailable (private mode) — fall through to env
  }
  return strip(import.meta.env.VITE_ML_SERVER_URL || 'http://localhost:8000')
}

export const ML_SERVER_URL = resolveMlServerUrl()

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
