import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { EmergencyProvider } from './context/EmergencyContext'
import ProtectedRoute from './ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

import Login         from './pages/auth/Login'
import Dashboard     from './pages/dashboard/Dashboard'
import MachineDetail from './pages/machine/MachineDetail'
import Admin         from './pages/admin/Admin'
import Simulate      from './pages/simulate/Simulate'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EmergencyProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard"   element={<Dashboard />} />
              <Route path="/machine/:id" element={<MachineDetail />} />
            </Route>

            <Route element={<ProtectedRoute requireAdmin><AppLayout /></ProtectedRoute>}>
              <Route path="/admin"    element={<Admin />} />
              <Route path="/simulate" element={<Simulate />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </EmergencyProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
