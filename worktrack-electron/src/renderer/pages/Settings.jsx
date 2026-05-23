import React, { useState, useEffect } from 'react'
import { Shield, Palette, Monitor, Info } from 'lucide-react'
import { changePassword } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Card, Button, PasswordInput } from '../components/ui'
import { useToast } from '../components/ui'

function Section({ icon, title, accent = 'bg-accent-500/15 border-accent-500/30 text-accent-400', children }) {
  return (
    <Card className="p-5 max-w-xl">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/[0.06]">
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${accent}`}>
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  )
}

function Toggle({ enabled, onToggle }) {
  return (
    <button onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0
        ${enabled ? 'bg-accent-500' : 'bg-gray-600'}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200
        ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function SettingsInner() {
  const toast    = useToast()
  const theme    = useStore(s => s.theme)
  const setTheme = useStore(s => s.setTheme)
  const [pw, setPw]         = useState({ new: '', conf: '' })
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
    if (pw.new.length < 8)  { toast('Password must be at least 8 characters.', 'error'); return }
    setSaving(true)
    try {
      await changePassword(pw.new)
      setPw({ new: '', conf: '' })
      toast('Password updated successfully!', 'success')
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
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
      <h1 className="text-xl font-bold text-gray-100">Settings</h1>

      {/* Security */}
      <Section icon={<Shield size={13} />} title="Security"
        accent="bg-emerald-500/15 border-emerald-500/30 text-emerald-400">
        <form onSubmit={handleChangePw} className="flex flex-col gap-4">
          <PasswordInput label="New Password"    placeholder="Min 8 characters" value={pw.new}  onChange={e => setPw(p => ({...p, new: e.target.value}))} required />
          <PasswordInput label="Confirm Password" placeholder="Repeat password"  value={pw.conf} onChange={e => setPw(p => ({...p, conf: e.target.value}))} required />
          <Button type="submit" loading={saving} className="w-fit text-sm">Update Password</Button>
        </form>
      </Section>

      {/* Appearance */}
      <Section icon={<Palette size={13} />} title="Appearance"
        accent="bg-violet-500/15 border-violet-500/30 text-violet-400">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-200">Dark Mode</p>
            <p className="text-xs text-gray-500 mt-0.5">Toggle also available at the bottom of the sidebar</p>
          </div>
          <Toggle enabled={theme === 'dark'} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        </div>
      </Section>

      {/* System */}
      <Section icon={<Monitor size={13} />} title="System"
        accent="bg-blue-500/15 border-blue-500/30 text-blue-400">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-200">Launch on Windows startup</p>
            <p className="text-xs text-gray-500 mt-0.5">WorkTrack Pro starts automatically when you sign in to Windows</p>
          </div>
          <Toggle enabled={startup} onToggle={toggleStartup} />
        </div>
      </Section>

      {/* About — branded card */}
      <Card className="max-w-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-accent-500/15 border border-accent-500/30 text-accent-400 flex items-center justify-center shrink-0">
            <Info size={13} />
          </div>
          <h3 className="text-sm font-semibold text-gray-200">About</h3>
        </div>
        {/* Logo hero */}
        <div className="px-5 py-5 flex items-center gap-4 border-b border-white/[0.06]">
          <div className="w-12 h-12 rounded-2xl bg-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/30 shrink-0">
            <span className="text-white text-xl font-black">W</span>
          </div>
          <div>
            <p className="text-base font-bold text-gray-100">WorkTrack Pro</p>
            <p className="text-xs text-gray-500 mt-0.5">Attendance Intelligence · v{version}</p>
          </div>
          <div className="ml-auto">
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Up to date
            </span>
          </div>
        </div>
        {/* Info rows */}
        <div className="divide-y divide-white/[0.04]">
          {[
            ['Version',  version],
            ['Platform', 'Electron · Windows'],
            ['Stack',    'React + Supabase'],
            ['Build',    'Production'],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center justify-between px-5 py-2.5">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</span>
              <span className="text-xs text-gray-300 font-mono">{val}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default function EmployeeSettings() {
  return <SettingsInner />
}
