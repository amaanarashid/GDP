import { useState, useEffect, useCallback } from 'react'
import { getMachines, getMachineBundle } from '../../lib/data'
import { resetMachine, generateHistory } from '../../lib/maintenanceData'
import { faultsForType } from '../../lib/faults'
import { useSimulator } from '../../hooks/useSimulator'
import { machineTypeLabel, healthColor, statusBadge } from '../../utils/helpers'
import ComponentCard from '../../components/machine/ComponentCard'
import FaultPanel from '../../components/machine/FaultPanel'
import ResetDialog from '../../components/machine/ResetDialog'
import Spinner from '../../components/ui/Spinner'
import { Play, Pause, Activity, RotateCcw, DatabaseZap } from 'lucide-react'

export default function Simulate() {
  const [machines, setMachines]       = useState([])
  const [selectedId, setSelectedId]   = useState('')
  const [bundle, setBundle]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [liveComponents, setLive]     = useState([])
  const [liveSensors, setLiveSensors] = useState([])
  const [showReset, setShowReset]     = useState(false)
  const [genMsg, setGenMsg]           = useState('')

  // Load machine list
  useEffect(() => {
    getMachines().then(m => {
      setMachines(m)
      if (m.length && !selectedId) setSelectedId(m[0].id)
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
    })
  }, [selectedId])

  const handleUpdate = useCallback(({ sensors, components }) => {
    setLiveSensors(sensors)
    setLive(components)
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
      const count = await generateHistory(selectedId, 24, 15)
      setGenMsg(`Generated ${count?.toLocaleString?.() || ''} readings`)
      setTimeout(() => setGenMsg(''), 3000)
    } catch (e) {
      setGenMsg('Failed — run step 5 migration')
      setTimeout(() => setGenMsg(''), 4000)
    }
  }

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
          <h1 className="text-2xl font-semibold text-white mb-1">Simulator</h1>
          <p className="text-gray-500">Stream live sensor data and inject machine-specific defects.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="select w-64">
            {machines.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button onClick={sim.toggle}
            className={sim.running ? 'btn-danger flex items-center gap-2' : 'btn-primary flex items-center gap-2'}>
            {sim.running ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Play</>}
          </button>
          <button onClick={() => { sim.stop(); setShowReset(true) }}
            className="btn-secondary flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button onClick={handleGenerate} className="btn-secondary flex items-center gap-2"
            title="Generate 24h of history for charts">
            <DatabaseZap className="w-4 h-4" /> {genMsg || 'Generate 24h'}
          </button>
        </div>
      </div>

      {!machine ? (
        <div className="card text-gray-500">No machine selected.</div>
      ) : (
        <>
          {/* Status bar */}
          <div className="card mb-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                sim.running ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                <Activity className={`w-5 h-5 ${sim.running ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{machine.name}</p>
                <p className="text-xs text-gray-500">{machineTypeLabel(machine.type)} · {machine.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Overall health</p>
                <p className={`text-xl font-semibold ${healthColor(overallHealth)}`}>{overallHealth}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Ticks</p>
                <p className="text-xl font-semibold text-white">{sim.tickCount}</p>
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

            {/* Fault panel */}
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
