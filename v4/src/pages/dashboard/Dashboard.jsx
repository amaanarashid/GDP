import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../hooks/useDashboard'
import MachineCard from '../../components/dashboard/MachineCard'
import { StatCard, AlertsFeed } from '../../components/dashboard/DashboardWidgets'
import QRScanner from '../../components/machine/QRScanner'
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

  // Skeleton rather than a blank spinner — the page keeps its shape while
  // data arrives, which reads as much faster even at the same speed.
  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="skeleton h-7 w-64 mb-2" />
          <div className="skeleton h-4 w-80" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton h-3 w-20 mb-3" />
              <div className="skeleton h-7 w-14" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="skeleton h-5 w-28 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card">
                  <div className="skeleton h-4 w-32 mb-2" />
                  <div className="skeleton h-3 w-20 mb-3" />
                  <div className="skeleton h-32 w-full mb-3" />
                  <div className="skeleton h-2 w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="card">
              <div className="skeleton h-5 w-32 mb-4" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 mb-3">
                  <div className="skeleton h-6 w-6 rounded-md shrink-0" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-full mb-1.5" />
                    <div className="skeleton h-2.5 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const firstName = (profile?.full_name || profile?.email || '').split(' ')[0] || profile?.email

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="page-title">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="page-sub">Live overview of all machines and their health.</p>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 stagger">
        <StatCard label="Total machines" value={stats.total} />
        <StatCard label="Avg health" value={`${stats.avgHealth}%`}
          accent={stats.avgHealth >= 75 ? 'green' : stats.avgHealth >= 50 ? 'yellow' : 'red'} />
        <StatCard label="Healthy" value={stats.healthy} accent={stats.healthy > 0 ? 'green' : 'white'} />
        <StatCard label="Warning" value={stats.warning} accent={stats.warning > 0 ? 'yellow' : 'white'} />
        <StatCard label="Critical" value={stats.critical} accent={stats.critical > 0 ? 'red' : 'white'} />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
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
