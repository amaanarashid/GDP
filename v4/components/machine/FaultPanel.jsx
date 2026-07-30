import {
  Thermometer, Zap, Settings, CircleDot, MoveHorizontal, Cpu,
  Waves, Droplet, Filter, Wind, Fan, AlertCircle, X,
} from 'lucide-react'

const ICONS = {
  thermometer: Thermometer, zap: Zap, settings: Settings, 'circle-dot': CircleDot,
  'move-horizontal': MoveHorizontal, cpu: Cpu, waves: Waves, droplet: Droplet,
  filter: Filter, wind: Wind, fan: Fan,
}

export default function FaultPanel({ faults, activeFaults, onInject, onClear, onClearAll }) {
  const activeIds = Object.keys(activeFaults)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0">Fault injection</h2>
        {activeIds.length > 0 && (
          <button onClick={onClearAll} className="text-xs text-gray-400 hover:text-white">
            Clear all ({activeIds.length})
          </button>
        )}
      </div>

      <div className="space-y-2">
        {faults.map(fault => {
          const Icon = ICONS[fault.icon] || AlertCircle
          const active = activeFaults[fault.id]
          return (
            <div key={fault.id}
              className={`rounded-lg border p-3 transition-colors ${
                active ? 'border-red-700 bg-red-900/20' : 'border-gray-800 bg-gray-900/50'
              }`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  active ? 'bg-red-900/50 text-red-400' : 'bg-gray-800 text-gray-400'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{fault.label}</p>
                    {active ? (
                      <button onClick={() => onClear(fault.id)}
                        className="shrink-0 text-gray-400 hover:text-white" aria-label="Stop fault">
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => onInject(fault)}
                        className="shrink-0 text-xs bg-gray-800 hover:bg-red-900/50 hover:text-red-400 text-gray-300 px-2.5 py-1 rounded-md transition-colors">
                        Inject
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{fault.description}</p>
                  {active && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 transition-all duration-500"
                          style={{ width: `${Math.round(active.intensity * 100)}%` }} />
                      </div>
                      <span className="text-xs text-red-400 font-mono">
                        {Math.round(active.intensity * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
