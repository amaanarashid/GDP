import { supabase } from './supabase'
import { PRESETS } from './presets'

// ── Create machine from preset ─────────────────────────────
export async function createMachineFromPreset({ name, type, location, runtimeHours = 0 }) {
  // 1. Insert machine
  const { data: machine, error: mErr } = await supabase
    .from('machines')
    .insert({ name, type, location, runtime_hours: runtimeHours, status: 'healthy', overall_health: 100 })
    .select()
    .single()
  if (mErr) throw mErr

  // set qr_code = machine id (decoded by scanner)
  await supabase.from('machines').update({ qr_code: machine.id }).eq('id', machine.id)

  const preset = PRESETS[type]
  if (!preset) return machine

  // 2. Insert components + sensors
  for (const comp of preset.components) {
    const { data: component, error: cErr } = await supabase
      .from('components')
      .insert({ machine_id: machine.id, name: comp.name, health_score: 100, color_status: 'green' })
      .select()
      .single()
    if (cErr) throw cErr

    const sensorRows = comp.sensors.map(s => ({
      machine_id: machine.id,
      component_id: component.id,
      name: s.name,
      unit: s.unit,
      normal_min: s.normal_min,
      normal_max: s.normal_max,
      warning_threshold: s.warning_threshold,
      critical_threshold: s.critical_threshold,
      current_value: s.current_value,
      detects: s.detects,
    }))
    const { error: sErr } = await supabase.from('sensors').insert(sensorRows)
    if (sErr) throw sErr
  }

  return machine
}

// ── Create custom machine (admin-defined components/sensors)─
export async function createCustomMachine({ name, location, runtimeHours = 0, components }) {
  const { data: machine, error: mErr } = await supabase
    .from('machines')
    .insert({ name, type: 'custom', location, runtime_hours: runtimeHours, status: 'healthy', overall_health: 100 })
    .select()
    .single()
  if (mErr) throw mErr

  await supabase.from('machines').update({ qr_code: machine.id }).eq('id', machine.id)

  for (const comp of components) {
    if (!comp.name?.trim()) continue
    const { data: component, error: cErr } = await supabase
      .from('components')
      .insert({ machine_id: machine.id, name: comp.name, health_score: 100, color_status: 'green' })
      .select()
      .single()
    if (cErr) throw cErr

    const sensorRows = (comp.sensors || [])
      .filter(s => s.name?.trim())
      .map(s => ({
        machine_id: machine.id,
        component_id: component.id,
        name: s.name,
        unit: s.unit || '',
        normal_min: Number(s.normal_min) || 0,
        normal_max: Number(s.normal_max) || 100,
        warning_threshold: Number(s.warning_threshold) || 80,
        critical_threshold: Number(s.critical_threshold) || 95,
        current_value: Number(s.normal_min) || 0,
        detects: s.detects ? s.detects.split(',').map(d => d.trim()) : [],
      }))
    if (sensorRows.length) {
      const { error: sErr } = await supabase.from('sensors').insert(sensorRows)
      if (sErr) throw sErr
    }
  }

  return machine
}

// ── Update machine (name, location) ────────────────────────
export async function updateMachine(id, { name, location }) {
  const { error } = await supabase
    .from('machines')
    .update({ name, location, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Soft delete (mark offline) ─────────────────────────────
export async function softDeleteMachine(id) {
  const { error } = await supabase
    .from('machines')
    .update({ status: 'offline', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Restore a soft-deleted machine ─────────────────────────
export async function restoreMachine(id) {
  const { error } = await supabase
    .from('machines')
    .update({ status: 'healthy', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Emergency broadcast to ALL machines ────────────────────
export async function broadcastEmergency(message, createdBy) {
  const { error } = await supabase
    .from('emergency_broadcasts')
    .insert({ message, severity: 'emergency', active: true, created_by: createdBy })
  if (error) throw error
}

// ── Clear all active emergencies ───────────────────────────
export async function clearEmergencies() {
  const { error } = await supabase
    .from('emergency_broadcasts')
    .update({ active: false })
    .eq('active', true)
  if (error) throw error
}

// ── Get active emergencies ─────────────────────────────────
export async function getActiveEmergencies() {
  const { data } = await supabase
    .from('emergency_broadcasts')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
  return data || []
}
