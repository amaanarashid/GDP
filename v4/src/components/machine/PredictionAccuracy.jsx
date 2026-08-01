// ============================================================
// PREDICTION ACCURACY — the app grading its own homework.
//
// Every days-remaining estimate is written to rul_predictions.
// When a component later goes critical, each earlier estimate can
// be scored against what actually happened:
//     actual = time between the estimate and the failure
//
// Shown as a PARITY PLOT (predicted vs actual, with a diagonal for
// a perfect prediction) rather than two lines over time — on a
// parity plot accuracy is immediately visible: points on the line
// are right, points above are optimistic, below are pessimistic.
// ============================================================
import { useState, useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { format } from 'date-fns'
import { Target, Clock } from 'lucide-react'
import { getRulPredictionHistory } from '../../lib/maintenanceData'

const DAY_MS = 24 * 3600 * 1000
// Only score estimates made within this window before a failure — a
// "90 days left" estimate made 5 minutes before a fault isn't the same
// claim as one made a week out.
const MAX_LOOKBACK_DAYS = 30
const ACCURATE_WITHIN_DAYS = 2

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
  if (!data) return <div className="card text-xs text-gray-500">Loading prediction history…</div>

  const { predictions, failureEvents } = data

  // One machine-level estimate per batch: the minimum across components,
  // because that's the one a planner would act on.
  const byTime = new Map()
  for (const p of predictions) {
    if (p.days_remaining == null) continue
    const t = new Date(p.timestamp).getTime()
    const cur = byTime.get(t)
    if (cur == null || p.days_remaining < cur) byTime.set(t, parseFloat(p.days_remaining))
  }
  const series = [...byTime.entries()].sort((a, b) => a[0] - b[0])
    .map(([t, days]) => ({ t, predicted: days }))

  // Score each estimate against the next real failure
  const eventTimes = failureEvents.map(e => new Date(e.created_at).getTime())
  const scored = []
  for (const pt of series) {
    const ev = eventTimes.find(t => t > pt.t)
    if (ev == null) continue
    const actual = (ev - pt.t) / DAY_MS
    if (actual > MAX_LOOKBACK_DAYS) continue
    scored.push({ ...pt, actual, error: Math.abs(pt.predicted - actual) })
  }

  const mae = scored.length ? scored.reduce((a, s) => a + s.error, 0) / scored.length : null
  const within = scored.length
    ? (scored.filter(s => s.error <= ACCURATE_WITHIN_DAYS).length / scored.length) * 100
    : null
  const bias = scored.length
    ? scored.reduce((a, s) => a + (s.predicted - s.actual), 0) / scored.length
    : null

  // ── Not yet validated ──────────────────────────────────────
  if (!scored.length) {
    return (
      <div className="card">
        <h2 className="section-title mb-1 flex items-center gap-2">
          <Target className="w-4 h-4" /> Prediction accuracy
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Every days-remaining estimate is stored. Once a component actually
          fails, earlier estimates are scored against the real time-to-failure —
          that&apos;s how we check the predictions rather than just trusting them.
        </p>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-start gap-3">
          <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          <div className="text-xs text-gray-600">
            <p className="font-medium text-gray-900 mb-0.5">Awaiting a failure to validate against</p>
            <p>
              {series.length
                ? <>{series.length} estimate{series.length > 1 ? 's' : ''} recorded so far. Run the machine to a critical fault and they&apos;ll be scored here automatically.</>
                : <>No estimates recorded yet — open this machine while the simulator runs.</>}
            </p>
          </div>
        </div>

        {series.length > 1 && (
          <div className="mt-4">
            <p className="text-[11px] text-gray-500 mb-1">Estimated days remaining over time</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={series} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']}
                  tickFormatter={t => format(new Date(t), 'HH:mm')}
                  tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db" />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db" domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={t => format(new Date(t), 'dd MMM HH:mm')}
                  formatter={v => [`${parseFloat(v).toFixed(1)} days`, 'Estimated']} />
                <Line dataKey="predicted" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    )
  }

  // ── Validated: parity plot ─────────────────────────────────
  const maxAxis = Math.ceil(Math.max(...scored.map(s => Math.max(s.actual, s.predicted)), 1))

  return (
    <div className="card">
      <h2 className="section-title mb-1 flex items-center gap-2">
        <Target className="w-4 h-4" /> Prediction accuracy
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Each dot is one past estimate, scored against what actually happened.
        Dots on the dashed line were exactly right.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card-sm">
          <p className="stat-label">Avg error</p>
          <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">{mae.toFixed(1)} d</p>
        </div>
        <div className="card-sm">
          <p className="stat-label">Within ±{ACCURATE_WITHIN_DAYS}d</p>
          <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">{Math.round(within)}%</p>
        </div>
        <div className="card-sm">
          <p className="stat-label">Bias</p>
          <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">
            {bias > 0 ? '+' : ''}{bias.toFixed(1)} d
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {bias > 0.5 ? 'over-optimistic' : bias < -0.5 ? 'over-cautious' : 'well centred'}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 10, right: 15, left: 0, bottom: 15 }}>
          <XAxis type="number" dataKey="actual" domain={[0, maxAxis]}
            tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db"
            label={{ value: 'Actual days to failure', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6b7280' }} />
          <YAxis type="number" dataKey="predicted" domain={[0, maxAxis]}
            tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db"
            label={{ value: 'Predicted', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }} />
          {/* perfect-prediction diagonal */}
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxAxis, y: maxAxis }]}
            stroke="#9ca3af" strokeDasharray="5 4" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12 }}
            formatter={(v, name) => [`${parseFloat(v).toFixed(1)} days`,
              name === 'actual' ? 'Actually failed in' : 'We predicted']} />
          <Scatter data={scored} fill="#6366f1" fillOpacity={0.7} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-gray-500">
        <span>Scored against {eventTimes.length} failure event{eventTimes.length > 1 ? 's' : ''} · {scored.length} estimates</span>
        <span className="ml-auto">above the line = predicted too much time · below = too little</span>
      </div>
    </div>
  )
}
