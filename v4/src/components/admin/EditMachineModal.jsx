import { useState } from 'react'
import { updateMachine, uploadMachineManual, removeMachineManual } from '../../lib/adminData'
import { X, FileText, Upload, Trash2, ExternalLink } from 'lucide-react'

export default function EditMachineModal({ machine, onClose, onSaved }) {
  const [name, setName]         = useState(machine.name)
  const [location, setLocation] = useState(machine.location || '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  // Manual state: existing on the machine, plus any newly picked file
  const [manualFile, setManualFile] = useState(null)
  const [manualName, setManualName] = useState(machine.manual_name || '')
  const [manualUrl, setManualUrl]   = useState(machine.manual_url || '')
  const [removing, setRemoving]     = useState(false)

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      await updateMachine(machine.id, { name, location })
      if (manualFile) await uploadMachineManual(machine.id, manualFile)
      onSaved()
    } catch (e) {
      setError(e.message || 'Failed to update')
      setSaving(false)
    }
  }

  async function handleRemoveManual() {
    if (!window.confirm('Remove the manual for this machine?')) return
    setRemoving(true); setError('')
    try {
      await removeMachineManual(machine.id)
      setManualUrl(''); setManualName(''); setManualFile(null)
    } catch (e) {
      setError(e.message || 'Failed to remove manual')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md relative max-h-[90vh] overflow-y-auto">
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

        {/* Manual (PDF) */}
        <div className="mb-4">
          <label className="label flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Machine manual (PDF)
          </label>

          {manualUrl && !manualFile && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 mb-2">
              <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-sm text-gray-700 truncate flex-1">{manualName || 'manual.pdf'}</span>
              <a href={manualUrl} target="_blank" rel="noreferrer" className="icon-btn" title="Open">
                <ExternalLink className="w-4 h-4" />
              </a>
              <button onClick={handleRemoveManual} disabled={removing}
                className="icon-btn hover:text-red-600 hover:bg-red-50" title="Remove manual">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg p-3 hover:border-gray-400">
            <Upload className="w-4 h-4 text-gray-600 shrink-0" />
            <span className="text-sm text-gray-600 truncate">
              {manualFile ? manualFile.name : manualUrl ? 'Replace with another PDF…' : 'Upload a PDF…'}
            </span>
            <input type="file" accept="application/pdf,.pdf" className="hidden"
              onChange={e => setManualFile(e.target.files?.[0] || null)} />
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Technicians can open and search this from the machine page. Max 25 MB.
          </p>
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
