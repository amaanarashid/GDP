import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getMachinesWithComponents, getRecentAlerts } from '../lib/dashboardData'

export function useDashboard() {
  const [machines, setMachines] = useState([])
  const [alerts, setAlerts]     = useState([])
  const [loading, setLoading]   = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([
        getMachinesWithComponents(),
        getRecentAlerts(15),
      ])
      setMachines(m)
      setAlerts(a)
    } catch (e) {
      console.error('dashboard refresh', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    // Realtime: machines + components updates
    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'machines' },
        payload => {
          setMachines(prev => prev.map(m =>
            m.id === payload.new.id ? { ...m, ...payload.new } : m))
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'components' },
        payload => {
          setMachines(prev => prev.map(m => ({
            ...m,
            components: m.components.map(c =>
              c.id === payload.new.id ? { ...c, ...payload.new } : c),
          })))
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' },
        async () => {
          const a = await getRecentAlerts(15)
          setAlerts(a)
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'machines' },
        () => refresh())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [refresh])

  return { machines, alerts, loading, refresh }
}
