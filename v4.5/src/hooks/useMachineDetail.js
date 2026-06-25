import { useState, useEffect, useCallback, useRef } from 'react'
import { getMachineBundle } from '../lib/data'
import { getMachineReadingsHistory, writeRULPredictions, pruneOldReadings } from '../lib/maintenanceData'
import { getMaintenanceLogs } from '../lib/dashboardData'
import { componentFeatures } from '../lib/features'
import { ensureModel, predictComponents } from '../lib/rulModel'
import { rankComponents } from '../lib/priorityEngine'
import { supabase } from '../lib/supabase'

export function useMachineDetail(machineId) {
  const [bundle, setBundle]       = useState(null)
  const [history, setHistory]     = useState({})       // sensorId -> readings[]
  const [ranked, setRanked]       = useState([])
  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [modelReady, setModelReady] = useState(false)
  const [error, setError]         = useState(null)
  const mounted = useRef(true)

  // ── Load everything ──────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const b = await getMachineBundle(machineId)
      if (!mounted.current) return
      setBundle(b)

      // history (24h) + maintenance logs in parallel
      const [hist, mlogs] = await Promise.all([
        getMachineReadingsHistory(machineId, 24),
        getMaintenanceLogs(machineId, 10),
      ])
      if (!mounted.current) return
      setHistory(hist.readings)
      setLogs(mlogs)
      setLoading(false)

      // Best-effort prune in the background
      pruneOldReadings().catch(() => {})

      // ── Run RUL model ──────────────────────────────────────
      await ensureModel()
      if (!mounted.current) return
      setModelReady(true)
      await runPredictions(b, hist.readings)
    } catch (e) {
      console.error(e)
      if (mounted.current) { setError(e); setLoading(false) }
    }
  }, [machineId])

  // ── Compute features → predict → rank → persist ──────────
  const runPredictions = useCallback(async (b, readingsBySensor) => {
    if (!b) return
    const featureMap = {}
    b.components.forEach(c => {
      const compSensors = b.sensors.filter(s => s.component_id === c.id)
      featureMap[c.id] = componentFeatures(compSensors, readingsBySensor)
    })

    const rulByComponent = await predictComponents(featureMap)
    if (!mounted.current) return

    const rankedComps = rankComponents({
      components: b.components,
      sensors: b.sensors,
      readingsBySensor,
      rulByComponent,
    })
    setRanked(rankedComps)

    // persist predictions
    const rows = b.components.map(c => ({
      machine_id: b.machine.id,
      component_id: c.id,
      days_remaining: rulByComponent[c.id]?.days ?? null,
      confidence: rulByComponent[c.id]?.confidence ?? null,
    }))
    writeRULPredictions(rows)
  }, [])

  useEffect(() => {
    mounted.current = true
    setLoading(true)
    load()
    return () => { mounted.current = false }
  }, [load])

  // ── Realtime: live component/sensor updates while viewing ─
  useEffect(() => {
    if (!machineId) return
    const channel = supabase
      .channel(`machine-${machineId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'components', filter: `machine_id=eq.${machineId}` },
        payload => {
          setBundle(prev => prev ? {
            ...prev,
            components: prev.components.map(c =>
              c.id === payload.new.id ? { ...c, ...payload.new } : c),
          } : prev)
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'machines', filter: `id=eq.${machineId}` },
        payload => {
          setBundle(prev => prev ? { ...prev, machine: { ...prev.machine, ...payload.new } } : prev)
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [machineId])

  return { bundle, history, ranked, logs, loading, modelReady, error, reload: load }
}
