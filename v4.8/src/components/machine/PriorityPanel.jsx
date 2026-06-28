import { TIER_CONFIG } from '../../lib/priorityEngine'
import { rulColor } from '../../utils/helpers'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'

const TIER_ICON = {
  now:     AlertTriangle,
  soon:    Clock,
  healthy: CheckCircle2,
}

export default function PriorityPanel({ rankedComponents, modelReady }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0">Maintenance priority</h2>
        {!modelReady && <span className="text-xs text-gray-500">training model…</span>}
      </div>

      <div className="space-y-2">
        {rankedComponents.map((c, idx) => {
          const p = c.priority
          const cfg = TIER_CONFIG[p.tier]
          const Icon = TIER_ICON[p.tier]
          const isFirst = idx === 0 && p.tier !== 'healthy'

          return (
            <div key={c.id}
              className={`rounded-lg border p-3 ${
                isFirst ? 'border-red-700 bg-red-900/10' : 'border-gray-800 bg-gray-900/40'}`}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-gray-500 w-5">{idx + 1}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    {isFirst && <span className="badge-red text-[10px]">SERVICE FIRST</span>}
                  </div>
                  <p className="text-xs text-gray-500">
                    Health {Math.round(p.health)}% · {p.reason}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${rulColor(p.days)}`}>
                    {p.days >= 180 ? '180+ d' : `~${p.days} d`}
                  </p>
                  <p className="text-[10px] text-gray-500 flex items-center gap-1 justify-end">
                    <Icon className="w-3 h-3" /> {cfg.label}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
