import { formatSensorValue } from '../../utils/helpers'
import { sensorSeverityRaw } from '../../lib/simEngine'

export default function SensorRow({ sensor }) {
  const severity = sensorSeverityRaw(sensor)
  const v   = parseFloat(sensor.current_value ?? sensor.normal_min)
  const lo  = parseFloat(sensor.normal_min)
  const hi  = parseFloat(sensor.critical_threshold)
  const pct = Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))

  const barColor = severity === 'critical' ? 'bg-red-500'
    : severity === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
  const dotColor = severity === 'critical' ? 'bg-red-500'
    : severity === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
  const valColor = severity === 'critical' ? 'text-red-400'
    : severity === 'warning' ? 'text-yellow-400' : 'text-gray-200'

  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <span className="text-sm text-gray-400 w-40 shrink-0 truncate">{sensor.name}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-mono w-24 text-right shrink-0 ${valColor}`}>
        {formatSensorValue(sensor.current_value, sensor.unit)}
      </span>
    </div>
  )
}
