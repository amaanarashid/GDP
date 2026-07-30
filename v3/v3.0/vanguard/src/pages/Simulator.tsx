import { Settings } from 'lucide-react'

export default function Simulator() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
      <Settings className="text-brand-500" size={48} />
      <h1 className="mt-4 text-3xl font-bold text-white">Simulator</h1>
      <p className="mt-2 text-gray-400">Machine simulation controls will appear here.</p>
    </div>
  )
}
