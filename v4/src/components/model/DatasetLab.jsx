// ============================================================
// DATASET LAB — drop ANY labelled PdM dataset, watch the model
// learn, live. Powers the "test on a real dataset" demo:
//   drop CSV → auto-detect sensors + failure label → train a
//   classifier (chronological split) → animated results.
// Uses the existing ML-server endpoints /analyze and /train.
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import {
  UploadCloud, FileText, ScanSearch, BrainCircuit, Gauge,
  CheckCircle2, XCircle, RotateCcw, Tag, Rows3,
} from 'lucide-react'
import { analyzeDataset, trainClassifier } from '../../lib/mlServer'

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
      const machineId = 'lab-' + file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
      const t = await trainClassifier(file, machineId)
      await wait(500)
      setStep('train', 'done'); setStep('eval', 'active')
      await wait(700)                                   // evaluation happens server-side inside /train
      setStep('eval', 'done')
      setResult(t)
      setPhase('done')
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
          <h3 className="text-sm font-semibold text-gray-900 mb-2">What drives failure (feature importance)</h3>
          <div className="space-y-2">
            {Object.entries(result.importance || {}).slice(0, 8).map(([name, v], i) => (
              <ImportanceBar key={name} name={name} value={v} max={maxImp} delay={i * 90} />
            ))}
          </div>

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
