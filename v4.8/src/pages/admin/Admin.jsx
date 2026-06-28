import { useState, useEffect, useCallback } from 'react'
import { getMachinesWithComponents } from '../../lib/dashboardData'
import { softDeleteMachine, restoreMachine } from '../../lib/adminData'
import { machineTypeLabel, statusBadge, fmtHours } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'
import AddMachineModal from '../../components/admin/AddMachineModal'
import EditMachineModal from '../../components/admin/EditMachineModal'
import QRCodeModal from '../../components/admin/QRCodeModal'
import EmergencyPanel from '../../components/admin/EmergencyPanel'
import Spinner from '../../components/ui/Spinner'
import { Plus, Pencil, QrCode, Archive, RotateCcw } from 'lucide-react'

export default function Admin() {
  const { session } = useAuth()
  const [machines, setMachines] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editMachine, setEdit]  = useState(null)
  const [qrMachine, setQr]      = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const m = await getMachinesWithComponents()
    setMachines(m)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(machine) {
    if (machine.status === 'offline') {
      await restoreMachine(machine.id)
    } else {
      await softDeleteMachine(machine.id)
    }
    load()
  }

  if (loading) return <Spinner full label="Loading admin…" />

  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Admin</h1>
          <p className="text-gray-500">Manage machines, sensors, QR codes, and emergencies.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add machine
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Machines table */}
        <div className="lg:col-span-2">
          <div className="card p-0 overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Type</th>
                  <th>Components</th>
                  <th>Runtime</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {machines.map(m => (
                  <tr key={m.id} className={m.status === 'offline' ? 'opacity-50' : ''}>
                    <td>
                      <p className="font-medium text-white">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.location}</p>
                    </td>
                    <td className="text-gray-400">{machineTypeLabel(m.type)}</td>
                    <td className="text-gray-400">{m.components?.length || 0}</td>
                    <td className="text-gray-400">{fmtHours(m.runtime_hours)}</td>
                    <td><span className={statusBadge(m.status)}>{m.status}</span></td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setQr(m)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded" title="QR code">
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEdit(m)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(m)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
                          title={m.status === 'offline' ? 'Restore' : 'Archive'}>
                          {m.status === 'offline' ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Emergency panel */}
        <div className="lg:col-span-1">
          <EmergencyPanel />
        </div>
      </div>

      {showAdd && <AddMachineModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />}
      {editMachine && <EditMachineModal machine={editMachine} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
      {qrMachine && <QRCodeModal machine={qrMachine} onClose={() => setQr(null)} />}
    </div>
  )
}
