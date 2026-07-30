// ============================================================
// DATASET EXPORT — turn a machine's operational history into a
// labelled, AI4I-shaped CSV that /analyze and /train accept.
//
// Labels are derived the way a real plant would derive them:
//   failure = 1 if a CRITICAL alert fired within the next
//   `horizonMin` minutes (the actionable warning time a
//   maintenance planner needs), else 0.
// No simulator ground truth is used — only the event log, which
// is exactly what a real customer site has.
// ============================================================
import { supabase } from './supabase'

// PostgREST caps selects at 1000 rows — paginate past it.
async function fetchAllReadings(sensorIds, maxRows = 60000) {
  const out = []
  for (let from = 0; from < maxRows; from += 1000) {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('sensor_id, value, timestamp')
      .in('sensor_id', sensorIds)
      .order('timestamp', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function exportMachineDataset(machine, horizonMin = 10) {
  const { data: sensors, error: sErr } = await supabase
    .from('sensors').select('id, name').eq('machine_id', machine.id)
  if (sErr) throw sErr
  if (!sensors?.length) throw new Error('No sensors for this machine.')

  const readings = await fetchAllReadings(sensors.map(s => s.id))
  if (!readings.length) throw new Error('No readings yet — run the simulator first.')

  const { data: alerts, error: aErr } = await supabase
    .from('alerts').select('created_at')
    .eq('machine_id', machine.id).eq('severity', 'critical')
  if (aErr) throw aErr
  const alertTimes = (alerts || [])
    .map(a => new Date(a.created_at).getTime())
    .sort((a, b) => a - b)

  // Pivot: one row per tick (a tick's readings share an insert timestamp)
  const nameById = Object.fromEntries(sensors.map(s => [s.id, s.name]))
  const byTs = new Map()
  for (const r of readings) {
    if (!byTs.has(r.timestamp)) byTs.set(r.timestamp, {})
    byTs.get(r.timestamp)[nameById[r.sensor_id]] = r.value
  }

  const names = sensors.map(s => s.name)
  const horizonMs = horizonMin * 60 * 1000
  const lines = ['timestamp,' + names.map(n => `"${n}"`).join(',') + ',failure']
  let failures = 0
  const last = {}   // forward-fill sensors missing from a batch
  const sorted = [...byTs.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]))

  for (const [ts, vals] of sorted) {
    const t = new Date(ts).getTime()
    const rowVals = names.map(n => {
      if (vals[n] != null) last[n] = vals[n]
      return last[n]
    })
    if (rowVals.some(v => v == null)) continue   // wait until every sensor seen once
    const failure = alertTimes.some(a => a > t && a <= t + horizonMs) ? 1 : 0
    failures += failure
    lines.push(`${ts},${rowVals.join(',')},${failure}`)
  }

  const nRows = lines.length - 1
  if (nRows < 50) throw new Error(`Only ${nRows} usable rows — stream longer before exporting.`)

  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(machine.name || 'machine').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-dataset.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  return { rows: nRows, failures, failureRate: failures / nRows, horizonMin }
}
