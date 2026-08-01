// ============================================================
// DEMO PANEL — guided, in-order buttons for presenting the
// simulated-machine ML story. Exists to remove the two ways a
// live demo goes wrong:
//   1. clicking "Generate 24h" AFTER faults (it wipes readings)
//   2. training the detector AFTER a fault (it learns the fault
//      as "normal")
// Each step unlocks the next, so the order can't be broken.
// ============================================================
import { useState } from 'react'
import {
  Presentation, Check, Loader2, Wand2, Play, Zap, Wrench, RotateCcw,
} from 'lucide-react'

const STEPS = [
  {
    id: 'prepare',
    icon: Wand2,
    label: 'Prepare machine',
    hint: 'Resets the machine and creates 24h of HEALTHY history — the data the detector learns "normal" from.',
    say: '"This machine now has 24 hours of healthy operating history."',
  },
  {
    id: 'train',
    icon: Presentation,
    label: 'Open machine page → Train',
    hint: 'On the machine page click "Train on history", then check the score reads ~0 / NORMAL.',
    say: '"The model learns normal from this machine\'s own healthy data — no failure examples needed."',
    manual: true,
  },
  {
    id: 'stream',
    icon: Play,
    label: 'Start streaming',
    hint: 'Begins live sensor data at one reading every 2 seconds.',
    say: '"Sensors are now streaming live into the database."',
  },
  {
    id: 'fault',
    icon: Zap,
    label: 'Inject fault',
    hint: 'Injects a real fault. Give it ~30s, then re-check the ML panel on the machine page.',
    say: '"Now watch the anomaly score climb — it flags this without ever being told what a failure looks like."',
  },
  {
    id: 'fix',
    icon: Wrench,
    label: 'Clear fault',
    hint: 'Clears the fault. Restore health with "Complete maintenance" on the machine page.',
    say: '"Health only recovers through maintenance — never on its own."',
  },
]

export default function DemoPanel({ faults, onPrepare, onStream, onInjectFault, onClearFaults, running }) {
  const [done, setDone]       = useState({})
  const [busy, setBusy]       = useState(null)
  const [msg, setMsg]         = useState('')
  const [faultId, setFaultId] = useState('')

  const chosenFault = faults.find(f => f.id === faultId) || faults[0]

  async function run(step) {
    setBusy(step.id); setMsg('')
    try {
      if (step.id === 'prepare') {
        const n = await onPrepare()
        setMsg(`Ready — ${n ? n.toLocaleString() + ' healthy readings created' : 'machine reset'}. Now do step 2.`)
      }
      if (step.id === 'stream')  { onStream() }
      if (step.id === 'fault')   {
        if (!chosenFault) throw new Error('No faults defined for this machine type')
        onInjectFault(chosenFault)
        setMsg(`Injected "${chosenFault.label}" — wait ~30s, then check the ML panel.`)
      }
      if (step.id === 'fix')     { onClearFaults() }
      setDone(d => ({ ...d, [step.id]: true }))
    } catch (e) {
      setMsg(`Failed — ${e.message}`)
    } finally {
      setBusy(null)
    }
  }

  function reset() {
    setDone({}); setMsg('')
  }

  // A step is available once the previous one is done (step 1 always is)
  const isUnlocked = i => i === 0 || done[STEPS[i - 1].id]

  return (
    <div className="card mb-6 border-indigo-200">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <Presentation className="w-4 h-4 text-indigo-600" /> Demo mode
        </h2>
        <button onClick={reset} className="btn-secondary flex items-center gap-2 text-xs">
          <RotateCcw className="w-3.5 h-3.5" /> Restart walkthrough
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Guided steps in the correct order. Each unlocks the next, so nothing gets
        clicked out of sequence during a presentation.
      </p>

      {/* Fault chooser */}
      {faults.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-500">Fault to inject:</span>
          <select value={faultId} onChange={e => setFaultId(e.target.value)} className="select w-56">
            {faults.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-2">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          const isDone = done[step.id]
          const unlocked = isUnlocked(i)
          const isBusy = busy === step.id
          return (
            <div key={step.id}
              className={`rounded-lg border p-3 transition-colors ${
                isDone ? 'border-green-300 bg-green-50'
                : unlocked ? 'border-indigo-200 bg-white'
                : 'border-gray-200 bg-gray-50 opacity-60'}`}>
              <div className="flex items-start gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  isDone ? 'bg-green-500 text-white'
                  : unlocked ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                  {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{step.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.hint}</p>
                  <p className="text-xs text-indigo-700 mt-1 italic">{step.say}</p>
                </div>
                {step.manual ? (
                  <button onClick={() => setDone(d => ({ ...d, [step.id]: true }))}
                    disabled={!unlocked}
                    className="btn-secondary text-xs shrink-0">
                    Mark done
                  </button>
                ) : (
                  <button onClick={() => run(step)}
                    disabled={!unlocked || isBusy || (step.id === 'stream' && running)}
                    className="btn-primary flex items-center gap-1.5 text-xs shrink-0">
                    {isBusy
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Icon className="w-3.5 h-3.5" />}
                    {step.id === 'stream' && running ? 'Streaming' : 'Run'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {msg && (
        <div className={`mt-3 text-xs rounded-lg px-3 py-2 border ${
          msg.startsWith('Failed')
            ? 'text-red-600 bg-red-50 border-red-300'
            : 'text-green-600 bg-green-50 border-green-200'}`}>
          {msg}
        </div>
      )}
    </div>
  )
}
