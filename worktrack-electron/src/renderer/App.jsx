import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useStore } from './lib/store'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import AdminLayout from './pages/admin/AdminLayout'
import Overview from './pages/admin/Overview'
import Attendance from './pages/admin/Attendance'
import Employees from './pages/admin/Employees'
import Reports from './pages/admin/Reports'
import MapView from './pages/admin/MapView'
import AdminSettings from './pages/admin/Settings'
import EmployeeSettings from './pages/Settings'

function PrivateRoute({ children }) {
  const user = useStore(s => s.user)
  return user ? children : <Navigate to="/" replace />
}

function AdminRoute({ children }) {
  const user    = useStore(s => s.user)
  const isAdmin = useStore(s => s.isAdmin)
  if (!user) return <Navigate to="/" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const theme    = useStore(s => s.theme)
  const setTheme = useStore(s => s.setTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AnimatePresence mode="wait">
        <Routes>
          {/* Public */}
          <Route path="/"         element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot"   element={<ForgotPassword />} />

          {/* Employee */}
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/settings"  element={<PrivateRoute><EmployeeSettings /></PrivateRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<Overview />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="employees"  element={<Employees />} />
            <Route path="reports"    element={<Reports />} />
            <Route path="map"        element={<MapView />} />
            <Route path="settings"   element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </HashRouter>
  )
}
