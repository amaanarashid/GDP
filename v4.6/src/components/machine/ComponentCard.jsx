import { healthColor, healthBg } from '../../utils/helpers'
import SensorRow from './SensorRow'

export default function ComponentCard({ component }) {
  const health = parseFloat(component.health_score ?? 100)
  return (
    <div className="card-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{component.name}</h3>
        <span className={`text-sm font-semibold ${healthColor(health)}`}>{Math.round(health)}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
        <div className={`h-full ${healthBg(health)} transition-all duration-500`} style={{ width: `${health}%` }} />
      </div>
      <div className="divide-y divide-gray-800/50">
        {component.sensors?.map(s => <SensorRow key={s.id} sensor={s} />)}
      </div>
    </div>
  )
}
