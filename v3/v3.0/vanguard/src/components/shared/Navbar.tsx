import { Link, useLocation } from 'react-router-dom'
import { Activity, Cpu, QrCode, Settings } from 'lucide-react'

const navLinks = [
  { to: '/', label: 'Machines', icon: Cpu },
  { to: '/scan', label: 'Scan QR', icon: QrCode },
  { to: '/simulator', label: 'Simulator', icon: Settings },
]

export default function Navbar() {
  const location = useLocation()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 h-16">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Activity className="text-brand-500" size={24} />
          <span className="text-xl font-bold tracking-tight">Vanguard</span>
        </Link>
        <div className="flex items-center gap-1">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                location.pathname === to
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}