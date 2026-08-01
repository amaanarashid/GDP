import { useState, useEffect, useCallback } from 'react'
import { getMachines, getMachineBundle } from '../../lib/data'
import { resetMachine, generateHistory } from '../../lib/maintenanceData'
import { exportMachineDataset } from '../../lib/datasetExport'
import { faultsForType } from '../../lib/faults'
import { useSimulator } from '../../hooks/useSimulator'
import { machineTypeLabel, healthColor, statusBadge } from '../../utils/helpers'
import ComponentCard from '../../components/machine/ComponentCard'
import FaultPanel from '../../components/machine/FaultPanel'
import ResetDialog from '../../components/machine/ResetDialog'
import DemoPanel from '../../components/machine/DemoPanel'
import Spinner from '../../components/ui/Spinner'
import { Play, Pause, Activity, RotateCcw, DatabaseZap, Download, Presentation } from 'lucide-react'

// Fixed, sensible defaults — these used to be dropdowns in the toolbar.
// GEN_INTERVAL_MIN: the DB prunes readings older than 24h, so we add
// "normal" data by sampling finer inside that window. 2 min = 720 points,
// which suits the detector (it trains on up to ~1000).
// EXPORT_HORIZON_MIN: a row is labelled "failure" if a critical alert
// follows within this many minutes.
const GEN_INTERVAL_MIN = 2
const EXPORT_HORIZON_MIN = 10

export default function Simulate() {
  const [machines, setMachines]       = useState([])
  const [selectedId, setSelectedId]   = useState('')
  const [bundle, setBundle]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [liveComponents, setLive]     = useState([])
  const [liveSensors, setLiveSensors] = useState([])
  const [liveRuntime, setLiveRuntime] = useState(null)
  const [showReset, setShowReset]     = useState(false)
  const [genMsg, setGenMsg]           = useState('')
  const [exportMsg, setExportMsg]     = useState('')
  const [demoMode, setDemoMode]       = useState(false)

  // Load machine list
  useEffect(() => {
    getMachines().then(m => {
      setMachines(m)
      if (m.length) setSelectedId(prev => prev || m[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Load selected machine bundle
  useEffect(() => {
    if (!selectedId) return
    getMachineBundle(selectedId).then(b => {
      setBundle(b)
      setLive(b.components)
      setLiveSensors(b.sensors)
      setLiveRuntime(parseFloat(b.machine.runtime_hours ?? 0))
    })
  }, [selectedId])

  const handleUpdate = useCallback(({ sensors, components, runtimeHours }) => {
    setLiveSensors(sensors)
    setLive(components)
    if (runtimeHours != null) setLiveRuntime(runtimeHours)
  }, [])

  const sim = useSimulator({
    machine: bundle?.machine,
    components: bundle?.components || [],
    sensors: bundle?.sensors || [],
    onUpdate: handleUpdate,
  })

  // Reload bundle helper
  const reloadBundle = useCallback(async () => {
    if (!selectedId) return
    const b = await getMachineBundle(selectedId)
    setBundle(b)
    setLive(b.components)
    setLiveSensors(b.sensors)
    setLiveRuntime(parseFloat(b.machine.runtime_hours ?? 0))
  }, [selectedId])

  async function handleReset(wipeHistory, resetRuntime) {
    await resetMachine(selectedId, wipeHistory, resetRuntime)
    sim.resetState()
    await reloadBundle()
    setShowReset(false)
  }

  async function handleGenerate() {
    setGenMsg('Generating…')
    try {
      const count = await generateHistory(selectedId, 24, GEN_INTERVAL_MIN)
      const points = Math.round((24 * 60) / GEN_INTERVAL_MIN)
      setGenMsg(`Generated ${count?.toLocaleString?.() || ''} readings — ${points} time points per sensor`)
      setTimeout(() => setGenMsg(''), 5000)
    } catch {
      setGenMsg('Failed — run step 5 migration')
      setTimeout(() => setGenMsg(''), 4000)
    }
  }

  async function handleExport() {
    setExportMsg('Exporting…')
    try {
      const r = await exportMachineDataset(bundle.machine, EXPORT_HORIZON_MIN)
      setExportMsg(`Exported ${r.rows.toLocaleString()} rows · ${(r.failureRate * 100).toFixed(1)}% labelled failure (${EXPORT_HORIZON_MIN} min horizon)`)
      setTimeout(() => setExportMsg(''), 6000)
    } catch (e) {
      setExportMsg(`Failed — ${e.message}`)
      setTimeout(() => setExportMsg(''), 6000)
    }
  }

  // ── Demo mode: one-click prepare (stop → reset → 24h healthy history) ──
  const handleDemoPrepare = useCallback(async () => {
    sim.stop()
    await resetMachine(selectedId, true, true)   // wipe history + reset runtime
    sim.resetState()
    const count = await generateHistory(selectedId, 24, GEN_INTERVAL_MIN)
    await reloadBundle()
    return count
  }, [selectedId, sim, reloadBundle])

  if (loading) return <Spinner full label="Loading machines…" />

  const machine = bundle?.machine
  const faults = machine ? faultsForType(machine.type) : []
  const overallHealth = liveComponents.length
    ? Math.round(liveComponents.reduce((a, c) => a + parseFloat(c.health_score ?? 100), 0) / liveComponents.length)
    : 100

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="page-title">Simulator</h1>
          <p className="page-sub">Stream live sensor data and inject machine-specific defects.</p>
        </div>

        {/* Primary controls: pick a machine, run it, or run the guided demo */}
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="select w-52">
            {machines.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <button onClick={sim.toggle}
            className={sim.running ? 'btn-danger flex items-center gap-2' : 'btn-primary flex items-center gap-2'}>
            {sim.running ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Play</>}
          </button>

          <button onClick={() => setDemoMode(d => !d)}
            className={demoMode ? 'btn-primary flex items-center gap-2' : 'btn-secondary flex items-center gap-2'}
            title="Guided, in-order steps for presenting">
            <Presentation className="w-4 h-4" /> Demo mode
          </button>
        </div>
      </div>

      {/* Secondary tools — deliberately quieter than the primary controls */}
      <div className="flex items-center gap-1 flex-wrap mb-6">
        <span className="text-xs text-gray-400 uppercase tracking-wide mr-2">Tools</span>
        <button onClick={() => { sim.stop(); setShowReset(true) }} className="link-btn">
          <RotateCcw className="w-4 h-4" /> Reset machine
        </button>
        <button onClick={handleGenerate} disabled={genMsg === 'Generating…'}
          className="link-btn"
          title="Wipe and regenerate 24h of healthy history">
          <DatabaseZap className={`w-4 h-4 ${genMsg === 'Generating…' ? 'animate-pulse' : ''}`} />
          {genMsg === 'Generating…' ? 'Generating…' : 'Generate 24h history'}
        </button>
        <button onClick={handleExport} disabled={exportMsg === 'Exporting…'}
          className="link-btn"
          title="Download this machine's history as a labelled CSV for the Dataset Lab">
          <Download className={`w-4 h-4 ${exportMsg === 'Exporting…' ? 'animate-pulse' : ''}`} />
          {exportMsg === 'Exporting…' ? 'Exporting…' : 'Export dataset'}
        </button>
      </div>

      {/* Export feedback */}
      {exportMsg && exportMsg !== 'Exporting…' && (
        <div className={`mb-4 text-xs rounded-lg px-3 py-2 border ${
          exportMsg.startsWith('Failed')
            ? 'text-red-600 bg-red-50 border-red-300'
            : 'text-green-600 bg-green-50 border-green-200'}`}>
          {exportMsg}
        </div>
      )}

      {/* Generate feedback — separate line so buttons never resize */}
      {genMsg && genMsg !== 'Generating…' && (
        <div className={`mb-4 text-xs rounded-lg px-3 py-2 border ${
          genMsg.startsWith('Failed')
            ? 'text-red-600 bg-red-50 border-red-300'
            : 'text-green-600 bg-green-50 border-green-200'}`}>
          {genMsg}
        </div>
      )}

      {demoMode && machine && (
        <DemoPanel
          faults={faults}
          running={sim.running}
          onPrepare={handleDemoPrepare}
          onStream={sim.start}
          onInjectFault={sim.injectFault}
          onClearFaults={sim.clearAllFaults}
        />
      )}

      {!machine ? (
        <div className="card text-gray-500">No machine selected.</div>
      ) : (
        <>
          {/* Status bar */}
          <div className="card mb-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                sim.running ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                <Activity className={`w-5 h-5 ${sim.running ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{machine.name}</p>
                <p className="text-xs text-gray-500">{machineTypeLabel(machine.type)} · {machine.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Overall health</p>
                <p className={`text-xl font-semibold ${healthColor(overallHealth)}`}>{overallHealth}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Runtime</p>
                <p className="text-xl font-semibold text-gray-900">
                  {liveRuntime != null ? `${liveRuntime.toFixed(1)}` : '—'}
                  <span className="text-xs text-gray-500 ml-1">hrs</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Ticks</p>
                <p className="text-xl font-semibold text-gray-900">{sim.tickCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Status</p>
                <span className={statusBadge(sim.running ? 'healthy' : 'offline')}>
                  {sim.running ? 'Streaming' : 'Paused'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Components + sensors */}
            <div className="lg:col-span-2">
              <h2 className="section-title">Components &amp; live sensors</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveComponents.map(c => (
                  <ComponentCard key={c.id}
                    component={{ ...c, sensors: liveSensors.filter(s => s.component_id === c.id) }} />
                ))}
              </div>
            </div>

            {/* Right panel: fault injection */}
            <div className="lg:col-span-1">
              <FaultPanel
                faults={faults}
                activeFaults={sim.activeFaults}
                onInject={sim.injectFault}
                onClear={sim.clearFault}
                onClearAll={sim.clearAllFaults}
              />
            </div>
          </div>
        </>
      )}

      {showReset && bundle && (
        <ResetDialog
          machine={bundle.machine}
          onConfirm={handleReset}
          onClose={() => setShowReset(false)}
        />
      )}
    </div>
  )
}
