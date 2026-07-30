import { Cpu, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

interface Props {
  total: number
  running: number
  warning: number
  critical: number
}

export default function MachineListHeader({ total, running, warning, critical }: Props) {
  const stats = [
    { label: 'Total Machines', value: total, icon: Cpu, color: 'text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'Running', value: running, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Warning', value: warning, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Critical', value: critical, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Machine Overview</h1>
        <p className="text-gray-400 text-sm mt-1">Monitor all conveyor drive systems in real-time</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bg}`}>
              <Icon className={color} size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}