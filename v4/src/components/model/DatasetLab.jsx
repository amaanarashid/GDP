// ============================================================
// DATASET LAB — drop ANY labelled PdM dataset, watch the model
// learn, live. Powers the "test on a real dataset" demo:
//   drop CSV → auto-detect sensors + failure label → train a
//   classifier (chronological split) → animated results.
// Uses the existing ML-server endpoints /analyze and /train.
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ComposedChart, ScatterChart, Line, Scatter, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import {
  UploadCloud, FileText, ScanSearch, BrainCircuit, Gauge,
  CheckCircle2, XCircle, RotateCcw, Tag, Rows3,
} from 'lucide-react'
import { analyzeDataset, trainClassifier, predictRisk } from '../../lib/mlServer'

const tooltipStyle = {
  contentStyle: { background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#4b5563' },
}

const wait = ms => new Promise(r => setTimeout(r, ms))

// ── Animated number (eased count-up) ────────────────────────
function CountUp({ value, decimals = 1, suffix = '' }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    const t0 = performance.now()
    const dur = 900
    const step = t => {
      const p = Math.min(1, (t - t0) / dur)
      setV(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{v.toFixed(decimals)}{suffix}</>
}

// ── Pipeline step chip ──────────────────────────────────────
function Step({ icon: Icon, label, state }) {
  // state: 'pending' | 'active' | 'done' | 'error'
  const cls = {
    pending: 'border-gray-200 text-gray-400',
    active:  'border-indigo-600 text-indigo-700 step-pulse bg-indigo-50',
    done:    'border-green-300 text-green-600 bg-green-50',
    error:   'border-red-300 text-red-600 bg-red-50',
  }[state]
  const Mark = state === 'done' ? CheckCircle2 : state === 'error' ? XCircle : Icon
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors duration-300 ${cls}`}>
      <Mark className="w-4 h-4" /> {label}
    </div>
  )
}

// ── Importance bar (animates in) ────────────────────────────
function ImportanceBar({ name, value, max, delay }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const id = setTimeout(() => setW((value / (max || 1)) * 100), 60 + delay)
    return () => clearTimeout(id)
  }, [value, max, delay])
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-40 truncate text-right shrink-0">{name}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-10 shrink-0">{(value * 100).toFixed(0)}%</span>
    </div>
  )
}

const STEPS = [
  { id: 'read',    icon: FileText,     label: 'Read file' },
  { id: 'analyze', icon: ScanSearch,   label: 'Detect sensors & label' },
  { id: 'train',   icon: BrainCircuit, label: 'Train model' },
  { id: 'eval',    icon: Gauge,        label: 'Evaluate' },
]

export default function DatasetLab({ onComplete }) {
  const [phase, setPhase]       = useState('idle')   // idle | running | done | error
  const [stepState, setSteps]   = useState({})       // stepId -> pending/active/done/error
  const [fileName, setFileName] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  // ── "Predict maintenance" step ──────────────────────────
  // After training, feed live sensor values to the trained model and
  // get a maintenance decision back. This is the point of the whole
  // exercise: metrics prove the model is sound, this shows it being used.
  const [machineId, setMachineId] = useState('')
  const [inputs, setInputs] = useState(null)      // { sensor: value }
  const [prediction, setPrediction] = useState(null)
  const [predicting, setPredicting] = useState(false)

  const setStep = (id, s) => setSteps(prev => ({ ...prev, [id]: s }))

  const run = useCallback(async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please drop a .csv file.'); setPhase('error'); return
    }
    setPhase('running'); setError(''); setAnalysis(null); setResult(null)
    setFileName(file.name)
    setSteps({ read: 'active', analyze: 'pending', train: 'pending', eval: 'pending' })

    try {
      await wait(700)                                   // let the scan animation breathe
      setStep('read', 'done'); setStep('analyze', 'active')

      const a = await analyzeDataset(file)
      await wait(600)
      setAnalysis(a)
      setStep('analyze', 'done')

      if (!a.has_labels) {
        setError('No failure/label column detected — the model needs labelled data to train. (Detected sensors are shown below.)')
        setStep('train', 'error'); setStep('eval', 'error')
        setPhase('done')
        onComplete?.()
        return
      }

      setStep('train', 'active')
      const mid = 'lab-' + file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
      setMachineId(mid)
      const t = await trainClassifier(file, mid)
      await wait(500)
      setStep('train', 'done'); setStep('eval', 'active')
      await wait(700)                                   // evaluation happens server-side inside /train
      setStep('eval', 'done')
      setResult(t)
      setPhase('done')

      // Seed the prediction sliders with each sensor's average value
      const seeded = {}
      for (const s of a.sensors) seeded[s] = Number((a.stats?.[s]?.mean ?? 0).toFixed(2))
      setInputs(seeded)
      setPrediction(null)
      onComplete?.()
    } catch (e) {
      setError(e.message.includes('Failed to fetch')
        ? 'ML server is offline — start it to run the lab.' : e.message)
      setSteps(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) =>
        [k, v === 'active' ? 'error' : v])))
      setPhase('error')
    }
  }, [onComplete])

  const reset = () => {
    setPhase('idle'); setSteps({}); setAnalysis(null); setResult(null)
    setError(''); setFileName('')
    setInputs(null); setPrediction(null); setMachineId('')
  }

  async function runPrediction() {
    if (!inputs || !machineId) return
    setPredicting(true)
    try {
      setPrediction(await predictRisk(machineId, inputs))
    } catch (e) {
      setError(`Prediction failed — ${e.message}`)
    } finally {
      setPredicting(false)
    }
  }

  // Demo presets. "Worn machine" pushes the two most important sensors in
  // OPPOSITE directions — the classic overstrain pattern (high load against
  // low speed). Pushing everything to maximum looks dramatic but is a
  // coherent operating state, so the model rightly stays calm.
  function applyPreset(kind) {
    if (!analysis || !inputs) return
    const st = n => analysis.stats?.[n]
    const next = { ...inputs }

    if (kind === 'healthy') {
      for (const s of analysis.sensors) if (st(s)) next[s] = Number(st(s).mean.toFixed(2))
    } else {
      const [first, second] = Object.keys(result?.importance || {})
      for (const s of analysis.sensors) if (st(s)) next[s] = Number(st(s).mean.toFixed(2))
      // most important sensor → low end, second → high end
      if (first && st(first)) {
        const a = st(first)
        next[first] = Number((a.min + (a.mean - a.min) * 0.25).toFixed(2))
      }
      if (second && st(second)) {
        const b = st(second)
        next[second] = Number((b.mean + (b.max - b.mean) * 0.85).toFixed(2))
      }
      // and an old tool, if the dataset has a wear-like sensor
      const wear = analysis.sensors.find(s => /wear|hours|age|cycles/i.test(s))
      if (wear && st(wear)) next[wear] = Number((st(wear).max * 0.95).toFixed(2))
    }
    setInputs(next)
    setPrediction(null)
  }

  const onDrop = e => {
    e.preventDefault(); setDragOver(false)
    run(e.dataTransfer.files?.[0])
  }

  const impValues = Object.values(result?.importance || {})
  const maxImp = impValues.length ? Math.max(...impValues) : 1

  return (
    <div className="card mb-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-indigo-600" /> Dataset lab
        </h2>
        {phase !== 'idle' && (
          <button onClick={reset} className="btn-secondary flex items-center gap-2 text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> Run another dataset
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Drop a CSV — sensors and failure label are auto-detected, then a model trains live.
      </p>

      {/* Drop zone */}
      {phase === 'idle' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed px-6 py-12 text-center cursor-pointer
            transition-colors duration-200 ${dragOver
              ? 'border-indigo-500 bg-indigo-50 glow-pulse'
              : 'border-gray-300 hover:border-gray-500 bg-gray-50'}`}>
          <UploadCloud className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-indigo-600' : 'text-gray-400'}`} />
          <p className="text-sm text-gray-700 font-medium">Drag &amp; drop a dataset here</p>
          <p className="text-xs text-gray-500 mt-1">or click to browse</p>
          <input ref={inputRef} type="file" accept=".csv" className="hidden"
            onChange={e => run(e.target.files?.[0])} />
        </div>
      )}

      {/* Pipeline steps */}
      {phase !== 'idle' && (
        <div className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 mb-4 overflow-hidden">
          {phase === 'running' && <div className="scan-line" />}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge-gray max-w-[180px] truncate">{fileName}</span>
            {STEPS.map(s => <Step key={s.id} icon={s.icon} label={s.label} state={stepState[s.id] || 'pending'} />)}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Analysis result */}
      {analysis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="card-sm">
            <p className="stat-label flex items-center gap-1"><Rows3 className="w-3 h-3" /> Rows</p>
            <p className="text-xl font-semibold text-gray-900 mt-1"><CountUp value={analysis.rows} decimals={0} /></p>
          </div>
          <div className="card-sm">
            <p className="stat-label flex items-center gap-1"><ScanSearch className="w-3 h-3" /> Sensors detected</p>
            <p className="text-xl font-semibold text-gray-900 mt-1"><CountUp value={analysis.sensors.length} decimals={0} /></p>
            <p className="text-[10px] text-gray-500 truncate mt-0.5">{analysis.sensors.join(', ')}</p>
          </div>
          <div className="card-sm">
            <p className="stat-label flex items-center gap-1"><Tag className="w-3 h-3" /> Label column</p>
            <p className="text-xl font-semibold text-gray-900 mt-1 truncate">{analysis.label_column || '—'}</p>
          </div>
          <div className="card-sm">
            <p className="stat-label">Failure rate</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">
              {analysis.failure_rate != null ? <CountUp value={analysis.failure_rate * 100} suffix="%" /> : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Training result */}
      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              ['Precision', result.metrics.precision],
              ['Recall',    result.metrics.recall],
              ['F1 score',  result.metrics.f1],
              ['ROC-AUC',   result.metrics.roc_auc],
            ].map(([label, v]) => (
              <div key={label} className="card-sm border-indigo-200">
                <p className="stat-label">{label}</p>
                <p className="text-2xl font-semibold text-indigo-700 mt-1">
                  {v != null ? <CountUp value={v} decimals={3} /> : '—'}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="badge-blue">{result.metrics.split || 'chronological split'}</span>
            <span className="badge-gray">{result.metrics.test_size?.toLocaleString?.()} test rows</span>
            <span className="badge-gray">RandomForest · 200 trees</span>
          </div>

          {/* Confusion matrix — the percentages as actual machine counts */}
          {result.metrics.confusion && (() => {
            const c = result.metrics.confusion
            const cell = (n, label, tone) => (
              <div className={`rounded-lg p-3 border ${tone}`}>
                <p className="text-2xl font-semibold tabular-nums">{n.toLocaleString()}</p>
                <p className="text-[11px] mt-0.5 leading-tight">{label}</p>
              </div>
            )
            return (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">What it got right and wrong</h3>
                <p className="text-xs text-gray-500 mb-3">
                  On {(c.tn + c.fp + c.fn + c.tp).toLocaleString()} machines it had never seen before.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {cell(c.tp, 'failures caught', 'bg-green-50 border-green-300 text-green-700')}
                  {cell(c.fn, 'failures missed', 'bg-red-50 border-red-300 text-red-700')}
                  {cell(c.fp, 'false alarms', 'bg-yellow-50 border-yellow-300 text-yellow-700')}
                  {cell(c.tn, 'correctly cleared', 'bg-gray-50 border-gray-200 text-gray-700')}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Missing a failure costs unplanned downtime; a false alarm costs an unnecessary
                  inspection. Which matters more is a business decision, and it sets the threshold.
                </p>
              </div>
            )
          })()}
          {/* ── Use the trained model: predict maintenance ── */}
          {inputs && (
            <div className="mt-6 rounded-xl border-2 border-indigo-200 bg-indigo-50/40 p-4">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-indigo-600" /> Predict maintenance
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => applyPreset('healthy')} className="btn-secondary text-xs">
                    Healthy machine
                  </button>
                  <button onClick={() => applyPreset('worn')} className="btn-secondary text-xs">
                    Worn / overloaded
                  </button>
                  <button onClick={runPrediction} disabled={predicting} className="btn-primary text-xs">
                    {predicting ? 'Predicting…' : 'Predict'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Enter a machine&apos;s current readings — the trained model returns its
                failure risk and when it should be serviced.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mb-3">
                {analysis.sensors.slice(0, 6).map(s => {
                  const st = analysis.stats?.[s] || { min: 0, max: 100, mean: 50 }
                  const span = (st.max - st.min) || 1
                  const pct = v => Math.max(0, Math.min(100, ((v - st.min) / span) * 100))
                  const val = inputs[s]
                  // How far from typical, in % of the sensor's full range
                  const offset = Math.abs(val - st.mean) / span
                  const flag = offset > 0.35 ? 'unusual' : offset > 0.18 ? 'above typical' : null

                  return (
                    <div key={s}>
                      <div className="flex justify-between items-baseline text-xs mb-0.5 gap-2">
                        <span className="text-gray-600 truncate">{s}</span>
                        <span className="flex items-baseline gap-1.5 shrink-0">
                          {flag && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              flag === 'unusual'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'}`}>
                              {flag}
                            </span>
                          )}
                          <span className="text-gray-900 font-medium tabular-nums">{val}</span>
                        </span>
                      </div>

                      <div className="relative">
                        <input type="range" min={st.min} max={st.max} step={span / 100}
                          value={val}
                          onChange={e => setInputs(p => ({ ...p, [s]: Number(Number(e.target.value).toFixed(2)) }))}
                          className="w-full accent-indigo-600 relative z-10" />
                        {/* dataset average marker */}
                        <span className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-gray-400 pointer-events-none"
                          style={{ left: `${pct(st.mean)}%` }} title="dataset average" />
                      </div>

                      <div className="flex justify-between text-[10px] text-gray-400 -mt-0.5">
                        <span>{Number(st.min).toFixed(0)}</span>
                        <span className="text-gray-500">avg {Number(st.mean).toFixed(0)}</span>
                        <span>{Number(st.max).toFixed(0)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {prediction && (
                <div className={`rounded-lg p-4 border ${
                  prediction.tier === 'critical' ? 'bg-red-50 border-red-300'
                  : prediction.tier === 'warning' ? 'bg-yellow-50 border-yellow-300'
                  : prediction.tier === 'watch' ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-green-50 border-green-300'}`}>
                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Failure risk</p>
                      <p className={`text-4xl font-semibold tabular-nums ${
                        prediction.tier === 'critical' ? 'text-red-600'
                        : prediction.tier === 'warning' || prediction.tier === 'watch' ? 'text-yellow-600'
                        : 'text-green-600'}`}>{prediction.risk}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Recommended action</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {prediction.tier === 'critical' ? 'Service immediately'
                          : prediction.tier === 'warning' ? 'Schedule within days'
                          : prediction.tier === 'watch' ? 'Monitor closely'
                          : 'No action needed'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        indicative horizon ~{prediction.rul_days} days
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <h3 className="text-sm font-semibold text-gray-900 mb-2 mt-6">What drives failure (feature importance)</h3>
          <div className="space-y-2">
            {Object.entries(result.importance || {}).slice(0, 8).map(([name, v], i) => (
              <ImportanceBar key={name} name={name} value={v} max={maxImp} delay={i * 90} />
            ))}
          </div>

          {/* Feature space — the most intuitive plot in the app */}
          {result.scatter?.points?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Where failures actually happen
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Every machine in the test set, plotted on the two sensors that matter most.
                Notice the failures cluster in a <span className="text-gray-800 font-medium">region</span> —
                they aren&apos;t simply the highest readings. That&apos;s why a threshold rule
                can&apos;t catch them and a model can.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <XAxis type="number" dataKey="x" name={result.scatter.x_label}
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db"
                    label={{ value: result.scatter.x_label, position: 'insideBottom', offset: -10,
                             fontSize: 11, fill: '#6b7280' }} />
                  <YAxis type="number" dataKey="y" name={result.scatter.y_label}
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db"
                    label={{ value: result.scatter.y_label, angle: -90, position: 'insideLeft',
                             fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }}
                    formatter={(v, n) => [v, n === 'x' ? result.scatter.x_label : result.scatter.y_label]} />
                  <Scatter name="healthy" isAnimationActive={false}
                    data={result.scatter.points.filter(p => !p.failed)}
                    fill="#cbd5e1" fillOpacity={0.75} />
                  <Scatter name="failed" isAnimationActive={false}
                    data={result.scatter.points.filter(p => p.failed)}
                    fill="#ef4444" fillOpacity={0.95} />
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-[11px] text-gray-500 mt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> healthy machine
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> actually failed
                </span>
              </div>
            </div>
          )}

          {/* Risk over the held-out test set */}
          {result.risk_series?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Risk on held-out test data</h3>
              <p className="text-xs text-gray-500 mb-2">
                Predicted failure risk per test sample · red dots are actual failures —
                a good model puts them on the peaks.
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={result.risk_series} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="i" type="number" domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db"
                    label={{ value: 'test sample', fontSize: 10, fill: '#6b7280', position: 'insideBottomRight', offset: -2 }} />
                  <YAxis domain={[0, 1]} tickFormatter={v => `${Math.round(v * 100)}%`}
                    tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db" />
                  <Tooltip {...tooltipStyle}
                    formatter={(v, name) => name === 'risk'
                      ? [`${(v * 100).toFixed(1)}%`, 'Predicted risk']
                      : [`${(v * 100).toFixed(1)}%`, 'Risk at actual failure']} />
                  <Line dataKey="risk" stroke="#6366f1" strokeWidth={1.2} dot={false} isAnimationActive={false} />
                  <Scatter data={result.risk_series.filter(d => d.actual === 1)}
                    dataKey="risk" fill="#ef4444" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ROC curve + how to read it */}
          {result.roc?.length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">ROC curve</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={result.roc} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <XAxis dataKey="fpr" type="number" domain={[0, 1]}
                      tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db"
                      label={{ value: 'false alarm rate', fontSize: 10, fill: '#6b7280', position: 'insideBottomRight', offset: -2 }} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#d1d5db"
                      label={{ value: 'catch rate', angle: -90, fontSize: 10, fill: '#6b7280', position: 'insideLeft' }} />
                    <Tooltip {...tooltipStyle}
                      formatter={v => [`${(v * 100).toFixed(1)}%`, 'Catch rate']}
                      labelFormatter={f => `False alarms: ${(f * 100).toFixed(1)}%`} />
                    <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                      stroke="#d1d5db" strokeDasharray="4 4" />
                    <Line dataKey="tpr" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="card-sm mt-6">
                <p className="stat-label">ROC-AUC</p>
                <p className="text-3xl font-semibold text-indigo-700 mt-1">
                  {result.metrics.roc_auc != null ? <CountUp value={result.metrics.roc_auc} decimals={3} /> : '—'}
                </p>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  How to read it: the curve shows the trade-off between catching real
                  failures and raising false alarms. The closer it hugs the top-left
                  corner, the better. The dashed diagonal is random guessing (AUC 0.5);
                  a perfect model scores 1.0.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
