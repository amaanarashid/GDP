import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { X, Download, Printer } from 'lucide-react'

export default function QRCodeModal({ machine, onClose }) {
  const canvasWrapRef = useRef(null)

  function download() {
    const canvas = canvasWrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `QR-${machine.name.replace(/\s+/g, '-')}.png`
    a.click()
  }

  function print() {
    const canvas = canvasWrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const w = window.open('', '_blank')
    w.document.write(`
      <html><head><title>${machine.name} QR</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:40px">
        <h2>${machine.name}</h2>
        <p>${machine.location || ''}</p>
        <img src="${url}" style="width:300px;height:300px" />
        <p style="color:#666;font-size:12px">Scan to view machine details</p>
      </body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-sm relative text-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-white mb-1">{machine.name}</h2>
        <p className="text-sm text-gray-500 mb-4">{machine.location || '—'}</p>

        <div ref={canvasWrapRef} className="bg-white p-4 rounded-lg inline-block mb-4">
          <QRCodeCanvas value={machine.id} size={200} level="M" includeMargin />
        </div>

        <p className="text-xs text-gray-500 mb-4 font-mono break-all">{machine.id}</p>

        <div className="flex gap-2">
          <button onClick={download} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Download
          </button>
          <button onClick={print} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
    </div>
  )
}
