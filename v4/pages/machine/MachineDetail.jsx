import { useParams } from 'react-router-dom'
export default function MachineDetail() {
  const { id } = useParams()
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Machine Detail</h1>
      <p className="text-gray-500 mb-6">Machine ID: {id}</p>
      <div className="card text-gray-500">Digital twin + RUL coming in step 5…</div>
    </div>
  )
}
