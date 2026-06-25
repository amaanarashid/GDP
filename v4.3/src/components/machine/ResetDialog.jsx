import { useState } from 'react'
import { X, RotateCcw } from 'lucide-react'

export default function ResetDialog({ machine, onConfirm, onClose }) {
  const [wipeHistory, setWipeHistory] = useState(false)
  const [saving, setSaving] = useState(false)

  async function confirm() {
    setSaving(true)
    await onConfirm(wipeHistory)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <RotateCcw className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Reset {machine?.name}?</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">This will reset only this machine.</p>

        <ul className="text-sm text-gray-300 space-y-1.5 mb-4">
          <li className="flex items-center gap-2"><span className="text-green-400">•</span> Restore all components to 100%</li>
          <li className="flex items-center gap-2"><span className="text-green-400">•</span> Clear all active faults</li>
          <li className="flex items-center gap-2"><span className="text-green-400">•</span> Reset sensors to normal values</li>
          <li className="flex items-center gap-2"><span className="text-green-400">•</span> Reset tick counter to 0</li>
        </ul>

        <label className="flex items-center gap-2 mb-5 cursor-pointer p-3 rounded-lg bg-gray-900/40 border border-gray-800">
          <input type="checkbox" checked={wipeHistory} onChange={e => setWipeHistory(e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-600" />
          <span className="text-sm text-gray-300">Also wipe sensor history (clears charts)</span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={confirm} disabled={saving} className="btn-danger flex-1">
            {saving ? 'Resetting…' : 'Reset machine'}
          </button>
        </div>
      </div>
    </div>
  )
}
