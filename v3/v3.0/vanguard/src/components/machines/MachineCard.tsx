import { useNavigate } from 'react-router-dom'
import { Machine, MachineHealthSummary } from '../../types'
import StatusBadge from '../shared/StatusBadge'
import { MapPin, Cpu, AlertTriangle, Activity } from 'lucide-react'

interface Props {
  machine: Machine
  summary?: MachineHealthSummary
}

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-green-500' :
    score >= 60 ? 'bg-yellow-500' :
    score >= 40 ? 'bg-orange-500' : 'bg-red-500'

  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

export default function MachineCard({ machine, summary }: Props) {
  const navigate = useNavigate()
  const health = summary?.overall_health_score ?? null

  return (
    <div
      onClick={() => navigate(`/machine/${machine.id}`)}
      className="glass glass-hover cursor-pointer p-5 flex flex-col gap-4 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">{machine.name}</h2>
          <p className="text-gray-500 text-xs mt-0.5">{machine.model} · {machine.serial_number}</p>
        </div>
        <StatusBadge status={machine.status} />
      </div>

      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <MapPin size={12} />
        <span>{machine.location}</span>
      </div>

      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <Cpu size={12} />
        <span>{machine.manufacturer}</span>
      </div>

      {health !== null ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1">
              <Activity size={12} /> Health Score
            </span>
            <span className={`font-semibold ${
              health >= 80 ? 'text-green-400' :
              health >= 60 ? 'text-yellow-400' :
              health >= 40 ? 'text-orange-400' : 'text-red-400'
            }`}>
              {health.toFixed(1)}%
            </span>
          </div>
          <HealthBar score={health} />
        </div>
      ) : (
        <div className="text-xs text-gray-600 italic">No health data yet</div>
      )}

      {summary && summary.active_alerts > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} />
          <span>{summary.active_alerts} active alert{summary.active_alerts > 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="text-xs text-gray-600 pt-1 border-t border-gray-800">
        Commissioned {new Date(machine.commissioned_at).toLocaleDateString()}
      </div>
    </div>
  )
}