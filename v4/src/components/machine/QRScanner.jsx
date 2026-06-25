import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera, Keyboard } from 'lucide-react'

export default function QRScanner({ onScan, onClose }) {
  const [mode, setMode]       = useState('camera') // 'camera' | 'manual'
  const [manualId, setManual] = useState('')
  const [error, setError]     = useState('')
  const scannerRef = useRef(null)
  const divId = 'qr-reader'

  useEffect(() => {
    if (mode !== 'camera') return
    let scanner
    const start = async () => {
      try {
        scanner = new Html5Qrcode(divId)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          decoded => { handleResult(decoded) },
          () => {} // ignore per-frame errors
        )
      } catch (e) {
        setError('Camera unavailable. Use manual entry below.')
        setMode('manual')
      }
    }
    start()
    return () => {
      if (scanner?.isScanning) scanner.stop().catch(() => {})
    }
  }, [mode])

  function handleResult(decoded) {
    // QR encodes the machine ID (possibly prefixed with QR-)
    let id = decoded.trim()
    if (id.startsWith('QR-')) id = id.slice(3)
    stopAndScan(id)
  }

  async function stopAndScan(id) {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop().catch(() => {})
    }
    onScan(id)
  }

  function submitManual() {
    let id = manualId.trim()
    if (!id) { setError('Enter a machine ID'); return }
    if (id.startsWith('QR-')) id = id.slice(3)
    onScan(id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-white mb-4">Scan machine QR</h2>

        {/* mode toggle */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => { setMode('camera'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'camera' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            <Camera className="w-4 h-4" /> Camera
          </button>
          <button onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
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

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>
    </div>
  )
}
