import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { LogIn, LogOut, ArrowLeftRight } from 'lucide-react'
import { submitCorrection, getMyCorrections, getMonthHistory } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Card, Button, Select, EmptyState } from '../components/ui'
import { useToast } from '../components/ui'

const CORR_TYPES = [
  { value: 'forgot_checkin',  label: '🔑 Forgot to check in',        fields: ['checkin', 'status'] },
  { value: 'forgot_checkout', label: '🚪 Forgot to check out',       fields: ['checkout'] },
  { value: 'wrong_status',    label: '📍 Wrong status (WFH → Office)', fields: ['status'] },
  { value: 'other',           label: '✏️ Other correction',           fields: [] },
]

const CORR_META = {
  forgot_checkin:  { icon: '🔑', color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   accentBorder: 'border-l-blue-500'   },
  forgot_checkout: { icon: '🚪', color: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/30', accentBorder: 'border-l-violet-500' },
  wrong_status:    { icon: '📍', color: 'text-amber-400',  bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  accentBorder: 'border-l-amber-500'  },
  other:           { icon: '✏️', color: 'text-gray-400',   bg: 'bg-white/[0.06]',  border: 'border-white/10',      accentBorder: 'border-l-gray-500'   },
}

const STATUS_ACCENT = {
  pending:  { border: 'border-l-amber-500',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   label: '⏳ Pending Review' },
  approved: { border: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: '✓ Applied'       },
  rejected: { border: 'border-l-red-500',     badge: 'bg-red-500/15 text-red-400 border-red-500/30',         label: '✕ Rejected'      },
}

function fmtTime(iso) {
  if (!iso) return null
  try { return format(parseISO(iso), 'hh:mm a') } catch { return null }
}

const STATUS_OPTIONS = [
  { value: '', label: 'No change' },
  { value: 'in_office', label: 'In Office' },
  { value: 'wfh',       label: 'WFH' },
]

function CorrectionForm({ user, history, onSuccess }) {
  const toast = useToast()
  const [date,    setDate   ] = useState('')
  const [type,    setType   ] = useState('forgot_checkin')
  const [checkin, setCheckin] = useState('')
  const [checkout,setCheckout] = useState('')
  const [status,  setStatus ] = useState('')
  const [reason,  setReason ] = useState('')
  const [busy,    setBusy   ] = useState(false)

  const ct = CORR_TYPES.find(c => c.value === type) || CORR_TYPES[0]

  const dateOptsFull = (() => {
    const histMap  = Object.fromEntries(history.map(r => [r.date, r.status]))
    const now2     = new Date()
    const todayStr = now2.toLocaleDateString('sv-SE')
    const yr       = now2.getFullYear()
    const mo       = now2.getMonth() + 1
    const dim      = new Date(yr, mo, 0).getDate()
    const STATUS_LABEL = { in_office: 'In Office', wfh: 'WFH', absent: 'Absent', auto_checkout: 'Auto-out' }
    const opts = [{ value: '', label: 'Select a date…' }]
    for (let d = 1; d <= dim; d++) {
      const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      if (dateStr > todayStr) break
      const dow = new Date(yr, mo - 1, d).getDay()
      if (dow === 0 || dow === 6) continue
      const st = histMap[dateStr]
      opts.push({ value: dateStr, label: `${dateStr} — ${STATUS_LABEL[st] || (st ? st : 'No record')}` })
    }
    return opts
  })()

  const submit = async (e) => {
    e.preventDefault()
    if (!date)         { toast('Select a date.', 'warning');   return }
    if (!reason.trim()){ toast('Add a reason.', 'warning');    return }
    setBusy(true)
    try {
      const ci  = checkin  ? new Date(`${date}T${checkin}:00`).toISOString()  : null
      const co  = checkout ? new Date(`${date}T${checkout}:00`).toISOString() : null
      await submitCorrection(user.id, { date, type, requestedCheckin: ci, requestedCheckout: co, requestedStatus: status || null, reason: reason.trim() })
      toast('Correction request submitted!', 'success')
      setDate(''); setCheckin(''); setCheckout(''); setStatus(''); setReason('')
      onSuccess()
    } catch (e) { toast(e.message, 'error') }
    finally { setBusy(false) }
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold text-gray-100 mb-4">Submit a Correction Request</h2>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</label>
            <Select value={date} onChange={setDate} options={dateOptsFull} placeholder="Select date…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Issue Type</label>
            <Select value={type} onChange={setType} options={CORR_TYPES.map(c => ({ value: c.value, label: c.label }))} />
          </div>
        </div>

        {ct.fields.includes('checkin') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Actual Check-in Time</label>
            <input type="time" value={checkin} onChange={e => setCheckin(e.target.value)} className="input-base py-2.5 text-sm" />
          </div>
        )}
        {ct.fields.includes('checkout') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Actual Check-out Time</label>
            <input type="time" value={checkout} onChange={e => setCheckout(e.target.value)} className="input-base py-2.5 text-sm" />
          </div>
        )}
        {ct.fields.includes('status') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Correct Status</label>
            <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reason / Explanation</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="Briefly explain what happened and why the correction is needed…"
            className="input-base resize-none text-sm" required />
        </div>

        <Button type="submit" loading={busy} className="w-fit">Submit Request</Button>
      </form>
    </Card>
  )
}

function MyRequests({ requests }) {
  if (!requests.length) return (
    <Card>
      <EmptyState emoji="✍️" title="No correction requests yet"
        subtitle="Submit a correction above if you notice a wrong or missed check-in." />
    </Card>
  )
  return (
    <div className="flex flex-col gap-3">
      {requests.map(r => {
        const ct  = CORR_TYPES.find(c => c.value === r.type) || CORR_TYPES[3]
        const cm  = CORR_META[r.type] || CORR_META.other
        const sa  = STATUS_ACCENT[r.status] || STATUS_ACCENT.pending
        return (
          <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={`p-4 border-l-4 ${sa.border}`}>
              <div className="flex items-start gap-3">
                {/* Type icon */}
                <div className={`w-9 h-9 rounded-xl ${cm.bg} border ${cm.border} flex items-center justify-center text-base shrink-0`}>
                  {cm.icon}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Type label + date + status */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <p className={`text-xs font-bold ${cm.color}`}>{ct.label.replace(/^.+ /, '')}</p>
                    <span className="text-xs font-mono text-gray-500">{r.date}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto ${sa.badge}`}>{sa.label}</span>
                  </div>

                  {/* Requested changes pills */}
                  {(r.requested_checkin || r.requested_checkout || r.requested_status) && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {r.requested_checkin && (
                        <div className="flex items-center gap-1 text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                          <LogIn size={9} className="text-emerald-400" />
                          <span className="text-emerald-400 font-mono font-semibold">{fmtTime(r.requested_checkin)}</span>
                        </div>
                      )}
                      {r.requested_checkout && (
                        <div className="flex items-center gap-1 text-[10px] bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                          <LogOut size={9} className="text-blue-400" />
                          <span className="text-blue-400 font-mono font-semibold">{fmtTime(r.requested_checkout)}</span>
                        </div>
                      )}
                      {r.requested_status && (
                        <div className="flex items-center gap-1 text-[10px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                          <ArrowLeftRight size={9} className="text-amber-400" />
                          <span className="text-amber-400 font-semibold">{r.requested_status === 'in_office' ? 'In Office' : 'WFH'}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reason */}
                  <p className="text-xs text-gray-400 leading-relaxed italic line-clamp-2">"{r.reason}"</p>

                  {/* Admin note */}
                  {r.admin_note && (
                    <p className="text-xs text-gray-500 mt-1.5 px-2.5 py-1.5 bg-white/[0.03] rounded-lg border border-white/[0.05]">
                      <span className="text-gray-600">Admin note: </span>{r.admin_note}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

function CorrectionsInner() {
  const user      = useStore(s => s.user)
  const setBadges = useStore(s => s.setBadges)
  const [history,  setHistory ] = useState([])
  const [requests, setRequests] = useState([])

  // Mark corrections as seen — clears the sidebar badge
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`wt-corrections-seen-${user.id}`, new Date().toISOString())
      setBadges({ corrections: 0 })
    }
  }, [user?.id])

  const load = useCallback(async () => {
    if (!user) return
    const now = new Date()
    const [h, r] = await Promise.all([
      getMonthHistory(user.id, now.getFullYear(), now.getMonth() + 1),
      getMyCorrections(user.id),
    ])
    setHistory(h); setRequests(r)
  }, [user])

  useEffect(() => { load() }, [load])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-xl mx-auto flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Attendance Corrections</h1>
          <p className="text-sm text-gray-400 mt-0.5">Request a fix for a wrong or missed check-in</p>
        </div>
        <CorrectionForm user={user} history={history} onSuccess={load} />
        <div>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">My Requests</h2>
          <MyRequests requests={requests} />
        </div>
      </div>
    </div>
  )
}

export default function Corrections() {
  return <CorrectionsInner />
}
