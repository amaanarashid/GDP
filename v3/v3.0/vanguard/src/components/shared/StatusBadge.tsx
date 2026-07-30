type Status = 'running' | 'idle' | 'warning' | 'critical' | 'offline' | 'good' | 'fair' | 'poor'

const styles: Record<Status, string> = {
  running: 'bg-green-500/10 text-green-400 border-green-500/20',
  idle:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  critical:'bg-red-500/10 text-red-400 border-red-500/20',
  offline: 'bg-gray-700/10 text-gray-500 border-gray-700/20',
  good:    'bg-green-500/10 text-green-400 border-green-500/20',
  fair:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  poor:    'bg-red-500/10 text-red-400 border-red-500/20',
}

const dots: Record<Status, string> = {
  running: 'bg-green-400',
  idle:    'bg-gray-400',
  warning: 'bg-yellow-400',
  critical:'bg-red-400',
  offline: 'bg-gray-500',
  good:    'bg-green-400',
  fair:    'bg-yellow-400',
  poor:    'bg-red-400',
}

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}