import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import EmergencyBanner from './EmergencyBanner'
import {
  LayoutDashboard, Settings, PlayCircle, LogOut, Activity, User,
} from 'lucide-react'

export default function AppLayout() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-screen">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-white text-sm leading-tight">AGV<br/>Maintenance</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink to="/dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </NavLink>
          {isAdmin && (
            <>
              <NavLink to="/simulate" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <PlayCircle className="w-4 h-4" /> Simulator
              </NavLink>
              <NavLink to="/admin" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <Settings className="w-4 h-4" /> Admin
              </NavLink>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-800 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-700 flex items-center justify-center text-xs font-medium text-indigo-300">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="sidebar-link w-full mt-1">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-60 p-6 max-w-[1400px]">
        <EmergencyBanner />
        <Outlet />
      </main>
    </div>
  )
}
