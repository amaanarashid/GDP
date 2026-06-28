import { useState, useRef, useCallback, useEffect } from 'react'
import { nextValue, healthDelta, sensorSeverityRaw } from '../lib/simEngine'
import { writeReadings, updateSensorValues, updateComponentHealth, refreshMachineHealth, createAlert, incrementRuntime } from '../lib/data'
import { colorStatus, clamp } from '../utils/helpers'

const TICK_MS = 5000        // simulation tick interval (5s — lighter on free tier)
const RAMP_PER_TICK = 0.08  // how fast fault intensity ramps to 1.0
const RUNTIME_PER_TICK = 0.1 // hours added to machine runtime each tick

export function useSimulator({ machine, components, sensors, onUpdate }) {
  const [running, setRunning]       = useState(false)
  const [activeFaults, setActive]   = useState({}) // { faultId: { fault, intensity } }
  const [tickCount, setTickCount]   = useState(0)

  // Mutable refs so the loop always sees latest without re-binding interval
  const sensorState = useRef({})   // sensorId -> current value
  const healthState = useRef({})   // componentId -> health
  const faultsRef   = useRef({})
  const intervalRef = useRef(null)
  const runtimeRef  = useRef(null)  // machine runtime hours

  // Seed local state from props
  useEffect(() => {
    if (!sensors?.length) return
    const ss = {}
    sensors.forEach(s => { ss[s.id] = parseFloat(s.current_value ?? s.normal_min) })
    sensorState.current = ss
    const hs = {}
    components.forEach(c => { hs[c.id] = parseFloat(c.health_score ?? 100) })
    healthState.current = hs
  }, [sensors, components])

  // Seed runtime from machine
  useEffect(() => {
    if (machine) runtimeRef.current = parseFloat(machine.runtime_hours ?? 0)
  }, [machine?.id])

  useEffect(() => { faultsRef.current = activeFaults }, [activeFaults])

  // ── Single tick ──────────────────────────────────────────
  const tick = useCallback(async () => {
    if (!sensors?.length) return
    const faults = faultsRef.current

    // 1. Build per-sensor active effects
    const effectsBySensor = {}
    Object.values(faults).forEach(({ fault, intensity }) => {
      fault.effects.forEach(eff => {
        // find sensor matching this effect (by name + component name)
        const comp = components.find(c => c.name === eff.component)
        if (!comp) return
        const sensor = sensors.find(s => s.component_id === comp.id && s.name === eff.sensor)
        if (!sensor) return
        if (!effectsBySensor[sensor.id]) effectsBySensor[sensor.id] = { effects: [], intensity }
        effectsBySensor[sensor.id].effects.push(eff)
        effectsBySensor[sensor.id].intensity = Math.max(effectsBySensor[sensor.id].intensity, intensity)
      })
    })

    // 2. Compute next sensor values
    const readings = []
    const sensorUpdates = []
    const updatedSensors = sensors.map(s => {
      const entry = effectsBySensor[s.id]
      const withVal = { ...s, current_value: sensorState.current[s.id] }
      const v = nextValue(withVal, entry?.effects || [], entry?.intensity || 0)
      sensorState.current[s.id] = v
      readings.push({ sensor_id: s.id, value: v })
      sensorUpdates.push({ id: s.id, current_value: v })
      return { ...s, current_value: v }
    })

    // 3. Compute health per component
    const compUpdates = []
    const updatedComponents = components.map(c => {
      const compSensors = updatedSensors.filter(s => s.component_id === c.id)
      const hasFault = Object.values(faults).some(f => f.fault.effects.some(e => e.component === c.name))
      const delta = healthDelta(compSensors, hasFault)
      const newHealth = clamp((healthState.current[c.id] ?? 100) + delta, 0, 100)
      healthState.current[c.id] = newHealth
      compUpdates.push({ id: c.id, health_score: parseFloat(newHealth.toFixed(2)), color_status: colorStatus(newHealth) })
      return { ...c, health_score: newHealth, color_status: colorStatus(newHealth), sensors: compSensors }
    })

    // 4. Ramp fault intensities
    setActive(prev => {
      const next = {}
      let changed = false
      for (const [id, val] of Object.entries(prev)) {
        const ni = Math.min(1, val.intensity + RAMP_PER_TICK)
        if (ni !== val.intensity) changed = true
        next[id] = { ...val, intensity: ni }
      }
      return changed ? next : prev
    })

    // 5. Push to UI (with incremented runtime)
    const newRuntime = (runtimeRef.current ?? parseFloat(machine.runtime_hours ?? 0)) + RUNTIME_PER_TICK
    runtimeRef.current = newRuntime
    onUpdate?.({ sensors: updatedSensors, components: updatedComponents, runtimeHours: newRuntime })
    setTickCount(t => t + 1)

    // 6. Persist to Supabase (fire and forget)
    writeReadings(readings)
    updateSensorValues(sensorUpdates)
    updateComponentHealth(compUpdates)
    refreshMachineHealth(machine.id)
    incrementRuntime(machine.id, RUNTIME_PER_TICK)

    // 7. Raise alerts on newly-critical sensors
    updatedSensors.forEach(s => {
      if (sensorSeverityRaw(s) === 'critical') {
        const comp = components.find(c => c.id === s.component_id)
        createAlert({
          machine_id: machine.id,
          component_id: s.component_id,
          sensor_id: s.id,
          severity: 'critical',
          type: 'sensor',
          message: `${comp?.name || 'Component'} — ${s.name} critical (${parseFloat(s.current_value).toFixed(1)} ${s.unit})`,
        })
      }
    })
  }, [sensors, components, machine, onUpdate])

  // ── Play / pause ─────────────────────────────────────────
  const start = useCallback(() => {
    if (intervalRef.current) return
    setRunning(true)
    tick() // immediate first tick
    intervalRef.current = setInterval(tick, TICK_MS)
  }, [tick])

  const stop = useCallback(() => {
    setRunning(false)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  const toggle = useCallback(() => { running ? stop() : start() }, [running, start, stop])

  // Restart interval when tick fn changes (machine switch) while running
  useEffect(() => {
    if (running && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = setInterval(tick, TICK_MS)
    }
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null } }
  }, [tick]) // eslint-disable-line

  // Stop when machine changes
  useEffect(() => { stop() }, [machine?.id]) // eslint-disable-line

  // ── Fault injection ──────────────────────────────────────
  const injectFault = useCallback((fault) => {
    setActive(prev => ({ ...prev, [fault.id]: { fault, intensity: 0.15 } }))
  }, [])

  const clearFault = useCallback((faultId) => {
    setActive(prev => {
      const next = { ...prev }
      delete next[faultId]
      return next
    })
  }, [])

  const clearAllFaults = useCallback(() => setActive({}), [])

  // Manual single-sensor override (from sensor control sliders)
  const setSensorValue = useCallback((sensorId, value) => {
    sensorState.current[sensorId] = value
    updateSensorValues([{ id: sensorId, current_value: value }])
    writeReadings([{ sensor_id: sensorId, value }])
  }, [])

  // ── Reset simulator state (after DB reset) ───────────────
  const resetState = useCallback(() => {
    stop()
    setActive({})
    setTickCount(0)
    // re-seed local sensor + health state to baselines
    if (sensors?.length) {
      const ss = {}
      sensors.forEach(s => {
        const base = parseFloat(s.normal_min) + (parseFloat(s.normal_max) - parseFloat(s.normal_min)) * 0.45
        ss[s.id] = base
      })
      sensorState.current = ss
    }
    components.forEach(c => { healthState.current[c.id] = 100 })
    runtimeRef.current = null  // re-seed from reloaded machine
  }, [sensors, components, stop])

  return {
    running, toggle, start, stop,
    activeFaults, injectFault, clearFault, clearAllFaults,
    setSensorValue, tickCount, resetState,
  }
}
