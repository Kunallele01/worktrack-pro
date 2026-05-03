import React, { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getSettings, runAutoCheckout, sendCheckInReminders } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import Sidebar from '../../components/Sidebar'
import { Page, ToastProvider } from '../../components/ui'
import { BirthdayManager } from '../../components/BirthdayEffects'

function checkAndSendReminders(settings) {
  if (settings.reminder_enabled !== 'true') return
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

  useEffect(() => {
    getSettings(true).then(s => {
      setSettings(s)
      checkAndSendReminders(s)
    })
    runAutoCheckout().then(n => { if (n > 0) console.log(`Auto-checkout: ${n} records updated`) })

    // Check every 5 minutes if reminders need to be sent
    const interval = setInterval(() => {
      getSettings().then(checkAndSendReminders)
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

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
