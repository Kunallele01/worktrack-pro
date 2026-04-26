import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { getSettings, runAutoCheckout } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import Sidebar from '../../components/Sidebar'
import { Page, ToastProvider } from '../../components/ui'

export default function AdminLayout() {
  const setSettings = useStore(s => s.setSettings)

  useEffect(() => {
    getSettings(true).then(setSettings)
    runAutoCheckout().then(n => { if (n > 0) console.log(`Auto-checkout: ${n} records updated`) })
  }, [])

  return (
    <Page className="flex h-screen bg-surface-900 overflow-hidden">
      <ToastProvider>
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </ToastProvider>
    </Page>
  )
}
