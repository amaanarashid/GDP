import { fmtAgo, statusBadge } from '../../utils/helpers'
import { AlertTriangle, Bell } from 'lucide-react'

export function StatCard({ label, value, sub, accent = 'white' }) {
  const accentClass = {
    white:  'text-white',
    green:  'text-green-400',
    yellow: 'text-yellow-400',
    red:    'text-red-400',
  }[accent]
  return (
    <div className="card">
      <p className="stat-label">{label}</p>
      <p className={`stat-value ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export function AlertsFeed({ alerts }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-400" /> Recent alerts
        </h2>
        {alerts.length > 0 && <span className="badge-gray">{alerts.length}</span>}
      </div>
      {alerts.length === 0 ? (
        <p className="text-sm text-gray-600 py-6 text-center">No alerts. All systems nominal.</p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {alerts.map(a => (
            <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-800/30">
              <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                a.severity === 'critical' || a.severity === 'emergency'
                  ? 'bg-red-900/40 text-red-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{a.message}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{a.machines?.name}</span>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-500">{fmtAgo(a.created_at)}</span>
                  {a.resolved && <span className="badge-green text-[10px]">resolved</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
