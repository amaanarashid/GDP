import { supabase } from './supabase'

// ── Dashboard: all machines + their components ─────────────
export async function getMachinesWithComponents() {
  const { data: machines, error } = await supabase
    .from('machines')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error

  const { data: components } = await supabase
    .from('components')
    .select('*')
    .order('created_at', { ascending: true })

  const byMachine = {}
  ;(components || []).forEach(c => {
    if (!byMachine[c.machine_id]) byMachine[c.machine_id] = []
    byMachine[c.machine_id].push(c)
  })

  return machines.map(m => ({ ...m, components: byMachine[m.id] || [] }))
}

// ── Recent alerts across all machines ──────────────────────
export async function getRecentAlerts(limit = 20) {
  const { data, error } = await supabase
    .from('alerts')
    .select('*, machines(name), components(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// ── Unresolved alert count ─────────────────────────────────
export async function getActiveAlertCount() {
  const { count } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('resolved', false)
  return count || 0
}

// ── Maintenance logs for a machine ─────────────────────────
export async function getMaintenanceLogs(machineId, limit = 20) {
  const { data, error } = await supabase
    .from('maintenance_logs')
    .select('*, profiles(full_name, email)')
    .eq('machine_id', machineId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// ── Latest RUL predictions for a machine ───────────────────
export async function getLatestRUL(machineId) {
  const { data, error } = await supabase
    .from('rul_predictions')
    .select('*')
    .eq('machine_id', machineId)
    .order('timestamp', { ascending: false })
    .limit(50)
  if (error) throw error
  // dedupe to latest per component
  const latest = {}
  ;(data || []).forEach(r => {
    if (!latest[r.component_id]) latest[r.component_id] = r
  })
  return Object.values(latest)
}
