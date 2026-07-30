import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera, Keyboard } from 'lucide-react'

// Accepts a raw machine ID, a "QR-" prefixed ID, or a full URL like
// https://app.example.com/machine/<id>
function extractMachineId(decoded) {
  let id = decoded.trim()
  const urlMatch = id.match(/\/machine\/([^/?#]+)/)
  if (urlMatch) id = urlMatch[1]
  if (id.startsWith('QR-')) id = id.slice(3)
  return id
}

export default function QRScanner({ onScan, onClose }) {
  const [mode, setMode]       = useState('camera') // 'camera' | 'manual'
  const [manualId, setManual] = useState('')
  const [error, setError]     = useState('')
  const handledRef = useRef(false)
  const divId = 'qr-reader'

  useEffect(() => {
    if (mode !== 'camera') return

    const scanner = new Html5Qrcode(divId)
    let cancelled = false

    // start() is async — keep the promise so cleanup can wait for it before
    // stopping, otherwise a fast unmount (e.g. StrictMode) leaves the camera on
    const startPromise = scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      decoded => {
        if (handledRef.current) return // decode callback keeps firing until stop completes
        handledRef.current = true
        scanner.stop().catch(() => {})
        onScan(extractMachineId(decoded))
      },
      () => {} // ignore per-frame errors
    ).catch(() => {
      if (!cancelled) {
        setError('Camera unavailable. Use manual entry below.')
        setMode('manual')
      }
      return 'failed'
    })

    return () => {
      cancelled = true
      startPromise.then(result => {
        if (result !== 'failed' && scanner.isScanning) {
          return scanner.stop().catch(() => {})
        }
      }).then(() => scanner.clear()).catch(() => {})
    }
  }, [mode, onScan])

  function submitManual() {
    const id = extractMachineId(manualId)
    if (!id) { setError('Enter a machine ID'); return }
    onScan(id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Scan machine QR</h2>

        {/* mode toggle */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => { setMode('camera'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'camera' ? 'bg-indigo-600 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
            <Camera className="w-4 h-4" /> Camera
          </button>
          <button onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'manual' ? 'bg-indigo-600 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
            <Keyboard className="w-4 h-4" /> Manual
          </button>
        </div>

        {mode === 'camera' ? (
          <div>
            <div id={divId} className="rounded-lg overflow-hidden bg-black aspect-square" />
            <p className="text-xs text-gray-500 mt-2 text-center">Point your camera at the machine's QR code</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label">Machine ID</label>
              <input value={manualId} onChange={e => setManual(e.target.value)}
                className="input" placeholder="Paste or type the machine ID"
                onKeyDown={e => e.key === 'Enter' && submitManual()} />
            </div>
            <button onClick={submitManual} className="btn-primary w-full">Open machine</button>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  )
}
