import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMachineDetail } from '../../hooks/useMachineDetail'
import { useAuth } from '../../context/AuthContext'
import DigitalTwin from '../../components/machine/DigitalTwin'
import ComponentCard from '../../components/machine/ComponentCard'
import PriorityPanel from '../../components/machine/PriorityPanel'
import MaintenanceModal from '../../components/machine/MaintenanceModal'
import SensorChart from '../../components/charts/SensorChart'
import Spinner from '../../components/ui/Spinner'
import {
  healthColor, healthBg, statusBadge, machineTypeLabel, fmtHours, fmtAgo,
} from '../../utils/helpers'
import { ArrowLeft, Wrench, MapPin, Clock, Activity, History } from 'lucide-react'

export default function MachineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { bundle, history, ranked, logs, loading, modelReady, error, reload } = useMachineDetail(id)
  const [showMaint, setShowMaint] = useState(false)

  if (loading) return <Spinner full label="Loading machine…" />
  if (error || !bundle) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-4">Machine not found.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary">Back to dashboard</button>
      </div>
    )
  }

  const { machine, components, sensors } = bundle
  const health = parseFloat(machine.overall_health ?? 100)
  const running = machine.status !== 'offline'

  // pick a few key sensors to chart (first sensor of each component)
  const chartSensors = components.map(c => sensors.find(s => s.component_id === c.id)).filter(Boolean)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/dashboard')}
          className="w-9 h-9 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center hover:bg-gray-800">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">{machine.name}</h1>
            <span className={statusBadge(machine.status)}>{machine.status}</span>
          </div>
          <p className="text-gray-500 text-sm">{machineTypeLabel(machine.type)}</p>
        </div>
        <button onClick={() => setShowMaint(true)} className="btn-primary flex items-center gap-2">
          <Wrench className="w-4 h-4" /> Complete maintenance
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="stat-label">Overall health</p>
          <p className={`stat-value ${healthColor(health)}`}>{Math.round(health)}%</p>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
            <div className={`h-full ${healthBg(health)}`} style={{ width: `${health}%` }} />
          </div>
        </div>
        <div className="card">
          <p className="stat-label flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</p>
          <p className="text-lg font-semibold text-white mt-1">{machine.location || '—'}</p>
        </div>
        <div className="card">
          <p className="stat-label flex items-center gap-1"><Clock className="w-3 h-3" /> Runtime</p>
          <p className="text-lg font-semibold text-white mt-1">{fmtHours(machine.runtime_hours)}</p>
        </div>
        <div className="card">
          <p className="stat-label flex items-center gap-1"><Activity className="w-3 h-3" /> Components</p>
          <p className="text-lg font-semibold text-white mt-1">{components.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Digital twin */}
        <div className="lg:col-span-2 card">
          <h2 className="section-title">Digital twin</h2>
          <div className="bg-gray-950/50 rounded-lg p-4 border border-gray-800/50">
            <DigitalTwin type={machine.type} components={components} running={running} />
          </div>
        </div>

        {/* Priority */}
        <div className="lg:col-span-1">
          <PriorityPanel rankedComponents={ranked.length ? ranked : components.map(c => ({ ...c, priority: { score: 0, tier: 'healthy', reason: 'Analyzing…', days: 180, health: parseFloat(c.health_score ?? 100), critical: 0, warning: 0 } }))} modelReady={modelReady} />
        </div>
      </div>

      {/* Components + live sensors */}
      <h2 className="section-title">Components &amp; live sensors</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {components.map(c => (
          <ComponentCard key={c.id}
            component={{ ...c, sensors: sensors.filter(s => s.component_id === c.id) }} />
        ))}
      </div>

      {/* Sensor history charts */}
      <h2 className="section-title">Sensor history (24h)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {chartSensors.map(s => (
          <div key={s.id} className="card-sm">
            <SensorChart sensor={s} readings={history[s.id] || []} height={140} />
          </div>
        ))}
      </div>

      {/* Maintenance history */}
      <h2 className="section-title flex items-center gap-2"><History className="w-4 h-4" /> Maintenance history</h2>
      <div className="card">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-600 py-6 text-center">No maintenance records yet.</p>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {logs.map(log => (
              <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-gray-200">{log.notes || 'Maintenance performed'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {log.profiles?.full_name || log.profiles?.email || 'Technician'} · {fmtAgo(log.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">
                    {log.health_before != null ? `${Math.round(log.health_before)}%` : '—'}
                    {' → '}
                    <span className="text-green-400">{log.health_after != null ? `${Math.round(log.health_after)}%` : '100%'}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showMaint && (
        <MaintenanceModal
          machine={machine}
          components={components}
          onClose={() => setShowMaint(false)}
          onComplete={() => { setShowMaint(false); reload() }}
        />
      )}
    </div>
  )
}
