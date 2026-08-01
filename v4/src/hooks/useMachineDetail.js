import { useState, useEffect, useCallback, useRef } from 'react'
import { getMachineBundle } from '../lib/data'
import { getMachineReadingsHistory, writeRULPredictions, pruneOldReadings } from '../lib/maintenanceData'
import { getMaintenanceLogs } from '../lib/dashboardData'
import { trendRulComponents } from '../lib/trendRul'
import { isRealModelMachine, predictRealRUL, buildRulWindows } from '../lib/realRulModel'
import { predictRulRange } from '../lib/mlServer'
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

      // ── Run RUL estimation ─────────────────────────────────
      // MetroPT (real-data) machines use the Python-trained model;
      // simulated machines use degradation-trend extrapolation
      // (no training step needed).
      if (!mounted.current) return
      setModelReady(true)
      await runPredictions(b, hist.readings)
    } catch (e) {
      console.error(e)
      if (mounted.current) { setError(e); setLoading(false) }
    }
    // runPredictions is stable (useCallback with []); declared below, so it
    // can't appear in this deps array without a TDZ error.
  }, [machineId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Compute features → predict → rank → persist ──────────
  const runPredictions = useCallback(async (b, readingsBySensor) => {
    if (!b) return

    let rulByComponent = {}

    if (isRealModelMachine(b.sensors)) {
      // ── Real MetroPT-3 machine: server first, JS fallback ──
      // 1. FastAPI /predict-rul → quantile models + conformal range
      //    ("8–15 days" instead of a false-precision point).
      // 2. If the server is down → in-browser Python-trained net
      //    (point estimate only). Ranking still driven by
      //    per-component health and sensor severity.
      try {
        let applied = false
        try {
          const w = buildRulWindows({ sensors: b.sensors, readingsBySensor })
          const r = await predictRulRange(w)
          b.components.forEach(c => {
            rulByComponent[c.id] = {
              days: r.rul_days,
              low: r.low_days,
              high: r.high_days,
              confidence: Math.round((r.coverage_target ?? 0.8) * 100),
              source: 'ml-server',
            }
          })
          applied = true
        } catch {
          // ML server offline — fall through to the in-browser model
        }
        if (!applied) {
          const p = await predictRealRUL({ sensors: b.sensors, readingsBySensor })
          b.components.forEach(c => {
            rulByComponent[c.id] = { days: p.days, confidence: p.confidence, source: 'browser' }
          })
        }
      } catch (e) {
        console.error('real model failed, falling back to trend extrapolation', e)
        rulByComponent = trendRulComponents({
          components: b.components,
          sensors: b.sensors,
          runtimeHours: parseFloat(b.machine.runtime_hours ?? 0),
        })
      }
    } else {
      // ── Simulated machines: degradation-trend extrapolation ──
      // (health margin ÷ measured decline rate — see lib/trendRul.js)
      rulByComponent = trendRulComponents({
        components: b.components,
        sensors: b.sensors,
        runtimeHours: parseFloat(b.machine.runtime_hours ?? 0),
      })
    }

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
      rul_low: rulByComponent[c.id]?.low ?? null,
      rul_high: rulByComponent[c.id]?.high ?? null,
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
      // Live sensor values — needs data/migration_realtime_sensors.sql,
      // which adds `sensors` to the realtime publication.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sensors', filter: `machine_id=eq.${machineId}` },
        payload => {
          setBundle(prev => prev ? {
            ...prev,
            sensors: prev.sensors.map(s =>
              s.id === payload.new.id ? { ...s, ...payload.new } : s),
          } : prev)

          // Append to the 24h chart series so the graphs draw live as the
          // simulator streams, instead of only refreshing on page load.
          const v = parseFloat(payload.new.current_value)
          if (!isNaN(v)) {
            setHistory(prev => {
              const list = prev[payload.new.id] || []
              const cutoff = Date.now() - 24 * 3600 * 1000
              const next = [...list, { value: v, timestamp: new Date().toISOString() }]
                .filter(r => new Date(r.timestamp).getTime() >= cutoff)
              return { ...prev, [payload.new.id]: next }
            })
          }
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [machineId])

  return { bundle, history, ranked, logs, loading, modelReady, error, reload: load }
}
