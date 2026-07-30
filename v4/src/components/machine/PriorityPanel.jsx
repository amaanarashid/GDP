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
                isFirst ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-gray-500 w-5">{idx + 1}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
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
                  {p.low != null && p.high != null && (
                    <p className="text-[10px] text-gray-500" title="80% prediction interval (conformal)">
                      {Math.round(p.low)}–{Math.round(p.high)} d range
                    </p>
                  )}
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
