import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Route, CheckSquare, Square, ChevronDown } from 'lucide-react'
import { getUsers, getAdmins, bulkSetAssignedAdmin } from '../../lib/supabase'
import { Avatar, Button, Select, useToast } from '../../components/ui'

// Opens UPWARD, not downward — this picker lives in a bar pinned to the
// bottom of the overlay, so a normal downward dropdown gets clipped by the
// panel's overflow-hidden edge. Local to this file since nowhere else needs it.
function AdminPicker({ value, onChange, admins }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selected = admins.find(a => a.id === value)

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="input-base flex items-center justify-between gap-2 text-left w-full">
        <span className={`truncate ${selected ? 'text-gray-100' : 'text-gray-500'}`}>
          {selected ? selected.full_name : 'Choose an admin…'}
        </span>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute bottom-full mb-1.5 left-0 right-0 z-50
                       bg-surface-800 border border-white/10 rounded-xl shadow-2xl
                       overflow-auto max-h-56"
          >
            {admins.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">No other admins yet.</p>
            ) : admins.map(a => (
              <button key={a.id} type="button"
                onClick={() => { onChange(a.id); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5
                  ${a.id === value ? 'text-accent-400 bg-accent-500/10 font-medium' : 'text-gray-300'}`}>
                {a.full_name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function LeaveRoutingOverlay({ onClose }) {
  const toast = useToast()
  const [users,    setUsers   ] = useState([])
  const [admins,   setAdmins  ] = useState([])
  const [loading,  setLoading ] = useState(true)
  const [search,   setSearch  ] = useState('')
  const [dept,     setDept    ] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [target,   setTarget  ] = useState('')
  const [saving,   setSaving  ] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [u, a] = await Promise.all([getUsers(), getAdmins()])
      setUsers(u); setAdmins(a)
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const adminName = useMemo(() => {
    const m = new Map(admins.map(a => [a.id, a.full_name]))
    return (id) => m.get(id) || null
  }, [admins])

  // Admins never submit leave requests through this app, so routing only
  // applies to non-admin employees.
  const employees = users.filter(u => !u.is_admin)

  const depts = [...new Set(employees.map(u => u.department).filter(Boolean))].sort()

  const filtered = employees.filter(u => {
    if (dept && u.department !== dept) return false
    if (!search) return true
    const s = search.toLowerCase()
    return u.full_name?.toLowerCase().includes(s) || u.employee_id?.toLowerCase().includes(s)
  })

  const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id))

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) filtered.forEach(u => next.delete(u.id))
      else             filtered.forEach(u => next.add(u.id))
      return next
    })
  }

  async function applyAssignment(adminId) {
    if (selected.size === 0) return
    setSaving(true)
    try {
      const ids = [...selected]
      await bulkSetAssignedAdmin(ids, adminId)
      toast(adminId
        ? `${ids.length} employee${ids.length !== 1 ? 's' : ''} routed to ${adminName(adminId)}.`
        : `Cleared routing for ${ids.length} employee${ids.length !== 1 ? 's' : ''}.`, 'success')
      setSelected(new Set())
      setTarget('')
      load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="bg-surface-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-500/15 border border-accent-500/30 flex items-center justify-center shrink-0">
              <Route size={16} className="text-accent-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-100">Leave Request Routing</p>
              <p className="text-xs text-gray-400">Choose which admin reviews and gets notified for each employee</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input placeholder="Search by name or ID…" value={search} onChange={e => setSearch(e.target.value)}
              className="input-base pl-9 py-2.5 text-sm w-full" />
          </div>
          {depts.length > 0 && (
            <div className="w-44 shrink-0">
              <Select value={dept} onChange={setDept}
                options={[{ value: '', label: 'All Departments' }, ...depts.map(d => ({ value: d, label: d }))]} />
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">Loading employees…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">No employees match.</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-surface-800 z-10">
                <tr className="border-b border-white/[0.06]">
                  <th className="w-12 px-6 py-3">
                    <button onClick={toggleAll} className="text-gray-500 hover:text-accent-400 transition-colors" title="Select all">
                      {allSelected ? <CheckSquare size={16} className="text-accent-400" /> : <Square size={16} />}
                    </button>
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-3">Employee</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-3">Department</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-3">Routed To</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isSel      = selected.has(u.id)
                  const routedName = adminName(u.assigned_admin_id)
                  return (
                    <tr key={u.id} onClick={() => toggle(u.id)}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors
                        ${isSel ? 'bg-accent-500/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                      <td className="px-6 py-3">
                        {isSel ? <CheckSquare size={16} className="text-accent-400" /> : <Square size={16} className="text-gray-600" />}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={u.full_name} />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-200 font-medium truncate">{u.full_name}</p>
                            <p className="text-xs font-mono text-gray-500">{u.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-gray-400 text-xs">{u.department || '—'}</td>
                      <td className="px-2 py-3">
                        {routedName ? (
                          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-accent-500/15 text-accent-400 border border-accent-500/20">
                            {routedName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/20">
                            Unassigned
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.15 }}
            className="shrink-0 flex items-center gap-3 px-6 py-4 border-t border-white/[0.08] bg-white/[0.02] flex-wrap">
            <span className="text-sm text-gray-200 font-medium shrink-0">{selected.size} selected</span>
            <div className="w-52 shrink-0">
              <AdminPicker value={target} onChange={setTarget} admins={admins} />
            </div>
            <Button onClick={() => applyAssignment(target)} disabled={!target || saving} loading={saving} className="text-sm shrink-0">
              Assign
            </Button>
            <Button variant="secondary" onClick={() => applyAssignment(null)} disabled={saving} loading={saving} className="text-sm shrink-0">
              Clear Routing
            </Button>
            <button onClick={() => setSelected(new Set())}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-auto shrink-0">
              Deselect all
            </button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
