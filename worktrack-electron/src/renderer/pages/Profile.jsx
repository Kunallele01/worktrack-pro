import React, { useState } from 'react'
import { updateUser } from '../lib/supabase'
import { useStore } from '../lib/store'
import Sidebar from '../components/Sidebar'
import { Page, Card, Button, Input } from '../components/ui'
import { ToastProvider, useToast } from '../components/ui'

function Field({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
      <span className="text-xs text-gray-400 uppercase font-semibold tracking-wide w-32">{label}</span>
      <span className="text-sm text-gray-400 flex-1 text-right">{value || '—'}</span>
    </div>
  )
}

function ProfileInner() {
  const toast   = useToast()
  const user    = useStore(s => s.user)
  const setUser = useStore(s => s.setUser)

  const [name,   setName  ] = useState(user?.full_name || '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { toast('Name cannot be empty.', 'error'); return }
    if (trimmed === user?.full_name) { toast('No changes to save.', 'info'); return }
    setSaving(true)
    try {
      await updateUser(user.id, { full_name: trimmed })
      setUser({ ...user, full_name: trimmed })
      toast('Profile updated!', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <h1 className="text-xl font-bold text-gray-100">Profile</h1>

        <Card className="p-5 max-w-xl">
          <h3 className="text-sm font-semibold text-gray-200 mb-4 pb-3 border-b border-white/[0.06]">Account Details</h3>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <Input
              label="Full Name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
            <div className="flex flex-col gap-3 pt-1">
              <Field label="Employee ID" value={user?.employee_id} />
              <Field label="Email"       value={user?.email} />
              <Field label="Department"  value={user?.department} />
            </div>
            <Button type="submit" loading={saving} className="w-fit text-sm mt-1">
              Save Changes
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

export default function Profile() {
  return <Page><ToastProvider><ProfileInner /></ToastProvider></Page>
}
