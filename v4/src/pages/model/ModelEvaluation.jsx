// ============================================================
// MODEL EVALUATION — the project's centerpiece.
// All real data (MetroPT-3, a metro air compressor from Porto).
// Detector + RUL sections appear after a CSV is dropped in the lab.
// ============================================================
import { useState } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, Legend,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import {
  BrainCircuit, Database, Target, Ruler, ShieldCheck, RefreshCw, Siren, Clock,
} from 'lucide-react'
import { evaluateRul, evaluateDetector } from '../../lib/mlServer'
import DatasetLab from '../../components/model/DatasetLab'
import Spinner from '../../components/ui/Spinner'

function MetricCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="card">
      <p className="stat-label flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</p>
      <p className="stat-value mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#4b5563' },
}

export default function ModelEvaluation() {
  const [det, setDet]       = useState(null)
  const [rul, setRul]       = useState(null)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [revealed, setRevealed] = useState(false)   // benchmark shown only after a CSV is dropped

  async function load() {
    setLoading(true); setError('')
    // Load independently — one failing endpoint shouldn't blank the other chart
    const [d, r] = await Promise.allSettled([evaluateDetector(), evaluateRul(400)])
    if (d.status === 'fulfilled') setDet(d.value)
    if (r.status === 'fulfilled') setRul(r.value)
    if (d.status === 'rejected' && r.status === 'rejected') {
      const msg = d.reason?.message || ''
      setError(msg.includes('Failed to fetch')
        ? 'ML server is offline — start it to load the evaluation.'
        : `Detector: ${d.reason?.message} · RUL: ${r.reason?.message}`)
    } else if (d.status === 'rejected') {
      setError(`Detector evaluation failed: ${d.reason?.message}`)
    } else if (r.status === 'rejected') {
      setError(`RUL evaluation failed: ${r.reason?.message}`)
    }
    setLoading(false)
  }

  function reveal() {
    if (revealed) return
    setRevealed(true)
    load()
  }

  const oilLeak = det?.events?.find(e => e.type === 'oil_leak')

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-indigo-600" /> ML Model
        </h1>
        <p className="text-gray-500 text-sm">
          Evaluated on real data — MetroPT-3, a metro air compressor with documented failures.
        </p>
      </div>

      {error && (
        <div className="card border-red-300 text-red-600 text-sm flex items-center justify-between gap-4 mb-6">
          <span>{error}</span>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm shrink-0">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Dataset lab: drag & drop any dataset, train live.
          Results shown in the lab are ONLY about the dropped file. */}
      <DatasetLab />

      {/* MetroPT-3 benchmark: a separate, pre-trained showcase — opened
          explicitly so it's never mistaken for the uploaded dataset. */}
      {!revealed && (
        <button onClick={reveal}
          className="card w-full text-left hover:border-indigo-300 transition-colors mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" /> MetroPT-3 benchmark — real data
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Pre-trained models evaluated on a real metro compressor with two unseen failures. Click to view.
            </p>
          </div>
          <span className="badge-blue shrink-0">View results</span>
        </button>
      )}

      {loading && <Spinner label="Evaluating on MetroPT-3…" />}

      {/* ── Section 1: Failure detection (headline) ── */}
      {revealed && det && (
        <>
          <h2 className="section-title mt-2">Benchmark — pre-trained models on MetroPT-3 (real data)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard icon={Target} label="Detection AUC" value={det.metrics.auc}
              sub="on two unseen real failures" />
            <MetricCard icon={Clock} label="Oil-leak warning"
              value={oilLeak?.lead_hours_before_repair ? `${Math.round(oilLeak.lead_hours_before_repair)} h` : '—'}
              sub="before repair — failure type not in training" />
            <MetricCard icon={Siren} label="False alarms"
              value={`${(det.metrics.false_alarm_rate * 100).toFixed(1)}%`}
              sub="of healthy minutes" />
            <MetricCard icon={Database} label="Labels used" value="None"
              sub="trained on healthy data only" />
          </div>

          <div className="card mb-6">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h2 className="section-title mb-0">Failure detection — unseen test window</h2>
              <span className="badge-blue">{det.model_version}</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Red bands are real failures · dashed line is the alarm threshold.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={det.series} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']}
                  tickFormatter={t => format(new Date(t), 'dd MMM')}
                  tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db" />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db"
                  domain={['auto', 'auto']}
                  label={{ value: 'anomaly score', angle: -90, fill: '#6b7280', fontSize: 10, position: 'insideLeft' }} />
                <Tooltip {...tooltipStyle}
                  labelFormatter={t => format(new Date(t), 'dd MMM yyyy HH:mm')}
                  formatter={v => [v, 'Anomaly score']} />
                {det.events.map(e => (
                  <ReferenceArea key={e.onset_ms} x1={e.onset_ms} x2={e.recovery_ms}
                    fill="#ef4444" fillOpacity={0.15}
                    label={{ value: e.type.replace('_', ' '), fill: '#ef4444', fontSize: 10, position: 'insideTop' }} />
                ))}
                <ReferenceLine y={det.threshold} stroke="#eab308" strokeDasharray="5 4"
                  label={{ value: 'alarm threshold', fill: '#ca8a04', fontSize: 10, position: 'insideBottomRight' }} />
                <Line dataKey="score" stroke="#6366f1" strokeWidth={1.2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ── Section 2: RUL with uncertainty ── */}
      {revealed && rul && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h2 className="section-title mb-0">Remaining useful life</h2>
            <span className="badge-blue">{rul.model_version}</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            P50 prediction with a calibrated 80% interval (shaded) · MAE {rul.metrics.mae_days} days.
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={rul.series.map(d => ({ ...d, band: [d.low, d.high] }))}
              margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']}
                tickFormatter={t => format(new Date(t), 'dd MMM')}
                tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db" />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db"
                domain={[0, 'auto']}
                label={{ value: 'RUL (days)', angle: -90, fill: '#6b7280', fontSize: 10, position: 'insideLeft' }} />
              <Tooltip {...tooltipStyle}
                labelFormatter={t => format(new Date(t), 'dd MMM yyyy HH:mm')}
                formatter={(v, name) => {
                  if (name === 'band') return [`${v[0]}–${v[1]} d`, '80% interval']
                  return [`${v} d`, name === 'actual' ? 'Actual RUL' : 'Predicted (P50)']
                }} />
              <Legend wrapperStyle={{ fontSize: 11 }}
                formatter={n => n === 'band' ? '80% interval' : n === 'actual' ? 'Actual RUL' : 'Predicted (P50)'} />
              <Area dataKey="band" fill="#6366f1" fillOpacity={0.12} stroke="none" isAnimationActive={false} />
              <Line dataKey="actual" stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line dataKey="p50" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              {rul.failures.map(f => (
                <ReferenceLine key={f.onset_ms} x={f.onset_ms} stroke="#ef4444" strokeWidth={1.5}
                  strokeDasharray="5 4"
                  label={{ value: f.type.replace('_', ' '), fill: '#ef4444', fontSize: 10, position: 'top' }} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Methodology — compact */}
      {revealed && (det || rul) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-gray-400" /> Real dataset
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              MetroPT-3: metro air compressor (Porto, 2020), ~10s sensor cadence, four documented failures.
            </p>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-gray-400" /> No leakage, no labels
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Strict temporal split — train Feb–May, test Jun–Jul. The detector never sees a failure;
              the oil-leak type doesn't exist in training.
            </p>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-gray-400" /> Honest reporting
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              False-alarm rates and calibrated intervals reported. Limitations stated, not hidden.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
