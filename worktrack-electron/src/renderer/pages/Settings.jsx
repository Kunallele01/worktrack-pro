import React, { useState, useEffect } from 'react'
import { changePassword } from '../lib/supabase'
import { useStore } from '../lib/store'
import Sidebar from '../components/Sidebar'
import { Page, Card, Button, Input, PasswordInput } from '../components/ui'
import { ToastProvider, useToast } from '../components/ui'

function Section({ title, children }) {
  return (
    <Card className="p-5 max-w-xl">
      <h3 className="text-sm font-semibold text-gray-200 mb-4 pb-3 border-b border-white/[0.06]">{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  )
}

function Field({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
      <span className="text-xs text-gray-400 uppercase font-semibold tracking-wide w-28">{label}</span>
      <span className="text-sm text-gray-200 flex-1 text-right">{value || '—'}</span>
    </div>
  )
}

function SettingsInner() {
  const toast  = useToast()
  const user     = useStore(s => s.user)
  const theme    = useStore(s => s.theme)
  const setTheme = useStore(s => s.setTheme)
  const [pw, setPw] = useState({ cur: '', new: '', conf: '' })
  const [startup, setStartup] = useState(false)
  const [saving,  setSaving ] = useState(false)
  const [version, setVersion] = useState('2.0.0')

  useEffect(() => {
    window.api?.getStartup().then(setStartup)
    window.api?.getVersion().then(setVersion)
  }, [])

  async function handleChangePw(e) {
    e.preventDefault()
    if (pw.new !== pw.conf) { toast('Passwords do not match.', 'error'); return }
    setSaving(true)
    try {
      await changePassword(pw.new)
      setPw({ cur: '', new: '', conf: '' })
      toast('Password updated!', 'success')
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  async function toggleStartup() {
    const next = !startup
    setStartup(next)
    await window.api?.setStartup(next)
    toast(`Launch on startup ${next ? 'enabled' : 'disabled'}.`, 'success')
  }

  return (
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <h1 className="text-xl font-bold text-gray-100">Settings</h1>

        <Section title="Account">
          <Field label="Full Name"   value={user?.full_name} />
          <Field label="Employee ID" value={user?.employee_id} />
          <Field label="Email"       value={user?.email} />
          <Field label="Department"  value={user?.department} />
        </Section>

        <Section title="Security">
          <form onSubmit={handleChangePw} className="flex flex-col gap-4">
            <PasswordInput label="New Password" placeholder="Min 8 chars" value={pw.new}  onChange={e => setPw(p => ({...p, new: e.target.value}))} required />
            <PasswordInput label="Confirm New"  placeholder="Repeat password" value={pw.conf} onChange={e => setPw(p => ({...p, conf: e.target.value}))} required />
            <Button type="submit" loading={saving} className="w-fit text-sm">Update Password</Button>
          </form>
        </Section>

        <Section title="Appearance">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-200">Dark Mode</p>
              <p className="text-xs text-gray-500 mt-0.5">Also available via the toggle in the sidebar</p>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${theme === 'dark' ? 'bg-accent-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </Section>

        <Section title="System">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-200">Launch on Windows startup</p>
              <p className="text-xs text-gray-500 mt-0.5">Start WorkTrack Pro automatically when you log in</p>
            </div>
            <button onClick={toggleStartup}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${startup ? 'bg-accent-500' : 'bg-gray-700'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${startup ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </Section>

        <Section title="About">
          <Field label="Application" value="WorkTrack Pro" />
          <Field label="Version"     value={version} />
          <Field label="Stack"       value="Electron + React + Supabase" />
        </Section>
      </div>
    </div>
  )
}

export default function EmployeeSettings() {
  return <Page><ToastProvider><SettingsInner /></ToastProvider></Page>
}
