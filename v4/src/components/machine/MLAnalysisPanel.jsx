import { useState, useEffect, useRef, useCallback } from 'react'
import { trainAnomaly, detectAnomaly, predictRisk, mlHealth } from '../../lib/mlServer'
import { BrainCircuit, RefreshCw, AlertTriangle, CheckCircle, Activity } from 'lucide-react'

// Shows Python-powered ML analysis for a machine — AUTOMATIC:
// runs on page load and refreshes every 30 s while the page is
// open. Auto-detects which model exists on the server:
// - classifier model (trained from a labelled CSV) → failure risk + RUL
// - otherwise → anomaly detection on the machine's own DB history
// Training stays a manual action on purpose: the model should only
// learn "normal" when a human confirms the history is healthy.
const REFRESH_MS = 30000

export default function MLAnalysisPanel({ machine, sensors }) {
  const [result, setResult]       = useState(null)
  const [training, setTraining]   = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [hint, setHint]           = useState(null)   // { kind: 'info'|'error', text }
  const [trainInfo, setTrainInfo] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isDatasetMachine, setIsDatasetMachine] = useState(machine.type === 'custom')

  // Refs so the auto-refresh interval always sees fresh values
  const sensorsRef = useRef(sensors)
  sensorsRef.current = sensors
  const busyRef = useRef(false)

  // Keyed by sensor ID: machines can have several sensors with the same
  // name on different components (three "Temperature" on the press), and
  // keying by name collapsed them so faults were invisible to the model.
  function currentValues() {
    const values = {}
    ;(sensorsRef.current || []).forEach(s => { values[s.id] = parseFloat(s.current_value ?? 0) })
    return values
  }

  // The dataset classifier (/predict) is trained on CSV column names,
  // so that path still keys by name.
  function currentValuesByName() {
    const values = {}
    ;(sensorsRef.current || []).forEach(s => { values[s.name] = parseFloat(s.current_value ?? 0) })
    return values
  }

  const analyze = useCallback(async (manual = false) => {
    if (busyRef.current) return
    busyRef.current = true
    setAnalyzing(true)
    if (manual) setHint(null)
    try {
      const health = await mlHealth()
      const hasClassifier = health.classifier_models?.includes(machine.id)
      const hasAnomaly    = health.anomaly_models?.includes(machine.id)

      if (hasClassifier) {
        setIsDatasetMachine(true)
        const r = await predictRisk(machine.id, currentValuesByName())
        setResult({ type: 'risk', ...r })
        setHint(null)
        setLastUpdated(new Date())
      } else if (hasAnomaly) {
        setIsDatasetMachine(false)
        const r = await detectAnomaly(machine.id, currentValues())
        setResult({ type: 'anomaly', ...r })
        setHint(null)
        setLastUpdated(new Date())
      } else {
        setHint({ kind: 'info', text: 'No trained model for this machine yet — click "Train on history" once (with healthy history).' })
      }
    } catch (e) {
      if (e.message.includes('Failed to fetch')) {
        setHint({ kind: manual ? 'error' : 'info', text: 'ML server is offline — live analysis paused.' })
      } else {
        setHint({ kind: 'error', text: e.message })
      }
    } finally {
      busyRef.current = false
      setAnalyzing(false)
    }
  }, [machine.id])

  // Auto: analyze on load, then every 30 s while the page is open
  useEffect(() => {
    analyze(false)
    const id = setInterval(() => analyze(false), REFRESH_MS)
    return () => clearInterval(id)
  }, [analyze])

  async function handleTrain() {
    setTraining(true); setHint(null)
    try {
      const info = await trainAnomaly(machine.id)
      setTrainInfo(info)
      await analyze(true)          // show the first result immediately
    } catch (e) {
      setHint({ kind: 'error', text: e.message })
    } finally { setTraining(false) }
  }

  const score = result?.type === 'anomaly' ? result.anomaly_score : result?.risk
  const tier  = result?.tier

  // Tier → the whole card's accent, so state is readable across the room
  const accent = {
    critical: { ring: 'border-red-300',    tint: 'bg-red-50',    text: 'text-red-600',    bar: 'bg-red-500',    label: 'CRITICAL' },
    warning:  { ring: 'border-yellow-300', tint: 'bg-yellow-50', text: 'text-yellow-600', bar: 'bg-yellow-500', label: 'WARNING' },
    watch:    { ring: 'border-yellow-300', tint: 'bg-yellow-50', text: 'text-yellow-600', bar: 'bg-yellow-500', label: 'WATCH' },
  }[tier] || { ring: 'border-green-300', tint: 'bg-green-50', text: 'text-green-600', bar: 'bg-green-500', label: 'NORMAL' }

  const verdict = result?.type === 'anomaly'
    ? (tier === 'critical' ? 'Behaviour is far outside this machine\'s normal'
      : tier === 'warning' ? 'Drifting away from normal behaviour'
      : 'Operating within its learned normal range')
    : (tier === 'critical' ? 'High probability of failure'
      : tier === 'warning' ? 'Elevated failure risk'
      : 'Low failure risk')

  return (
    <div className={`card border-2 ${result ? accent.ring : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-indigo-600" />
          <h2 className="section-title mb-0">ML analysis</h2>
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> live
          </span>
        </div>
        <span className="badge-blue">{isDatasetMachine ? 'Failure risk model' : 'Anomaly detection'}</span>
      </div>

      {/* Result — the score is the hero */}
      {result && (
        <div className={`mb-4 p-4 rounded-xl ${accent.tint} border ${accent.ring}`}>
          <div className="flex items-end justify-between gap-3 mb-1">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {result.type === 'anomaly' ? 'Anomaly score' : 'Failure risk'}
              </p>
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-semibold tabular-nums ${accent.text}`}>{score}</span>
                <span className={`text-xl font-medium ${accent.text}`}>%</span>
              </div>
            </div>
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${accent.text} pb-1`}>
              {tier === 'normal' || tier === 'healthy'
                ? <CheckCircle className="w-4 h-4" />
                : <AlertTriangle className="w-4 h-4" />}
              {accent.label}
            </span>
          </div>

          <p className="text-xs text-gray-600 mb-3">{verdict}</p>

          <div className="h-2.5 bg-white/70 rounded-full overflow-hidden">
            <div className={`h-full ${accent.bar} rounded-full transition-all duration-700`}
              style={{ width: `${Math.max(2, Math.min(100, score))}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>normal</span><span>warning</span><span>critical</span>
          </div>

          {/* Why the model thinks so */}
          {result.contributors?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200/70">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Driven by</p>
              <div className="space-y-1.5">
                {result.contributors.map(c => (
                  <div key={c.sensor} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-700 truncate flex-1">{c.sensor}</span>
                    <span className="font-medium text-gray-900 tabular-nums">{c.value}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      c.z >= 4 ? 'bg-red-100 text-red-700'
                      : c.z >= 2 ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'}`}>
                      {c.z}σ
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                σ = standard deviations away from this machine&apos;s learned normal
              </p>
            </div>
          )}

          {lastUpdated && (
            <p className="text-[10px] text-gray-400 mt-3">
              updated {lastUpdated.toLocaleTimeString()} · refreshes every {REFRESH_MS / 1000}s
            </p>
          )}
        </div>
      )}

      {trainInfo && !result && (
        <div className="mb-4 text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Model trained on {trainInfo.rows_used} readings across {trainInfo.sensors?.length} sensors.
        </div>
      )}

      {hint && (
        <div className={`mb-4 text-xs rounded-lg px-3 py-2 border ${
          hint.kind === 'error'
            ? 'text-red-600 bg-red-50 border-red-300'
            : 'text-gray-600 bg-gray-100 border-gray-200'}`}>
          {hint.text}
        </div>
      )}

      {/* What this model is — kept small, below the result */}
      <p className="text-[11px] text-gray-500 mb-3">
        {isDatasetMachine
          ? 'Supervised model trained on the uploaded dataset.'
          : 'Unsupervised Isolation Forest, trained on this machine\'s own healthy history — no failure examples needed.'}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        {!isDatasetMachine && (
          <button onClick={handleTrain} disabled={training} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${training ? 'animate-spin' : ''}`} />
            {training ? 'Training…' : 'Train on history'}
          </button>
        )}
        <button onClick={() => analyze(true)} disabled={analyzing} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
          <Activity className={`w-4 h-4 ${analyzing ? 'animate-pulse' : ''}`} />
          {analyzing ? 'Analyzing…' : 'Refresh now'}
        </button>
      </div>
    </div>
  )
}
