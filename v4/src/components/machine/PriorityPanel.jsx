// ============================================================
// MAINTENANCE PRIORITY
// Ranks components by urgency and answers the planner's question:
// what do I service first, and by when?
//
// The "days left" figure is labelled by source, so it is always
// clear whether a number came from the ML model (real-data
// machines) or from degradation-trend extrapolation (simulated).
// ============================================================
import { TIER_CONFIG } from '../../lib/priorityEngine'
import { healthBg } from '../../utils/helpers'
import { AlertTriangle, Clock, CheckCircle2, BrainCircuit, TrendingDown } from 'lucide-react'

const TIER_ICON = { now: AlertTriangle, soon: Clock, healthy: CheckCircle2 }

// "in 11 days" is abstract; "by Tue 12 Aug" is something you can put
// in a calendar. Planners think in dates.
function dueLabel(days) {
  if (days == null || isNaN(days)) return null
  if (days >= 180) return 'no action needed'
  const d = new Date(Date.now() + days * 86400000)
  const fmt = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  if (days < 1) return 'today'
  if (days < 2) return 'tomorrow'
  return `by ${fmt}`
}

function daysLabel(days) {
  if (days == null || isNaN(days)) return '—'
  if (days >= 180) return '180+ d'
  if (days < 1) return `${Math.round(days * 24)} h`
  return `${days.toFixed(days < 10 ? 1 : 0)} d`
}

export default function PriorityPanel({ rankedComponents, modelReady }) {
  const urgent = rankedComponents.filter(c => c.priority?.tier !== 'healthy').length

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="section-title mb-0">Maintenance priority</h2>
        {!modelReady
          ? <span className="text-xs text-gray-500">analysing…</span>
          : <span className="text-xs text-gray-500">
              {urgent ? `${urgent} need${urgent === 1 ? 's' : ''} attention` : 'all healthy'}
            </span>}
      </div>
      <p className="text-xs text-gray-500 mb-4">Ordered by urgency — service the top item first.</p>

      <div className="space-y-2">
        {rankedComponents.map((c, idx) => {
          const p = c.priority
          const cfg = TIER_CONFIG[p.tier]
          const Icon = TIER_ICON[p.tier]
          const isFirst = idx === 0 && p.tier !== 'healthy'
          const due = dueLabel(p.days)
          const isML = p.source === 'ml-server'

          return (
            <div key={c.id}
              className={`rounded-lg border p-3 transition-colors ${
                isFirst ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>

              {/* Row 1: rank, name, verdict */}
              <div className="flex items-start gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  p.tier === 'now' ? 'bg-red-500 text-white'
                  : p.tier === 'soon' ? 'bg-yellow-500 text-white'
                  : 'bg-gray-200 text-gray-600'}`}>
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    {isFirst && <span className="badge-red text-[10px]">SERVICE FIRST</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.reason}</p>
                </div>

                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${
                    p.tier === 'now' ? 'text-red-600'
                    : p.tier === 'soon' ? 'text-yellow-600' : 'text-green-600'}`}>
                    {daysLabel(p.days)}
                  </p>
                  {p.low != null && p.high != null && (
                    <p className="text-[10px] text-gray-500" title="80% prediction interval">
                      {Math.round(p.low)}–{Math.round(p.high)} d
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: health bar */}
              <div className="flex items-center gap-2 mt-2.5">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${healthBg(p.health)} transition-all duration-500`}
                    style={{ width: `${Math.max(0, Math.min(100, p.health))}%` }} />
                </div>
                <span className="text-[11px] text-gray-500 tabular-nums w-9 text-right">
                  {Math.round(p.health)}%
                </span>
              </div>

              {/* Row 3: when + how the number was produced */}
              <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                <span className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Icon className="w-3 h-3" /> {cfg.label}
                  {due && <span className="text-gray-400">· {due}</span>}
                </span>
                {p.days < 180 && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-1"
                    title={isML
                      ? 'Predicted by the quantile RUL model trained on real MetroPT-3 data'
                      : 'Degradation-trend extrapolation: health margin ÷ current decline rate'}>
                    {isML
                      ? <><BrainCircuit className="w-3 h-3" /> ML model</>
                      : <><TrendingDown className="w-3 h-3" /> trend estimate</>}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
