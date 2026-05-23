import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store'
import Sidebar from '../components/Sidebar'
import { Page, ToastProvider } from '../components/ui'
import { BirthdayManager } from '../components/BirthdayEffects'

export default function EmployeeLayout() {
  const user     = useStore(s => s.user)
  const location = useLocation()

  return (
    <Page className="flex h-screen bg-surface-900 overflow-hidden">
      <ToastProvider>
        <BirthdayManager user={user} />
        <Sidebar />
        <main className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{    opacity: 0, x: -10 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </ToastProvider>
    </Page>
  )
}
