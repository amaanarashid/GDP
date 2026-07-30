import { QrCode } from 'lucide-react'

export default function QRScanner() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
      <QrCode className="text-brand-500" size={48} />
      <h1 className="mt-4 text-3xl font-bold text-white">QR Scanner</h1>
      <p className="mt-2 text-gray-400">Scanner setup is ready for the next implementation step.</p>
    </div>
  )
}
