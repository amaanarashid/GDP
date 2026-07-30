import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
      <h1 className="text-6xl font-bold text-gray-700">404</h1>
      <p className="text-gray-400">Page not found</p>
      <Link to="/" className="px-4 py-2 bg-brand-600 rounded-lg text-sm hover:bg-brand-700 transition-colors">
        Go home
      </Link>
    </div>
  )
}