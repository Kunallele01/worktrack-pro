import React, { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getSettings, sendCheckInReminders } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import Sidebar from '../../components/Sidebar'
import CommandPalette from '../../components/CommandPalette'
import ErrorBoundary from '../../components/ErrorBoundary'
import { Page, ToastProvider } from '../../components/ui'
import { BirthdayManager } from '../../components/BirthdayEffects'

function checkAndSendReminders(settings) {
  if (settings.reminder_enabled !== 'true') return
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  if (ist.getDay() === 0 || ist.getDay() === 6) return   // never on weekends
  const today  = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
  const cacheK = `wt_reminder_sent_${today}`
  if (localStorage.getItem(cacheK)) return  // Already sent today

  const parts  = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const nowH   = parseInt(parts.find(p => p.type === 'hour').value,   10)
  const nowM   = parseInt(parts.find(p => p.type === 'minute').value, 10)
  const [rH, rM] = (settings.reminder_time || '10:30').split(':').map(Number)

  if ((nowH * 60 + nowM) >= (rH * 60 + rM)) {
    sendCheckInReminders()
      .then(n => {
        if (n > 0) console.log(`[Reminder] Sent to ${n} employees`)
        localStorage.setItem(cacheK, '1')
      })
      .catch(e => console.warn('[Reminder] Failed:', e.message))
  }
}

export default function AdminLayout() {
  const setSettings = useStore(s => s.setSettings)
  const user        = useStore(s => s.user)
  const location    = useLocation()
  const [askOpen, setAskOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAskOpen(o => !o)
      }
    }
    const onAsk = () => setAskOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('worktrack:open-ask', onAsk)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('worktrack:open-ask', onAsk)
    }
  }, [])

  useEffect(() => {
    getSettings(true).then(s => {
      setSettings(s)
      checkAndSendReminders(s)
    })

    // Check every 5 minutes for check-in reminders
    const interval = setInterval(() => {
      getSettings().then(s => {
        checkAndSendReminders(s)
      })
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Page className="flex h-screen bg-surface-900 overflow-hidden">
      <ToastProvider>
        <BirthdayManager user={user} />
        {/* Deliberately not in AnimatePresence: a stalled exit leaves a
            full-screen invisible backdrop that eats every click. */}
        {askOpen && <CommandPalette open onClose={() => setAskOpen(false)} />}
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
