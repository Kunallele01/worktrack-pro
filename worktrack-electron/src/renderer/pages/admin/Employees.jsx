import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Shield, ShieldOff, UserX, UserCheck, Trash2 } from 'lucide-react'
import { getUsers, updateUser, deleteUser, getMonthHistory } from '../../lib/supabase'
import { Card, Badge, Avatar, Button } from '../../components/ui'
import { useToast, useConfirm } from '../../components/ui'

function AttendancePill({ userId }) {
  const [label, setLabel] = useState('—')
  useEffect(() => {
    const now = new Date()
    getMonthHistory(userId, now.getFullYear(), now.getMonth() + 1).then(records => {
      const present = records.filter(r => ['in_office','wfh'].includes(r.status)).length
      // Count weekdays this month up to today
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

function EmployeeCard({ user, onAction }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className="p-5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar name={user.full_name} size={11} textSize="text-sm" />
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-800
              ${user.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-100 truncate">{user.full_name}</p>
            <p className="text-xs font-mono text-accent-400">{user.employee_id}</p>
            {user.department && <p className="text-xs text-gray-500 mt-0.5">{user.department}</p>}
          </div>
          {user.is_admin && <Badge status="admin" />}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          <AttendancePill userId={user.id} />
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
  const [users, setUsers]   = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

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
          {filtered.map(u => <EmployeeCard key={u.id} user={u} onAction={handleAction} />)}
        </div>
      </div>
    </div>
  )
}
