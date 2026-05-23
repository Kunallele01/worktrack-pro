import React, { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { updateUser, getMonthSummary } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Card, Button, Input, Avatar } from '../components/ui'
import { useToast } from '../components/ui'

function ReadField({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-300">{value || '—'}</span>
    </div>
  )
}

function StatChip({ label, value, color, bg }) {
  return (
    <div className={`flex flex-col items-center px-3 py-3 rounded-2xl ${bg}`}>
      <p className={`text-xl font-bold font-mono tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 text-center leading-tight">{label}</p>
    </div>
  )
}

function ProfileInner() {
  const toast   = useToast()
  const user    = useStore(s => s.user)
  const setUser = useStore(s => s.setUser)

  const [name,     setName    ] = useState(user?.full_name || '')
  const [birthday, setBirthday] = useState(user?.birthday  || '')
  const [saving,   setSaving  ] = useState(false)
  const [stats,    setStats   ] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    const now = new Date()
    getMonthSummary(user.id, now.getFullYear(), now.getMonth() + 1).then(setStats)
  }, [user?.id])

  async function handleSave(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { toast('Name cannot be empty.', 'error'); return }
    const unchanged = trimmed === user?.full_name && birthday === (user?.birthday || '')
    if (unchanged) { toast('No changes to save.', 'info'); return }
    setSaving(true)
    try {
      const updates = { full_name: trimmed }
      if (birthday !== (user?.birthday || '')) updates.birthday = birthday || null
      await updateUser(user.id, updates)
      setUser({ ...user, ...updates })
      toast('Profile updated!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const now         = new Date()
  const monthLabel  = now.toLocaleString('en', { month: 'long', year: 'numeric' })
  const memberSince = user?.created_at ? format(parseISO(user.created_at), 'MMM yyyy') : null
  const absent      = stats ? Math.max(0, stats.working_days - stats.present) : 0
  const pct         = stats?.working_days > 0 ? Math.round(stats.present / stats.working_days * 100) : 0
  const pctColor    = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">

        <h1 className="text-xl font-bold text-gray-100">Profile</h1>

        {/* ── Hero card ── */}
        <Card className="p-6">
          <div className="flex items-center gap-5">
            <Avatar name={user?.full_name} size={18} />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-100 truncate">{user?.full_name}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs font-mono text-gray-400 bg-white/[0.06] px-2 py-0.5 rounded-lg">
                  {user?.employee_id}
                </span>
                {user?.department && (
                  <span className="text-xs text-gray-400">· {user.department}</span>
                )}
                {user?.is_admin && (
                  <span className="text-xs font-semibold text-accent-400 bg-accent-500/10 border border-accent-500/20 px-2 py-0.5 rounded-full">
                    Admin
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                {memberSince && <span>Member since {memberSince}</span>}
                {birthday && (
                  <>
                    {memberSince && <span>·</span>}
                    <span>🎂 {format(parseISO(birthday), 'd MMMM')}</span>
                  </>
                )}
              </div>
            </div>
            {stats && (
              <div className="text-right shrink-0 pl-4 border-l border-white/[0.06]">
                <p className={`text-3xl font-bold font-mono tabular-nums ${pctColor}`}>{pct}%</p>
                <p className="text-xs text-gray-500 mt-0.5">attendance</p>
                <p className="text-xs text-gray-600">{monthLabel}</p>
              </div>
            )}
          </div>
        </Card>

        {/* ── Edit + Details columns ── */}
        <div className="grid grid-cols-2 gap-4">

          <Card className="p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Edit Profile</h3>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <Input
                label="Full Name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date of Birth</label>
                <input
                  type="date"
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  className="input-base py-2.5 text-sm"
                />
                <p className="text-xs text-gray-600">Used for birthday notifications</p>
              </div>
              <Button type="submit" loading={saving} className="w-fit text-sm">Save Changes</Button>
            </form>
          </Card>

          <Card className="p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Account Details</h3>
            <div className="flex flex-col">
              <ReadField label="Employee ID"  value={user?.employee_id} />
              <ReadField label="Email"        value={user?.email} />
              <ReadField label="Department"   value={user?.department} />
              <ReadField label="Role"         value={user?.is_admin ? 'Administrator' : 'Employee'} />
              {memberSince && <ReadField label="Member Since" value={memberSince} />}
            </div>
          </Card>

        </div>

        {/* ── Monthly stats ── */}
        {stats && (
          <Card className="p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Attendance — {monthLabel}
            </h3>
            <div className="grid grid-cols-5 gap-3">
              <StatChip label="Working Days"  value={stats.working_days} color="text-gray-200"    bg="bg-white/[0.04]" />
              <StatChip label="Present"       value={stats.present}      color="text-emerald-400" bg="bg-emerald-500/10" />
              <StatChip label="WFH"           value={stats.wfh}          color="text-blue-400"    bg="bg-blue-500/10" />
              <StatChip label="Late"          value={stats.late}         color="text-amber-400"   bg="bg-amber-500/10" />
              <StatChip label="Absent"        value={absent}             color="text-red-400"     bg="bg-red-500/10" />
            </div>
          </Card>
        )}

      </div>
    </div>
  )
}

export default function Profile() {
  return <ProfileInner />
}
