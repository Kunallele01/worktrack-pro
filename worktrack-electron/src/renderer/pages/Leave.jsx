import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, isWeekend } from 'date-fns'
import { Plus, X, Calendar, FileText, Clock } from 'lucide-react'
import { applyLeave, getMyLeaves, getLeaveBalance, getSettings, getHolidays } from '../lib/supabase'
import { LEAVE_TYPES, LEAVE_COLORS } from '../lib/leaveConstants'
import { useStore } from '../lib/store'
import Sidebar from '../components/Sidebar'
import { Page, Card, Button, Select } from '../components/ui'
import { ToastProvider, useToast } from '../components/ui'

// Re-export for any imports that still reference this file
export { LEAVE_TYPES, LEAVE_COLORS }

const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30'   },
  approved: { label: '✓ Approved',     cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  rejected: { label: '✕ Rejected',     cls: 'bg-red-500/15 text-red-400 border border-red-500/30'         },
}

const TEMPLATES = [
  { name: '🤒 Medical Absence',  fill: u => `I, ${u.full_name} (${u.employee_id}) from the ${u.department || 'team'}, am applying for sick leave due to health issues. I will resume work as soon as I recover and will keep my team informed of my progress.` },
  { name: '☀️ Personal Matter',  fill: u => `I, ${u.full_name} (${u.employee_id}), request casual leave to attend to a personal matter. I have ensured that my pending responsibilities will be covered during my absence.` },
  { name: '✈️ Planned Vacation', fill: u => `I, ${u.full_name} (${u.employee_id}) from ${u.department || 'the team'}, would like to apply for planned leave. I have coordinated a proper handover and will ensure all responsibilities are fully covered before my leave begins.` },
  { name: '⚡ Family Emergency', fill: u => `I, ${u.full_name} (${u.employee_id}), am dealing with a family emergency that requires my immediate attention. I sincerely apologize for the short notice and will remain reachable as much as possible.` },
]

function calcWorkDays(start, end, holidays = []) {
  if (!start || !end || end < start) return 0
  const holidaySet = new Set(holidays.map(h => h.date))
  let count = 0
  const cur = new Date(start + 'T12:00:00')
  const fin = new Date(end   + 'T12:00:00')
  while (cur <= fin) {
    const ds = cur.toLocaleDateString('sv-SE')
    if (!isWeekend(cur) && !holidaySet.has(ds)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function BalanceCard({ type, used, quota }) {
  const c = LEAVE_COLORS[type.value]
  const remain = quota ? Math.max(0, quota - used) : null
  const pct    = quota ? Math.round((used / quota) * 100) : 0
  return (
    <Card className={`p-4 border ${c.border}`}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-2xl">{type.icon}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
          {type.value === 'emergency' ? 'EL' : type.value.slice(0,2).toUpperCase()}
        </span>
      </div>
      <p className={`text-3xl font-bold font-mono ${c.text}`}>{remain !== null ? remain : '∞'}</p>
      <p className="text-xs text-gray-500 mt-0.5">{quota ? `of ${quota} days left` : 'no limit'}</p>
      <p className="text-xs font-medium text-gray-400 mt-2">{type.label}</p>
      {quota > 0 && (
        <div className="mt-2 h-1 rounded-full bg-white/10">
          <div className="h-1 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, pct)}%`, background: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : 'rgba(99,102,241,0.6)' }} />
        </div>
      )}
    </Card>
  )
}

function ApplyModal({ user, holidays, quotas, onClose, onSuccess }) {
  const toast = useToast()
  const [type,       setType     ] = useState('sick')
  const [start,      setStart    ] = useState('')
  const [end,        setEnd      ] = useState('')
  const [reason,     setReason   ] = useState('')
  const [tmplIdx,    setTmplIdx  ] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const days = calcWorkDays(start, end, holidays)
  const c    = LEAVE_COLORS[type]
  const today = new Date().toLocaleDateString('sv-SE')

  const pickTemplate = (idx) => {
    setTmplIdx(idx)
    if (idx !== '') setReason(TEMPLATES[parseInt(idx)].fill(user))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!start || !end)    { toast('Select start and end dates.', 'warning');     return }
    if (end < start)       { toast('End date must be after start date.', 'warning'); return }
    if (days === 0)        { toast('No working days in that range.', 'warning'); return }
    if (!reason.trim())    { toast('Please write a reason.', 'warning');           return }
    setSubmitting(true)
    try {
      await applyLeave(user.id, { type, startDate: start, endDate: end, days, reason: reason.trim() })
      toast('Leave request submitted! 🎉', 'success')
      onSuccess()
    } catch (e) { toast(e.message, 'error') }
    finally { setSubmitting(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{   opacity: 0, y: 24,  scale: 0.95 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="bg-surface-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-gray-100">Apply for Leave</h2>
            <p className="text-xs text-gray-400 mt-0.5">{user.full_name} · {user.employee_id} · {user.department}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 p-1.5 rounded-lg hover:bg-white/5 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 flex flex-col gap-5">
          {/* Leave type — big radio buttons */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5 block">Leave Type</label>
            <div className="grid grid-cols-2 gap-2">
              {LEAVE_TYPES.map(t => {
                const tc  = LEAVE_COLORS[t.value]
                const sel = type === t.value
                const quota = t.quotaKey ? parseInt(quotas[t.quotaKey] || '0') : null
                const used  = 0 // simplified — full balance shown in main page
                return (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-150
                      ${sel ? `${tc.bg} ${tc.border} ring-2 ${tc.ring}` : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'}`}>
                    <span className="text-2xl leading-none">{t.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${sel ? tc.text : 'text-gray-200'}`}>{t.label}</p>
                      {quota && <p className="text-xs text-gray-500">{quota} days/yr</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            {[['Start Date', start, v => { setStart(v); if (!end || v > end) setEnd(v) }],
              ['End Date',   end,   setEnd]].map(([lbl, val, onChange]) => (
              <div key={lbl} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{lbl}</label>
                <input type="date" value={val} min={today}
                  onChange={e => onChange(e.target.value)}
                  className="input-base py-2.5 text-sm" required />
              </div>
            ))}
          </div>

          {/* Working days badge */}
          <AnimatePresence>
            {days > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${c.bg} ${c.border}`}>
                <Calendar size={14} className={c.text} />
                <span className={`text-sm font-semibold ${c.text}`}>{days} working day{days !== 1 ? 's' : ''}</span>
                <span className="text-xs text-gray-500">(weekends & holidays excluded)</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Template picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <FileText size={11} /> Use a Template <span className="text-gray-600 font-normal normal-case">(optional — auto-fills your name)</span>
            </label>
            <Select
              value={tmplIdx}
              onChange={v => pickTemplate(v)}
              options={[
                { value: '', label: '— Write your own message below —' },
                ...TEMPLATES.map((t, i) => ({ value: String(i), label: t.name }))
              ]}
            />
          </div>

          {/* Reason textarea */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Message to Admin</label>
            <textarea value={reason} onChange={e => { setReason(e.target.value); setTmplIdx('') }}
              rows={5} placeholder="Describe your reason for leave..."
              className="input-base resize-none text-sm leading-relaxed" required />
            <p className="text-xs text-gray-600 text-right">{reason.length} chars</p>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={submitting} className="flex-1">
              Submit Request
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function RequestCard({ req }) {
  const type = LEAVE_TYPES.find(t => t.value === req.type) || LEAVE_TYPES[0]
  const c    = LEAVE_COLORS[type.value]
  const st   = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
  const start = format(parseISO(req.start_date), 'd MMM')
  const end   = format(parseISO(req.end_date),   'd MMM yyyy')
  const same  = req.start_date === req.end_date

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center text-xl shrink-0`}>
              {type.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-100">{type.label}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                {same ? start : `${start} – ${end}`} &nbsp;·&nbsp; {req.days} day{req.days !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
        </div>
        {req.reason && (
          <p className="text-xs text-gray-500 mt-3 leading-relaxed line-clamp-2 pl-[52px] italic">
            "{req.reason}"
          </p>
        )}
        {req.admin_note && (
          <p className="text-xs text-gray-500 mt-1 pl-[52px]">
            <span className="text-gray-600">Admin: </span>{req.admin_note}
          </p>
        )}
        <p className="text-xs text-gray-600 mt-2 pl-[52px]">
          Applied {format(parseISO(req.created_at), 'dd MMM yyyy')}
        </p>
      </Card>
    </motion.div>
  )
}

function LeaveInner() {
  const toast = useToast()
  const user  = useStore(s => s.user)
  const [balance,  setBalance ] = useState({ sick: 0, casual: 0, planned: 0, emergency: 0 })
  const [requests, setRequests] = useState([])
  const [holidays, setHolidays] = useState([])
  const [quotas,   setQuotas  ] = useState({})
  const [applying, setApplying] = useState(false)
  const [filter,   setFilter  ] = useState('all')

  const load = useCallback(async () => {
    if (!user) return
    try {
      const year = new Date().getFullYear()
      const [bal, reqs, hols, s] = await Promise.all([
        getLeaveBalance(user.id, year),
        getMyLeaves(user.id, year),
        getHolidays(),
        getSettings(),
      ])
      setBalance(bal); setRequests(reqs); setHolidays(hols)
      setQuotas({
        leave_sick_quota:    parseInt(s.leave_sick_quota    || '10'),
        leave_casual_quota:  parseInt(s.leave_casual_quota  || '12'),
        leave_planned_quota: parseInt(s.leave_planned_quota || '5'),
      })
    } catch (e) {
      toast(`Could not load leaves: ${e.message}`, 'error')
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pending  = requests.filter(r => r.status === 'pending').length

  return (
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-100">My Leaves</h1>
              <p className="text-sm text-gray-400 mt-0.5">{new Date().getFullYear()} · Annual leave tracker</p>
            </div>
            <Button onClick={() => setApplying(true)} className="gap-2">
              <Plus size={15} /> Apply for Leave
            </Button>
          </div>

          {/* Balance cards */}
          <div className="grid grid-cols-4 gap-3">
            {LEAVE_TYPES.map(t => (
              <BalanceCard key={t.value} type={t}
                used={balance[t.value] || 0}
                quota={t.quotaKey ? quotas[t.quotaKey] : null} />
            ))}
          </div>

          {/* Requests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300">
                My Requests
                {pending > 0 && <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{pending} pending</span>}
              </h2>
              <div className="flex gap-1">
                {['all','pending','approved','rejected'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors capitalize font-medium
                      ${filter === f ? 'bg-accent-500/20 text-accent-400' : 'text-gray-500 hover:text-gray-300'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <Card className="p-10 text-center">
                <p className="text-4xl mb-3">🏖️</p>
                <p className="text-sm font-medium text-gray-300">No leave requests yet</p>
                <p className="text-xs text-gray-500 mt-1">Click "Apply for Leave" to submit your first request</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(r => <RequestCard key={r.id} req={r} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {applying && (
          <ApplyModal user={user} holidays={holidays} quotas={quotas}
            onClose={() => setApplying(false)}
            onSuccess={() => { setApplying(false); load() }} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Leave() {
  return <Page><ToastProvider><LeaveInner /></ToastProvider></Page>
}
