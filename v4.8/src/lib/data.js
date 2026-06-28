import { supabase } from './supabase'

// ── Machines ───────────────────────────────────────────────
export async function getMachines() {
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getMachine(id) {
  const { data, error } = await supabase
    .from('machines').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// ── Components + sensors for a machine ─────────────────────
export async function getComponents(machineId) {
  const { data, error } = await supabase
    .from('components')
    .select('*')
    .eq('machine_id', machineId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getSensors(machineId) {
  const { data, error } = await supabase
    .from('sensors')
    .select('*')
    .eq('machine_id', machineId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// Full machine bundle: machine + components + sensors grouped
export async function getMachineBundle(machineId) {
  const [machine, components, sensors] = await Promise.all([
    getMachine(machineId),
    getComponents(machineId),
    getSensors(machineId),
  ])
  // attach sensors to components
  const compMap = {}
  components.forEach(c => { compMap[c.id] = { ...c, sensors: [] } })
  sensors.forEach(s => { if (compMap[s.component_id]) compMap[s.component_id].sensors.push(s) })
  return { machine, components: Object.values(compMap), sensors }
}

// ── Write sensor readings (batch) ──────────────────────────
export async function writeReadings(readings) {
  // readings: [{ sensor_id, value }]
  const { error } = await supabase.from('sensor_readings').insert(readings)
  if (error) console.error('writeReadings', error)
}

// ── Update sensor current values (batch via upsert) ────────
export async function updateSensorValues(updates) {
  // updates: [{ id, current_value }]
  const promises = updates.map(u =>
    supabase.from('sensors').update({ current_value: u.current_value }).eq('id', u.id)
  )
  await Promise.allSettled(promises)
}

// ── Update component health ────────────────────────────────
export async function updateComponentHealth(updates) {
  // updates: [{ id, health_score, color_status }]
  const promises = updates.map(u =>
    supabase.from('components')
      .update({ health_score: u.health_score, color_status: u.color_status })
      .eq('id', u.id)
  )
  await Promise.allSettled(promises)
}

// ── Recompute machine overall health (RPC) ─────────────────
export async function refreshMachineHealth(machineId) {
  await supabase.rpc('update_machine_health', { p_machine_id: machineId })
}

// ── Increment machine runtime hours ────────────────────────
export async function incrementRuntime(machineId, hours) {
  const { error } = await supabase.rpc('increment_runtime', {
    p_machine_id: machineId,
    p_hours: hours,
  })
  if (error) console.error('incrementRuntime', error)
}

// ── Sensor readings history (for charts) ───────────────────
export async function getReadingsHistory(sensorId, limit = 60) {
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('value, timestamp')
    .eq('sensor_id', sensorId)
    .order('timestamp', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).reverse()
}

// ── Create alert ───────────────────────────────────────────
export async function createAlert(alert) {
  const { error } = await supabase.from('alerts').insert(alert)
  if (error) console.error('createAlert', error)
}
