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

// Numbered section header — makes the page read as a two-part story
// rather than a stack of charts.
function SectionHeading({ step, title, sub }) {
  return (
    <div className="flex items-start gap-3 mb-3 mt-2">
      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-semibold
        flex items-center justify-center shrink-0">{step}</span>
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 max-w-2xl">{sub}</p>
      </div>
    </div>
  )
}

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
        <h1 className="page-title flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-indigo-600" /> ML Model
        </h1>
        <p className="page-sub max-w-3xl">
          Predicting machine failures from sensor data. Train a model on any real
          dataset below, then see how our models performed on a real industrial
          compressor with documented failures.
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

      {/* ── PART 1 ── */}
      <SectionHeading
        step="1"
        title="Train on a real dataset"
        sub="Drop in any labelled sensor data — the model is built live, then you can make a prediction with it."
      />

      {/* Results in the lab are ONLY about the dropped file. */}
      <DatasetLab />

      {/* ── PART 2 ── */}
      <SectionHeading
        step="2"
        title="How we validated the models"
        sub="Results on MetroPT-3: a real metro air compressor. Trained on the first two failures, tested on two it had never seen."
      />

      {/* Kept behind a click so it's never mistaken for the uploaded dataset. */}
      {!revealed && (
        <button onClick={reveal}
          className="card card-hover w-full text-left mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" /> View benchmark results
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Detection performance and remaining-useful-life accuracy on real failure data.
            </p>
          </div>
          <span className="badge-blue shrink-0">Show</span>
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
            <p className="text-xs text-gray-500 mb-3">
              The model scores how unusual the machine looks, minute by minute. It was
              trained only on healthy data — it has never seen a failure.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-3 h-0.5 bg-indigo-500" /> anomaly score
              </span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-yellow-500" /> alarm threshold
              </span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-3 h-3 bg-red-400/30 border border-red-400" /> real failure period
              </span>
              <span className="ml-auto text-gray-500 font-medium">
                ↑ Look for the line crossing the threshold inside the red bands
              </span>
            </div>
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
          <p className="text-xs text-gray-500 mb-3">
            How many days until failure. Green is the truth, indigo is the prediction, and the
            shaded band is the 80% confidence range — we report a range rather than a single
            number because a precise figure would overstate what the data supports.
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
