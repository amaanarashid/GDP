import { useState } from 'react'
import { completeMaintenance } from '../../lib/maintenanceData'
import { useAuth } from '../../context/AuthContext'
import { healthColor } from '../../utils/helpers'
import { X, Wrench, CheckCircle2 } from 'lucide-react'

export default function MaintenanceModal({ machine, components, onClose, onComplete }) {
  const { profile } = useAuth()
  const [mode, setMode]         = useState('pick') // 'pick' | 'all'
  const [selected, setSelected] = useState([])
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function submit() {
    setError('')
    if (mode === 'pick' && selected.length === 0) {
      setError('Select at least one component, or choose Restore all.')
      return
    }
    setSaving(true)
    try {
      const healthBefore = parseFloat(machine.overall_health ?? 100)
      await completeMaintenance({
        machineId: machine.id,
        technicianId: profile.id,
        componentIds: selected,
        restoreAll: mode === 'all',
        notes,
        healthBefore,
      })
      onComplete?.()
    } catch (e) {
      setError(e.message || 'Failed to save maintenance')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Complete maintenance</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">{machine.name}</p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setMode('pick')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'pick' ? 'bg-indigo-600 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
            Pick components
          </button>
          <button onClick={() => setMode('all')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'all' ? 'bg-indigo-600 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
            Restore all
          </button>
        </div>

        {mode === 'pick' ? (
          <div className="space-y-2 mb-4">
            {components.map(c => {
              const health = parseFloat(c.health_score ?? 100)
              const checked = selected.includes(c.id)
              return (
                <button key={c.id} onClick={() => toggle(c.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    checked ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600'}`}>
                    {checked && <CheckCircle2 className="w-4 h-4 text-gray-900" />}
                  </div>
                  <span className="flex-1 text-sm text-gray-900">{c.name}</span>
                  <span className={`text-sm font-medium ${healthColor(health)}`}>{Math.round(health)}%</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-700">All {components.length} components will be restored to 100% health.</p>
          </div>
        )}

        <div className="mb-4">
          <label className="label">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            className="input min-h-[70px] resize-none" placeholder="What was done…" />
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Complete maintenance'}
          </button>
        </div>
      </div>
    </div>
  )
}
