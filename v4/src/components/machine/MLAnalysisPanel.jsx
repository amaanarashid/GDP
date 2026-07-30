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

  function currentValues() {
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
        const r = await predictRisk(machine.id, currentValues())
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
  const tierColor = tier === 'critical' ? 'text-red-600' : tier === 'warning' ? 'text-yellow-600'
    : tier === 'watch' ? 'text-yellow-600' : 'text-green-600'
  const barColor = tier === 'critical' ? 'bg-red-500' : (tier === 'warning' || tier === 'watch') ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-indigo-600" />
          <h2 className="section-title mb-0">ML analysis <span className="text-xs text-gray-500 font-normal">(live)</span></h2>
        </div>
        <span className="badge-blue">{isDatasetMachine ? 'Failure risk model' : 'Anomaly detection'}</span>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        {isDatasetMachine
          ? 'Supervised model trained on the uploaded dataset — predicts failure risk from live values.'
          : 'Unsupervised Isolation Forest trained on this machine\'s own sensor history — flags abnormal behaviour.'}
        {' '}Updates automatically every {REFRESH_MS / 1000} s.
      </p>

      {/* Result display */}
      {result && (
        <div className="mb-4 p-4 rounded-lg bg-gray-100 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              {result.type === 'anomaly' ? 'Anomaly score' : 'Failure risk'}
            </span>
            <span className={`text-2xl font-semibold ${tierColor}`}>{score}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div className={`h-full ${barColor} transition-all duration-700`} style={{ width: `${Math.min(100, score)}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium flex items-center gap-1.5 ${tierColor}`}>
              {tier === 'normal' || tier === 'healthy'
                ? <CheckCircle className="w-4 h-4" />
                : <AlertTriangle className="w-4 h-4" />}
              {tier?.toUpperCase()}
            </span>
            {lastUpdated && (
              <span className="text-[10px] text-gray-500">
                updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
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
