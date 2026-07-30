import { format, formatDistanceToNow } from 'date-fns'

// ── Health ────────────────────────────────────────────
export function healthColor(score) {
  if (score >= 75) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

export function healthBg(score) {
  if (score >= 75) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function healthStatus(score) {
  if (score >= 75) return 'healthy'
  if (score >= 50) return 'warning'
  return 'critical'
}

export function colorStatus(score) {
  if (score >= 75) return 'green'
  if (score >= 50) return 'yellow'
  return 'red'
}

// ── Status badge classes ──────────────────────────────
export function statusBadge(status) {
  const map = {
    healthy:  'badge-green',
    warning:  'badge-yellow',
    critical: 'badge-red',
    offline:  'badge-gray',
    green:    'badge-green',
    yellow:   'badge-yellow',
    red:      'badge-red',
  }
  return map[status] || 'badge-gray'
}

// ── Sensor value formatting ───────────────────────────
export function formatSensorValue(value, unit) {
  if (value === null || value === undefined) return '—'
  const v = parseFloat(value)
  if (isNaN(v)) return '—'
  switch (unit) {
    case '°C':    return `${v.toFixed(1)} °C`
    case 'A':     return `${v.toFixed(1)} A`
    case 'mm/s':  return `${v.toFixed(2)} mm/s`
    case 'bar':   return `${v.toFixed(2)} bar`
    case '%':     return `${v.toFixed(1)}%`
    case 'RPM':   return `${Math.round(v)} RPM`
    case 'V':     return `${Math.round(v)} V`
    case 'dB':    return `${v.toFixed(1)} dB`
    case 'mm':    return `${v.toFixed(1)} mm`
    case 'cnt':   return `${Math.round(v)}`
    default:      return `${v.toFixed(2)} ${unit}`
  }
}

// ── Sensor severity ───────────────────────────────────
export function sensorSeverity(sensor) {
  const v = parseFloat(sensor.current_value)
  if (isNaN(v)) return 'normal'
  // Oil level: lower is worse
  if (sensor.name === 'Oil Level') {
    if (v <= sensor.critical_threshold) return 'critical'
    if (v <= sensor.warning_threshold)  return 'warning'
    return 'normal'
  }
  if (v >= sensor.critical_threshold) return 'critical'
  if (v >= sensor.warning_threshold)  return 'warning'
  return 'normal'
}

export function severityColor(severity) {
  const map = { normal: 'text-gray-400', warning: 'text-yellow-400', critical: 'text-red-400' }
  return map[severity] || 'text-gray-400'
}

export function severityDot(severity) {
  const map = { normal: 'bg-green-500', warning: 'bg-yellow-500', critical: 'bg-red-500' }
  return map[severity] || 'bg-gray-500'
}

// ── Machine type label ────────────────────────────────
export function machineTypeLabel(type) {
  const map = {
    conveyor_drive:  'Conveyor Drive System',
    hydraulic_press: 'Industrial Hydraulic Press',
    air_compressor:  'Air Compressor',
    custom:          'Custom Machine',
  }
  return map[type] || type
}

// ── Date helpers ──────────────────────────────────────
export function fmtDate(d)     { return d ? format(new Date(d), 'dd MMM yyyy, HH:mm') : '—' }
export function fmtAgo(d)      { return d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—' }
export function fmtHours(h)    { return h != null ? `${Number(h).toLocaleString()} hrs` : '—' }

// ── RUL color ─────────────────────────────────────────
export function rulColor(days) {
  if (days === null || days === undefined) return 'text-gray-400'
  if (days <= 7)  return 'text-red-400'
  if (days <= 30) return 'text-yellow-400'
  return 'text-green-400'
}

// ── Clamp ────────────────────────────────────────────
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}
