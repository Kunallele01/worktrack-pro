import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Shield, ShieldOff, UserX, UserCheck, Trash2, Cake } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { getUsers, updateUser, deleteUser, getMonthHistory } from '../../lib/supabase'
import { Card, Badge, Avatar, Button, Input } from '../../components/ui'
import { useToast, useConfirm } from '../../components/ui'

function AttendancePill({ userId }) {
  const [label, setLabel] = useState('—')
  useEffect(() => {
    const now = new Date()
    getMonthHistory(userId, now.getFullYear(), now.getMonth() + 1).then(records => {
      const present = records.filter(r => ['in_office','wfh'].includes(r.status)).length
      const today = now.getDate()
      let workdays = 0
      for (let d = 1; d <= today; d++) {
        const day = new Date(now.getFullYear(), now.getMonth(), d).getDay()
        if (day !== 0 && day !== 6) workdays++
      }
      setLabel(`${present} / ${workdays} days`)
    }).catch(() => setLabel('—'))
  }, [userId])

  return (
    <span className="text-xs font-mono text-gray-400 bg-white/[0.05] px-2 py-0.5 rounded-full">{label}</span>
  )
}

function BirthdayModal({ user, onClose, onSaved }) {
  const toast = useToast()
  const [date, setDate] = useState(user.birthday ? user.birthday.slice(0, 10) : '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateUser(user.id, { birthday: date || null })
      toast(`Birthday ${date ? 'saved' : 'cleared'} for ${user.full_name}.`, 'success')
      onSaved()
      onClose()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-xs p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center">
            <Cake size={16} className="text-pink-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-100">Set Birthday</p>
            <p className="text-xs text-gray-400">{user.full_name}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mb-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date of Birth</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={`${new Date().getFullYear() - 16}-12-31`}
            className="input-base py-2.5 text-sm"
          />
          <p className="text-xs text-gray-500">Leave blank to clear birthday.</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={onClose} className="flex-1 text-sm">Cancel</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1 text-sm">
            <Cake size={14} /> Save
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function EmployeeCard({ user, onAction, onBirthdayEdit }) {
  const todayMD = `${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`
  const bdayMD  = user.birthday ? user.birthday.slice(5) : null  // "MM-DD"
  const isBdayToday = bdayMD === todayMD

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className={`p-5 flex flex-col gap-3 ${isBdayToday ? 'ring-2 ring-pink-500/30' : ''}`}>
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar name={user.full_name} size={11} textSize="text-sm" />
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-800
              ${user.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-100 truncate">
              {user.full_name}
              {isBdayToday && <span className="ml-2 text-base">🎂</span>}
            </p>
            <p className="text-xs font-mono text-accent-400">{user.employee_id}</p>
            {user.department && <p className="text-xs text-gray-500 mt-0.5">{user.department}</p>}
          </div>
          {user.is_admin && <Badge status="admin" />}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          <AttendancePill userId={user.id} />
        </div>

        {/* Birthday row */}
        <div className="flex items-center justify-between py-1.5 px-3 bg-white/[0.03] rounded-xl border border-white/[0.05]">
          <div className="flex items-center gap-2">
            <Cake size={13} className={isBdayToday ? 'text-pink-400' : 'text-gray-500'} />
            <span className="text-xs text-gray-400">
              {user.birthday
                ? format(parseISO(user.birthday), 'd MMM yyyy')
                : <span className="text-gray-600 italic">Birthday not set</span>
              }
              {isBdayToday && <span className="ml-2 text-xs font-bold text-pink-400">Today! 🎉</span>}
            </span>
          </div>
          <button
            onClick={() => onBirthdayEdit(user)}
            className="text-xs text-accent-400 hover:text-accent-300 font-medium transition-colors"
          >
            {user.birthday ? 'Edit' : 'Set'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="ghost" className="text-xs h-8 justify-center"
            onClick={() => onAction('toggle_admin', user)}>
            {user.is_admin ? <><ShieldOff size={13} /> Remove Admin</> : <><Shield size={13} /> Make Admin</>}
          </Button>
          <Button variant={user.is_active ? 'danger' : 'secondary'} className="text-xs h-8 justify-center"
            onClick={() => onAction('toggle_active', user)}>
            {user.is_active ? <><UserX size={13} /> Deactivate</> : <><UserCheck size={13} /> Activate</>}
          </Button>
          <Button variant="danger" className="col-span-2 text-xs h-8 justify-center opacity-60 hover:opacity-100"
            onClick={() => onAction('delete', user)}>
            <Trash2 size={13} /> Delete Account Permanently
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

export default function Employees() {
  const toast   = useToast()
  const { confirm, Dialog } = useConfirm()
  const [users,      setUsers     ] = useState([])
  const [search,     setSearch    ] = useState('')
  const [loading,    setLoading   ] = useState(false)
  const [bdayTarget, setBdayTarget] = useState(null)

  const load = async () => {
    setLoading(true)
    try { setUsers(await getUsers({ search })) }
    catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleAction(action, user) {
    if (action === 'delete') {
      const ok = await confirm(
        'Delete Account Permanently',
        `This will permanently delete ${user.full_name}'s account and ALL their attendance history. This cannot be undone. A notification email will be sent to them.`
      )
      if (!ok) return
      try {
        await deleteUser(user.id, true)
        toast(`${user.full_name}'s account deleted.`, 'success')
        load()
      } catch (e) { toast(e.message, 'error') }
      return
    }

    const isAdmin  = action === 'toggle_admin'
    const title    = isAdmin  ? (user.is_admin  ? 'Remove Admin' : 'Make Admin')
                              : (user.is_active ? 'Deactivate'   : 'Activate')
    const ok = await confirm(title, `${title} for ${user.full_name}?`)
    if (!ok) return
    try {
      const payload = isAdmin  ? { is_admin:  !user.is_admin  }
                               : { is_active: !user.is_active }
      await updateUser(user.id, payload)
      toast(`${title} successful.`, 'success')
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const s = search.toLowerCase()
    return u.full_name?.toLowerCase().includes(s) || u.employee_id?.toLowerCase().includes(s)
  })

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      {Dialog}
      <AnimatePresence>
        {bdayTarget && (
          <BirthdayModal
            user={bdayTarget}
            onClose={() => setBdayTarget(null)}
            onSaved={load}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">
          Employees <span className="text-gray-500 font-normal text-base ml-2">{filtered.length}</span>
        </h1>
        <Button onClick={load} loading={loading} variant="secondary" className="text-sm">Refresh</Button>
      </div>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input placeholder="Search by name or ID…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-base pl-9 text-sm" />
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-4 pb-4">
          {filtered.map(u => (
            <EmployeeCard key={u.id} user={u} onAction={handleAction} onBirthdayEdit={setBdayTarget} />
          ))}
        </div>
      </div>
    </div>
  )
}
