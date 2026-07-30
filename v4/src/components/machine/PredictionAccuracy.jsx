// ============================================================
// PREDICTION ACCURACY — predicted vs actual
// Closes the loop on RUL: every prediction ever written to
// rul_predictions is compared against what actually happened
// (critical alerts = "failure events").
//
// For each failure event, any prediction made BEFORE it can be
// scored: actual RUL = time between the prediction and the event.
// Predictions with no event yet are "unvalidated" (the machine
// simply hasn't failed — that's information too).
// ============================================================
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format } from 'date-fns'
import { Target } from 'lucide-react'
import { getRulPredictionHistory } from '../../lib/maintenanceData'

const DAY_MS = 24 * 3600 * 1000
// Only score predictions made within this window before a failure —
// a "90 days left" guess made 5 minutes before a fault isn't the
// same claim as one made a week out.
const MAX_LOOKBACK_DAYS = 30

export default function PredictionAccuracy({ machineId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    getRulPredictionHistory(machineId)
      .then(d => { if (live) setData(d) })
      .catch(e => { if (live) setError(e) })
    return () => { live = false }
  }, [machineId])

  if (error) return null
  if (!data) {
    return <div className="card text-xs text-gray-500">Loading prediction history…</div>
  }

  const { predictions, failureEvents } = data
  if (!predictions.length) {
    return (
      <div className="card text-xs text-gray-500">
        No stored predictions yet — open this machine while it runs to accumulate RUL history.
      </div>
    )
  }

  // ── Machine-level series: min predicted RUL per prediction batch ──
  // (predictions are written per component; the minimum is what a
  // planner would act on)
  const byTime = new Map()
  for (const p of predictions) {
    if (p.days_remaining == null) continue
    const t = new Date(p.timestamp).getTime()
    const cur = byTime.get(t)
    if (cur == null || p.days_remaining < cur) byTime.set(t, parseFloat(p.days_remaining))
  }
  const series = [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, days]) => ({ t, predicted: days }))

  // ── Score predictions against failure events ──
  const eventTimes = failureEvents.map(e => new Date(e.created_at).getTime())
  const scored = []
  for (const pt of series) {
    // first failure event AFTER this prediction
    const ev = eventTimes.find(t => t > pt.t)
    if (ev == null) continue
    const actualDays = (ev - pt.t) / DAY_MS
    if (actualDays > MAX_LOOKBACK_DAYS) continue
    scored.push({ ...pt, actual: actualDays, error: Math.abs(pt.predicted - actualDays) })
  }
  const mae = scored.length
    ? scored.reduce((a, s) => a + s.error, 0) / scored.length
    : null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <Target className="w-4 h-4" /> Prediction accuracy
        </h2>
        <div className="text-xs text-gray-500">
          {scored.length
            ? <>validated against {eventTimes.length} failure event{eventTimes.length > 1 ? 's' : ''} · MAE <span className="text-gray-900 font-medium">{mae.toFixed(1)} d</span></>
            : `no failure events yet — ${series.length} predictions awaiting validation`}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Every RUL prediction is stored; when a critical failure occurs, earlier
        predictions are scored against the real time-to-failure.
      </p>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={scored.length ? scored : series} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']}
            tickFormatter={t => format(new Date(t), 'dd MMM HH:mm')}
            tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db" />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db"
            domain={[0, 'auto']} label={{ value: 'days', angle: -90, fill: '#6b7280', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#4b5563' }}
            labelFormatter={t => format(new Date(t), 'dd MMM HH:mm')}
            formatter={(v, name) => [`${parseFloat(v).toFixed(1)} d`, name === 'predicted' ? 'Predicted RUL' : 'Actual time to failure']} />
          {eventTimes.map(t => (
            <ReferenceLine key={t} x={t} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
          ))}
          <Line type="monotone" dataKey="predicted" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          {scored.length > 0 && (
            <Line type="monotone" dataKey="actual" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
        <span><span className="inline-block w-3 h-0.5 bg-indigo-500 align-middle mr-1" />Predicted RUL</span>
        {scored.length > 0 && <span><span className="inline-block w-3 h-0.5 bg-green-500 align-middle mr-1" />Actual time to failure</span>}
        <span><span className="inline-block w-3 h-0.5 bg-red-500 align-middle mr-1" />Critical failure event</span>
      </div>
    </div>
  )
}
