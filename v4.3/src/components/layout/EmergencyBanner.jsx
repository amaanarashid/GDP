import { useEmergency } from '../../context/EmergencyContext'
import { AlertTriangle, X } from 'lucide-react'

export default function EmergencyBanner() {
  const { emergencies, dismiss } = useEmergency()
  if (!emergencies.length) return null

  return (
    <div className="space-y-2 mb-4">
      {emergencies.map(e => (
        <div key={e.id}
          className="emergency-banner rounded-lg px-4 py-3 flex items-center gap-3 text-white border border-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">EMERGENCY{e.machines?.name ? ` — ${e.machines.name}` : ''}</p>
            <p className="text-sm text-red-100 truncate">{e.message}</p>
          </div>
          <button onClick={() => dismiss(e.id)} className="shrink-0 hover:bg-red-800/50 rounded p-1" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
