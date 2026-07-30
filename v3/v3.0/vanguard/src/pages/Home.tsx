import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Machine, MachineHealthSummary } from '../types/index'
import MachineCard from '../components/machines/MachineCard'
import MachineListHeader from '../components/machines/MachineListHeader'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { AlertTriangle } from 'lucide-react'
export default function Home() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [summaries, setSummaries] = useState<Record<string, MachineHealthSummary>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)

      const [{ data: machinesData, error: mErr }, { data: summaryData, error: sErr }] =
        await Promise.all([
          supabase.from('machines').select('*').order('created_at', { ascending: true }),
          supabase.from('machine_health_summary').select('*').order('calculated_at', { ascending: false }),
        ])

      if (mErr) throw mErr
      if (sErr) throw sErr

      setMachines(machinesData || [])

      const summaryMap: Record<string, MachineHealthSummary> = {}
      summaryData?.forEach((s) => {
        if (!summaryMap[s.machine_id]) summaryMap[s.machine_id] = s
      })
      setSummaries(summaryMap)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner label="Loading machines..." />

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <AlertTriangle className="text-red-400" size={36} />
      <p className="text-red-400">{error}</p>
    </div>
  )

  const totalMachines = machines.length
  const running = machines.filter(m => m.status === 'running').length
  const warning = machines.filter(m => m.status === 'warning').length
  const critical = machines.filter(m => m.status === 'critical').length

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <MachineListHeader
        total={totalMachines}
        running={running}
        warning={warning}
        critical={critical}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {machines.map((machine) => (
          <MachineCard
            key={machine.id}
            machine={machine}
            summary={summaries[machine.id]}
          />
        ))}
      </div>
    </div>
  )
}