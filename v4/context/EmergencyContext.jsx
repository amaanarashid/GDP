import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const EmergencyContext = createContext(null)

export function EmergencyProvider({ children }) {
  const { session } = useAuth()
  const [emergencies, setEmergencies] = useState([])

  useEffect(() => {
    if (!session) return

    // Load active emergencies on mount
    supabase
      .from('emergency_broadcasts')
      .select('*, machines(name)')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEmergencies(data || []))

    // Subscribe to new ones
    const channel = supabase
      .channel('emergency-broadcasts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'emergency_broadcasts',
      }, payload => {
        setEmergencies(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'emergency_broadcasts',
      }, payload => {
        if (!payload.new.active) {
          setEmergencies(prev => prev.filter(e => e.id !== payload.new.id))
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session])

  function dismiss(id) {
    setEmergencies(prev => prev.filter(e => e.id !== id))
  }

  return (
    <EmergencyContext.Provider value={{ emergencies, dismiss }}>
      {children}
    </EmergencyContext.Provider>
  )
}

export const useEmergency = () => useContext(EmergencyContext)
