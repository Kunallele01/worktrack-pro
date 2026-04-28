import React, { useEffect, Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div className="h-screen flex flex-col items-center justify-center p-8 bg-surface-900">
        <p className="text-red-400 text-xl font-bold mb-4">Render Error</p>
        <pre className="text-red-300 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-4 max-w-2xl overflow-auto whitespace-pre-wrap">
          {this.state.error?.message}{'\n\n'}{this.state.error?.stack}
        </pre>
        <button onClick={() => this.setState({ error: null })}
          className="mt-4 px-4 py-2 bg-accent-500 text-white rounded-xl text-sm">
          Try Again
        </button>
      </div>
    )
    return this.props.children
  }
}
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useStore } from './lib/store'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Leave from './pages/Leave'
import Corrections from './pages/Corrections'
import AdminLayout from './pages/admin/AdminLayout'
import Overview from './pages/admin/Overview'
import Attendance from './pages/admin/Attendance'
import Employees from './pages/admin/Employees'
import LeaveRequests from './pages/admin/LeaveRequests'
import AdminCorrections from './pages/admin/AdminCorrections'
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
          <Route path="/dashboard"   element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/leaves"      element={<PrivateRoute><ErrorBoundary><Leave /></ErrorBoundary></PrivateRoute>} />
          <Route path="/corrections" element={<PrivateRoute><Corrections /></PrivateRoute>} />
          <Route path="/settings"    element={<PrivateRoute><EmployeeSettings /></PrivateRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<Overview />} />
            <Route path="attendance"   element={<Attendance />} />
            <Route path="employees"    element={<Employees />} />
            <Route path="leaves"       element={<ErrorBoundary><LeaveRequests /></ErrorBoundary>} />
            <Route path="corrections"  element={<AdminCorrections />} />
            <Route path="reports"      element={<Reports />} />
            <Route path="map"          element={<MapView />} />
            <Route path="settings"     element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </HashRouter>
  )
}
