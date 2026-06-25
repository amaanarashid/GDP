import { supabase } from './supabase'

// ── Reset machine (RPC) ────────────────────────────────────
export async function resetMachine(machineId, wipeHistory = false) {
  const { error } = await supabase.rpc('reset_machine', {
    p_machine_id: machineId,
    p_wipe_history: wipeHistory,
  })
  if (error) throw error
}

// ── Generate 24h history (RPC) ─────────────────────────────
export async function generateHistory(machineId, hours = 24, intervalMin = 15) {
  const { data, error } = await supabase.rpc('generate_history', {
    p_machine_id: machineId,
    p_hours: hours,
    p_interval_min: intervalMin,
  })
  if (error) throw error
  return data
}

// ── Prune old readings (RPC) ───────────────────────────────
// SQL function prunes anything older than 24h (no args).
export async function pruneOldReadings() {
  const { data, error } = await supabase.rpc('prune_old_readings')
  if (error) console.error('prune', error)
  return data
}

// ── Readings history for all sensors of a machine ──────────
export async function getMachineReadingsHistory(machineId, hoursBack = 24) {
  const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString()
  // get sensor ids for this machine
  const { data: sensors } = await supabase
    .from('sensors').select('id, name, unit, component_id').eq('machine_id', machineId)
  if (!sensors?.length) return { sensors: [], readings: {} }

  const ids = sensors.map(s => s.id)
  const { data: readings, error } = await supabase
    .from('sensor_readings')
    .select('sensor_id, value, timestamp')
    .in('sensor_id', ids)
    .gte('timestamp', since)
    .order('timestamp', { ascending: true })
  if (error) throw error

  // group by sensor_id
  const grouped = {}
  ;(readings || []).forEach(r => {
    if (!grouped[r.sensor_id]) grouped[r.sensor_id] = []
    grouped[r.sensor_id].push({ value: parseFloat(r.value), timestamp: r.timestamp })
  })
  return { sensors, readings: grouped }
}

// ── Write RUL predictions (batch) ──────────────────────────
export async function writeRULPredictions(predictions) {
  // predictions: [{ machine_id, component_id, days_remaining, confidence }]
  const { error } = await supabase.from('rul_predictions').insert(predictions)
  if (error) console.error('writeRUL', error)
}

// ── Complete maintenance ───────────────────────────────────
export async function completeMaintenance({ machineId, technicianId, componentIds, restoreAll, notes, healthBefore }) {
  // 1. Restore selected (or all) components to 100%
  let q = supabase.from('components').update({
    health_score: 100, color_status: 'green', last_serviced: new Date().toISOString(),
  }).eq('machine_id', machineId)

  if (!restoreAll && componentIds?.length) {
    q = q.in('id', componentIds)
  }
  const { error: compErr } = await q
  if (compErr) throw compErr

  // 2. Refresh machine overall health
  await supabase.rpc('update_machine_health', { p_machine_id: machineId })

  // 3. Log maintenance
  const { error: logErr } = await supabase.from('maintenance_logs').insert({
    machine_id: machineId,
    technician_id: technicianId,
    components_serviced: restoreAll ? null : componentIds,
    notes: notes || (restoreAll ? 'Full machine restored to health' : 'Components serviced'),
    health_before: healthBefore,
    health_after: 100,
  })
  if (logErr) throw logErr

  // Alerts are intentionally kept as history (not deleted/resolved)
}
