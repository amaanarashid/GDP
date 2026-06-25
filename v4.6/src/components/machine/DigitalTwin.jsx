// Animated SVG digital twins per machine type.
// Each component lights up by its health score (green/yellow/red).

function healthFill(score) {
  if (score == null) return '#374151'
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#eab308'
  return '#ef4444'
}
function healthStroke(score) {
  if (score == null) return '#4b5563'
  if (score >= 75) return '#16a34a'
  if (score >= 50) return '#ca8a04'
  return '#dc2626'
}

// helper to find a component's health by name
function h(components, name) {
  const c = components?.find(c => c.name === name)
  return c ? parseFloat(c.health_score) : null
}

function Part({ x, y, w, hgt, score, label, rx = 6, running }) {
  const fill = healthFill(score)
  const stroke = healthStroke(score)
  const critical = score != null && score < 50
  return (
    <g>
      <rect x={x} y={y} width={w} height={hgt} rx={rx}
        fill={fill} fillOpacity="0.18" stroke={stroke} strokeWidth="1.5"
        className={critical && running ? 'health-twin-pulse' : ''} />
      <text x={x + w / 2} y={y + hgt / 2 - 4} textAnchor="middle"
        fontSize="10" fill="#e5e7eb" fontWeight="500">{label}</text>
      <text x={x + w / 2} y={y + hgt / 2 + 10} textAnchor="middle"
        fontSize="11" fill={fill} fontWeight="600">
        {score != null ? `${Math.round(score)}%` : '—'}
      </text>
    </g>
  )
}

// ── CONVEYOR ───────────────────────────────────────────────
function ConveyorTwin({ components, running }) {
  return (
    <svg viewBox="0 0 420 200" className="w-full">
      {/* belt line */}
      <line x1="30" y1="150" x2="390" y2="150" stroke="#4b5563" strokeWidth="3"
        strokeDasharray="8 6" className={running ? 'twin-belt' : ''} />
      <circle cx="40" cy="150" r="14" fill="none" stroke="#6b7280" strokeWidth="2" />
      <circle cx="380" cy="150" r="14" fill="none" stroke="#6b7280" strokeWidth="2" />

      <Part x={30}  y={20} w={70} hgt={50} score={h(components,'Electric Motor')} label="Motor" running={running} />
      <Part x={115} y={20} w={70} hgt={50} score={h(components,'Gearbox')} label="Gearbox" running={running} />
      <Part x={200} y={20} w={70} hgt={50} score={h(components,'Bearings')} label="Bearings" running={running} />
      <Part x={285} y={20} w={70} hgt={50} score={h(components,'VFD Drive')} label="VFD" running={running} />
      <Part x={155} y={95} w={110} hgt={40} score={h(components,'Drive Belt')} label="Drive Belt" running={running} />
    </svg>
  )
}

// ── HYDRAULIC PRESS ────────────────────────────────────────
function HydraulicTwin({ components, running }) {
  return (
    <svg viewBox="0 0 420 200" className="w-full">
      {/* press frame */}
      <rect x="150" y="20" width="120" height="160" rx="4" fill="none" stroke="#4b5563" strokeWidth="2" />
      <Part x={165} y={30}  w={90} hgt={36} score={h(components,'Electric Motor')} label="Motor" running={running} />
      <Part x={165} y={74}  w={90} hgt={36} score={h(components,'Hydraulic Pump')} label="Pump" running={running} />
      <Part x={165} y={118} w={90} hgt={36} score={h(components,'Hydraulic Cylinder')} label="Cylinder" running={running} />
      {/* oil tank */}
      <Part x={30}  y={60} w={100} hgt={50} score={h(components,'Oil Tank')} label="Oil Tank" running={running} />
      <Part x={290} y={60} w={100} hgt={50} score={h(components,'Oil Filter')} label="Oil Filter" running={running} />
      {/* pipes */}
      <line x1="130" y1="85" x2="165" y2="92" stroke="#6b7280" strokeWidth="2" />
      <line x1="255" y1="92" x2="290" y2="85" stroke="#6b7280" strokeWidth="2" />
    </svg>
  )
}

// ── AIR COMPRESSOR ─────────────────────────────────────────
function AirCompressorTwin({ components, running }) {
  return (
    <svg viewBox="0 0 420 200" className="w-full">
      {/* tank cylinder */}
      <rect x="250" y="40" width="140" height="80" rx="40" fill="none" stroke="#4b5563" strokeWidth="2" />
      <Part x={30}  y={30} w={90} hgt={45} score={h(components,'Electric Motor')} label="Motor" running={running} />
      <Part x={30}  y={95} w={90} hgt={45} score={h(components,'Compressor Pump')} label="Pump" running={running} />
      <Part x={135} y={62} w={90} hgt={45} score={h(components,'Air Filter')} label="Air Filter" running={running} />
      <Part x={270} y={58} w={100} hgt={45} score={h(components,'Air Receiver Tank')} label="Receiver" running={running} />
      {/* cooling fan */}
      <g>
        <circle cx="160" cy="150" r="22" fill={healthFill(h(components,'Cooling Fan'))} fillOpacity="0.15"
          stroke={healthStroke(h(components,'Cooling Fan'))} strokeWidth="1.5" />
        <g className={running ? 'twin-fan' : ''} style={{ transformOrigin: '160px 150px' }}>
          <line x1="160" y1="150" x2="160" y2="132" stroke={healthStroke(h(components,'Cooling Fan'))} strokeWidth="2" />
          <line x1="160" y1="150" x2="176" y2="159" stroke={healthStroke(h(components,'Cooling Fan'))} strokeWidth="2" />
          <line x1="160" y1="150" x2="144" y2="159" stroke={healthStroke(h(components,'Cooling Fan'))} strokeWidth="2" />
        </g>
        <text x="160" y="186" textAnchor="middle" fontSize="10" fill="#e5e7eb">Fan {h(components,'Cooling Fan') != null ? Math.round(h(components,'Cooling Fan'))+'%' : ''}</text>
      </g>
      {/* pipes */}
      <line x1="120" y1="85" x2="135" y2="85" stroke="#6b7280" strokeWidth="2" />
      <line x1="225" y1="85" x2="250" y2="80" stroke="#6b7280" strokeWidth="2" />
    </svg>
  )
}

export default function DigitalTwin({ type, components, running = false }) {
  const props = { components, running }
  switch (type) {
    case 'conveyor_drive':  return <ConveyorTwin {...props} />
    case 'hydraulic_press': return <HydraulicTwin {...props} />
    case 'air_compressor':  return <AirCompressorTwin {...props} />
    default:
      return (
        <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
          No digital twin for this machine type
        </div>
      )
  }
}
