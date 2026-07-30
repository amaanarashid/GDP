import { useNavigate } from 'react-router-dom'
import { fmtAgo } from '../../utils/helpers'
import { AlertTriangle, Bell } from 'lucide-react'

export function StatCard({ label, value, sub, accent = 'white' }) {
  const accentClass = {
    white:  'text-gray-900',
    green:  'text-green-600',
    yellow: 'text-yellow-600',
    red:    'text-red-600',
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
  const navigate = useNavigate()
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-600" /> Recent alerts
        </h2>
        {alerts.length > 0 && <span className="badge-gray">{alerts.length}</span>}
      </div>
      {alerts.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No alerts. All systems nominal.</p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {alerts.map(a => (
            <div key={a.id}
              onClick={() => a.machine_id && navigate(`/machine/${a.machine_id}`)}
              className={`flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-100/60 ${a.machine_id ? 'cursor-pointer' : ''}`}>
              <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                a.severity === 'critical' || a.severity === 'emergency'
                  ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{a.message}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{a.machines?.name}</span>
                  <span className="text-xs text-gray-400">·</span>
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
