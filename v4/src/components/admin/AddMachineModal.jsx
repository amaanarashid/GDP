import { useState } from 'react'
import { createMachineFromPreset, createCustomMachine } from '../../lib/adminData'
import { PRESET_TYPES, presetSensorCount, PRESETS } from '../../lib/presets'
import { X, Plus, Trash2 } from 'lucide-react'

export default function AddMachineModal({ onClose, onCreated }) {
  const [mode, setMode]         = useState('preset') // 'preset' | 'custom'
  const [name, setName]         = useState('')
  const [location, setLocation] = useState('')
  const [type, setType]         = useState('conveyor_drive')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  // custom builder
  const [components, setComponents] = useState([
    { name: '', sensors: [{ name: '', unit: '', normal_min: '', normal_max: '', warning_threshold: '', critical_threshold: '', detects: '' }] },
  ])

  function addComponent() {
    setComponents([...components, { name: '', sensors: [{ name: '', unit: '', normal_min: '', normal_max: '', warning_threshold: '', critical_threshold: '', detects: '' }] }])
  }
  function removeComponent(ci) {
    setComponents(components.filter((_, i) => i !== ci))
  }
  function updateComponent(ci, val) {
    setComponents(components.map((c, i) => i === ci ? { ...c, name: val } : c))
  }
  function addSensor(ci) {
    setComponents(components.map((c, i) => i === ci
      ? { ...c, sensors: [...c.sensors, { name: '', unit: '', normal_min: '', normal_max: '', warning_threshold: '', critical_threshold: '', detects: '' }] }
      : c))
  }
  function removeSensor(ci, si) {
    setComponents(components.map((c, i) => i === ci
      ? { ...c, sensors: c.sensors.filter((_, j) => j !== si) }
      : c))
  }
  function updateSensor(ci, si, field, val) {
    setComponents(components.map((c, i) => i === ci
      ? { ...c, sensors: c.sensors.map((s, j) => j === si ? { ...s, [field]: val } : s) }
      : c))
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Machine name is required'); return }
    setSaving(true); setError('')
    try {
      if (mode === 'preset') {
        await createMachineFromPreset({ name, type, location })
      } else {
        await createCustomMachine({ name, location, components })
      }
      onCreated()
    } catch (e) {
      setError(e.message || 'Failed to create machine')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-white mb-4">Add new machine</h2>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setMode('preset')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mode === 'preset' ? 'bg-indigo-600/20 border-indigo-600 text-indigo-400' : 'border-gray-800 text-gray-400'}`}>
            From preset
          </button>
          <button onClick={() => setMode('custom')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mode === 'custom' ? 'bg-indigo-600/20 border-indigo-600 text-indigo-400' : 'border-gray-800 text-gray-400'}`}>
            Custom build
          </button>
        </div>

        {/* Shared fields */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Machine name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="e.g. Conveyor Drive #2" />
          </div>
          <div>
            <label className="label">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} className="input" placeholder="e.g. Production Floor C" />
          </div>
        </div>

        {mode === 'preset' ? (
          <div className="mb-4">
            <label className="label">Machine type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="select">
              {PRESET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Auto-creates {PRESETS[type].components.length} components and {presetSensorCount(type)} sensors.
            </p>
          </div>
        ) : (
          <div className="mb-4 space-y-3">
            <label className="label">Components &amp; sensors</label>
            {components.map((comp, ci) => (
              <div key={ci} className="border border-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input value={comp.name} onChange={e => updateComponent(ci, e.target.value)}
                    className="input flex-1" placeholder="Component name (e.g. Electric Motor)" />
                  <button onClick={() => removeComponent(ci)} className="text-gray-500 hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2 pl-3 border-l border-gray-800">
                  {comp.sensors.map((s, si) => (
                    <div key={si} className="grid grid-cols-12 gap-1.5 items-center">
                      <input value={s.name} onChange={e => updateSensor(ci, si, 'name', e.target.value)} className="input col-span-3 text-xs" placeholder="Sensor" />
                      <input value={s.unit} onChange={e => updateSensor(ci, si, 'unit', e.target.value)} className="input col-span-2 text-xs" placeholder="Unit" />
                      <input value={s.normal_min} onChange={e => updateSensor(ci, si, 'normal_min', e.target.value)} className="input col-span-2 text-xs" placeholder="Min" />
                      <input value={s.normal_max} onChange={e => updateSensor(ci, si, 'normal_max', e.target.value)} className="input col-span-2 text-xs" placeholder="Max" />
                      <input value={s.warning_threshold} onChange={e => updateSensor(ci, si, 'warning_threshold', e.target.value)} className="input col-span-1 text-xs" placeholder="Wrn" />
                      <input value={s.critical_threshold} onChange={e => updateSensor(ci, si, 'critical_threshold', e.target.value)} className="input col-span-1 text-xs" placeholder="Crit" />
                      <button onClick={() => removeSensor(ci, si)} className="col-span-1 text-gray-600 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addSensor(ci)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add sensor
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addComponent} className="btn-secondary text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add component
            </button>
          </div>
        )}

        {error && <div className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 mb-4">{error}</div>}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Creating…' : 'Create machine'}
          </button>
        </div>
      </div>
    </div>
  )
}
