import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../hooks/useDashboard'
import MachineCard from '../../components/dashboard/MachineCard'
import { StatCard, AlertsFeed } from '../../components/dashboard/DashboardWidgets'
import QRScanner from '../../components/machine/QRScanner'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../context/AuthContext'
import { RefreshCw, QrCode } from 'lucide-react'

export default function Dashboard() {
  const { machines, alerts, loading, refresh } = useDashboard()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [showScanner, setShowScanner] = useState(false)

  function handleScan(machineId) {
    setShowScanner(false)
    navigate(`/machine/${machineId}`)
  }

  const stats = useMemo(() => {
    const total = machines.length
    const healthy  = machines.filter(m => m.status === 'healthy').length
    const warning  = machines.filter(m => m.status === 'warning').length
    const critical = machines.filter(m => m.status === 'critical').length
    const avgHealth = total
      ? Math.round(machines.reduce((a, m) => a + parseFloat(m.overall_health ?? 100), 0) / total)
      : 100
    const activeAlerts = alerts.filter(a => !a.resolved).length
    return { total, healthy, warning, critical, avgHealth, activeAlerts }
  }, [machines, alerts])

  if (loading) return <Spinner full label="Loading dashboard…" />

  const firstName = (profile?.full_name || profile?.email || '').split(' ')[0] || profile?.email

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-gray-500">Live overview of all machines and their health.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowScanner(true)} className="btn-primary flex items-center gap-2 text-sm">
            <QrCode className="w-4 h-4" /> Scan QR
          </button>
          <button onClick={refresh} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total machines" value={stats.total} />
        <StatCard label="Avg health" value={`${stats.avgHealth}%`}
          accent={stats.avgHealth >= 75 ? 'green' : stats.avgHealth >= 50 ? 'yellow' : 'red'} />
        <StatCard label="Healthy" value={stats.healthy} accent="green" />
        <StatCard label="Warning" value={stats.warning} accent="yellow" />
        <StatCard label="Critical" value={stats.critical} accent="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Machines grid */}
        <div className="lg:col-span-2">
          <h2 className="section-title">Machines</h2>
          {machines.length === 0 ? (
            <div className="card text-gray-500 text-center py-12">
              No machines yet. Add machines from the Admin page.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {machines.map(m => <MachineCard key={m.id} machine={m} />)}
            </div>
          )}
        </div>

        {/* Alerts sidebar */}
        <div className="lg:col-span-1">
          <AlertsFeed alerts={alerts} />
        </div>
      </div>
    </div>
  )
}
