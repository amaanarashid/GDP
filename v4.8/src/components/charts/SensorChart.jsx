import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format } from 'date-fns'

export default function SensorChart({ sensor, readings, height = 160 }) {
  const data = (readings || []).map(r => ({
    t: new Date(r.timestamp).getTime(),
    value: parseFloat(r.value),
  }))

  const warn = parseFloat(sensor.warning_threshold)
  const crit = parseFloat(sensor.critical_threshold)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-600 text-xs" style={{ height }}>
        No history yet
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-300">{sensor.name}</span>
        <span className="text-xs text-gray-500">{sensor.unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']}
            tickFormatter={t => format(new Date(t), 'HH:mm')}
            tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#374151" />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#374151"
            domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#9ca3af' }}
            labelFormatter={t => format(new Date(t), 'dd MMM HH:mm')}
            formatter={v => [`${parseFloat(v).toFixed(2)} ${sensor.unit}`, sensor.name]} />
          {!isNaN(warn) && <ReferenceLine y={warn} stroke="#eab308" strokeDasharray="4 4" strokeWidth={1} />}
          {!isNaN(crit) && <ReferenceLine y={crit} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />}
          <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
