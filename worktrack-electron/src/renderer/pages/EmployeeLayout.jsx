import React, { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { flushPendingAlerts } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import ErrorBoundary from '../components/ErrorBoundary'
import { Page, ToastProvider } from '../components/ui'
import { BirthdayManager } from '../components/BirthdayEffects'

export default function EmployeeLayout() {
  const user     = useStore(s => s.user)
  const location = useLocation()

  // Alert timers die with the app; resend anything they missed.
  useEffect(() => {
    if (!user?.id) return
    flushPendingAlerts(user.id).catch(() => {})
  }, [user?.id])

  return (
    <Page className="flex h-screen bg-surface-900 overflow-hidden">
      <ToastProvider>
        <BirthdayManager user={user} />
        <Sidebar />
        <main className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
          {/* No AnimatePresence: a stalled exit would leave the page unmounted. */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: '100%' }}
          >
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </motion.div>
        </main>
      </ToastProvider>
    </Page>
  )
}
