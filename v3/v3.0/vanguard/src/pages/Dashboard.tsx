import { useParams } from 'react-router-dom'
import { Activity } from 'lucide-react'

export default function Dashboard() {
  const { id } = useParams()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-left">
      <div className="flex items-center gap-3">
        <Activity className="text-brand-500" size={28} />
        <div>
          <h1 className="text-3xl font-bold text-white">Machine Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">Machine ID: {id}</p>
        </div>
      </div>
    </div>
  )
}
