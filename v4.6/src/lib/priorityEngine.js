// ============================================================
// PRIORITY ENGINE
// Combines RUL + health + trend + critical sensors into a
// single priority score and ranks components.
// ============================================================

import { sensorSeverityRaw } from './simEngine'
import { trendSlope } from './features'

// ── Compute priority for one component ─────────────────────
// Returns { score 0..100, tier, reason }
export function componentPriority({ component, sensors, readingsBySensor, rul }) {
  const health = parseFloat(component.health_score ?? 100)
  const days = rul?.days ?? 180

  // Count critical / warning sensors
  let critical = 0, warning = 0
  let worstSensor = null, worstSev = 'normal'
  sensors.forEach(s => {
    const sev = sensorSeverityRaw(s)
    if (sev === 'critical') { critical++; if (worstSev !== 'critical') { worstSev = 'critical'; worstSensor = s } }
    else if (sev === 'warning') { warning++; if (worstSev === 'normal') { worstSev = 'warning'; worstSensor = s } }
  })

  // Degradation trend: average slope across sensors (normalized)
  let trendScore = 0
  sensors.forEach(s => {
    const vals = (readingsBySensor[s.id] || []).map(r => r.value)
    if (vals.length >= 3) {
      const range = parseFloat(s.critical_threshold) - parseFloat(s.normal_min)
      const slope = trendSlope(vals.slice(-20)) / (range / 50 || 1)
      trendScore += Math.max(0, slope)
    }
  })
  trendScore = Math.min(1, trendScore / (sensors.length || 1))

  // ── Weighted priority score ──────────────────────────────
  // Each factor contributes to urgency (higher = more urgent)
  const rulUrgency    = 1 - Math.min(1, days / 60)        // 0 days = 1, 60+ days = 0
  const healthUrgency = 1 - (health / 100)                // 0% health = 1
  const trendUrgency  = trendScore                        // climbing = urgent
  const critUrgency   = Math.min(1, (critical * 0.5) + (warning * 0.2))

  const score = Math.round(
    (rulUrgency    * 0.35 +
     healthUrgency * 0.30 +
     trendUrgency  * 0.15 +
     critUrgency   * 0.20) * 100
  )

  // ── Tier ─────────────────────────────────────────────────
  let tier = 'healthy'
  if (days <= 7 || health < 40 || critical > 0) tier = 'now'
  else if (days <= 30 || health < 70 || warning > 0) tier = 'soon'

  // ── Reason string ────────────────────────────────────────
  let reason
  if (worstSensor && worstSev === 'critical') {
    reason = `${worstSensor.name} critical`
  } else if (worstSensor && worstSev === 'warning') {
    reason = `${worstSensor.name} trending up`
  } else if (trendScore > 0.3) {
    reason = 'Degrading trend detected'
  } else {
    reason = 'Stable'
  }

  return { score, tier, reason, days, health, critical, warning }
}

// ── Rank all components ────────────────────────────────────
export function rankComponents({ components, sensors, readingsBySensor, rulByComponent }) {
  const ranked = components.map(c => {
    const compSensors = sensors.filter(s => s.component_id === c.id)
    const priority = componentPriority({
      component: c,
      sensors: compSensors,
      readingsBySensor,
      rul: rulByComponent?.[c.id],
    })
    return { ...c, priority }
  })

  // Sort by score descending (most urgent first)
  ranked.sort((a, b) => b.priority.score - a.priority.score)
  return ranked
}

// ── Tier display config ────────────────────────────────────
export const TIER_CONFIG = {
  now:     { label: 'Service now',  color: 'red',    dot: 'bg-red-500',    badge: 'badge-red' },
  soon:    { label: 'Plan soon',    color: 'yellow', dot: 'bg-yellow-500', badge: 'badge-yellow' },
  healthy: { label: 'Healthy',      color: 'green',  dot: 'bg-green-500',  badge: 'badge-green' },
}
