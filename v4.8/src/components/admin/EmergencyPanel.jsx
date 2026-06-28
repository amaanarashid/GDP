import { useState, useEffect } from 'react'
import { broadcastEmergency, clearEmergencies, getActiveEmergencies } from '../../lib/adminData'
import { useAuth } from '../../context/AuthContext'
import { AlertTriangle, Siren } from 'lucide-react'

const PRESET_MESSAGE = 'Emergency stop — all machines. Cease operation immediately and await instructions.'

export default function EmergencyPanel() {
  const { session } = useAuth()
  const [active, setActive]   = useState([])
  const [saving, setSaving]   = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function refresh() {
    setActive(await getActiveEmergencies())
  }
  useEffect(() => { refresh() }, [])

  async function trigger() {
    setSaving(true)
    await broadcastEmergency(PRESET_MESSAGE, session?.user?.id)
    await refresh()
    setSaving(false)
    setConfirm(false)
  }

  async function clear() {
    setSaving(true)
    await clearEmergencies()
    await refresh()
    setSaving(false)
  }

  return (
    <div className="card border-red-900/50">
      <div className="flex items-center gap-2 mb-3">
        <Siren className="w-5 h-5 text-red-400" />
        <h2 className="section-title mb-0">Emergency broadcast</h2>
      </div>

      {active.length > 0 ? (
        <div>
          <div className="emergency-banner rounded-lg px-4 py-3 mb-3 text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Emergency active — broadcasting to all technicians</span>
          </div>
          <button onClick={clear} disabled={saving} className="btn-secondary w-full">
            {saving ? 'Clearing…' : 'Clear emergency'}
          </button>
        </div>
      ) : !confirm ? (
        <div>
          <p className="text-sm text-gray-400 mb-3">
            Broadcasts a flashing alert to every technician dashboard immediately.
          </p>
          <button onClick={() => setConfirm(true)} className="btn-danger w-full flex items-center justify-center gap-2">
            <Siren className="w-4 h-4" /> Trigger emergency stop
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-300 mb-1">Confirm broadcast to all machines?</p>
          <p className="text-xs text-gray-500 mb-3 italic">"{PRESET_MESSAGE}"</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirm(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={trigger} disabled={saving} className="btn-danger flex-1">
              {saving ? 'Broadcasting…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
