import { useNavigate } from 'react-router-dom'
import DigitalTwin from '../machine/DigitalTwin'
import { healthColor, healthBg, statusBadge, machineTypeLabel, fmtHours } from '../../utils/helpers'
import { MapPin, ChevronRight } from 'lucide-react'

export default function MachineCard({ machine }) {
  const navigate = useNavigate()
  const health = parseFloat(machine.overall_health ?? 100)
  const compCount = machine.components?.length || 0
  const criticalCount = machine.components?.filter(c => parseFloat(c.health_score) < 50).length || 0
  const warningCount = machine.components?.filter(c => {
    const h = parseFloat(c.health_score); return h >= 50 && h < 75
  }).length || 0

  return (
    <div onClick={() => navigate(`/machine/${machine.id}`)}
      className="card cursor-pointer hover:border-gray-700 transition-colors group">
      {/* header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate group-hover:text-indigo-400 transition-colors">
            {machine.name}
          </h3>
          <p className="text-xs text-gray-500">{machineTypeLabel(machine.type)}</p>
        </div>
        <span className={statusBadge(machine.status)}>{machine.status}</span>
      </div>

      {/* digital twin */}
      <div className="bg-gray-950/50 rounded-lg p-2 mb-3 border border-gray-800/50">
        <DigitalTwin type={machine.type} components={machine.components} running={machine.status !== 'offline'} />
      </div>

      {/* health bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full ${healthBg(health)} transition-all duration-500`} style={{ width: `${health}%` }} />
        </div>
        <span className={`text-sm font-semibold ${healthColor(health)}`}>{Math.round(health)}%</span>
      </div>

      {/* footer stats */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{machine.location || '—'}</span>
          <span>{fmtHours(machine.runtime_hours)}</span>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && <span className="badge-red">{criticalCount} critical</span>}
          {warningCount > 0 && <span className="badge-yellow">{warningCount} warning</span>}
          {criticalCount === 0 && warningCount === 0 && <span className="text-gray-600">{compCount} healthy</span>}
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
        </div>
      </div>
    </div>
  )
}
