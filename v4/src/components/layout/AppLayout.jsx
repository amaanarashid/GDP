import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import EmergencyBanner from './EmergencyBanner'
import {
  LayoutDashboard, Settings, PlayCircle, LogOut, Activity, Menu, X, BrainCircuit,
} from 'lucide-react'

export default function AppLayout() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()

  const closeNav = () => setNavOpen(false)

  return (
    <div className="min-h-screen md:flex">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center gap-3 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3">
        <button onClick={() => setNavOpen(true)} className="icon-btn" aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900 text-sm">AGV Maintenance</span>
      </header>

      {/* Backdrop (mobile, when nav open) */}
      {navOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={closeNav} aria-hidden="true" />
      )}

      {/* Sidebar — fixed on desktop, slide-over on mobile */}
      <aside className={`w-60 bg-white border-r border-gray-200 flex flex-col fixed h-screen z-50
        transition-transform duration-200 md:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm leading-tight flex-1">AGV<br/>Maintenance</span>
          <button onClick={closeNav} className="icon-btn md:hidden" aria-label="Close menu">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink to="/dashboard" onClick={closeNav} className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </NavLink>
          <NavLink to="/model" onClick={closeNav} className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <BrainCircuit className="w-4 h-4" /> ML Model
          </NavLink>
          {isAdmin && (
            <>
              <NavLink to="/simulate" onClick={closeNav} className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <PlayCircle className="w-4 h-4" /> Simulator
              </NavLink>
              <NavLink to="/admin" onClick={closeNav} className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <Settings className="w-4 h-4" /> Admin
              </NavLink>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center text-xs font-medium text-indigo-700">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="sidebar-link w-full mt-1">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 md:ml-60 p-4 md:p-6 max-w-[1400px] w-full mx-auto">
        <EmergencyBanner />
        <Outlet />
      </main>
    </div>
  )
}
