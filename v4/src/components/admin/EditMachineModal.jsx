import { useState } from 'react'
import { updateMachine } from '../../lib/adminData'
import { X } from 'lucide-react'

export default function EditMachineModal({ machine, onClose, onSaved }) {
  const [name, setName]         = useState(machine.name)
  const [location, setLocation] = useState(machine.location || '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      await updateMachine(machine.id, { name, location })
      onSaved()
    } catch (e) {
      setError(e.message || 'Failed to update')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit machine</h2>

        <div className="space-y-3 mb-4">
          <div>
            <label className="label">Machine name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} className="input" />
          </div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-300 rounded-lg px-3 py-2 mb-4">{error}</div>}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
