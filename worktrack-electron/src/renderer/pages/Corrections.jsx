import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { submitCorrection, getMyCorrections, getMonthHistory } from '../lib/supabase'
import { useStore } from '../lib/store'
import Sidebar from '../components/Sidebar'
import { Page, Card, Button, Select, EmptyState } from '../components/ui'
import { ToastProvider, useToast } from '../components/ui'

const CORR_TYPES = [
  { value: 'forgot_checkin',  label: '🔑 Forgot to check in',        fields: ['checkin', 'status'] },
  { value: 'forgot_checkout', label: '🚪 Forgot to check out',       fields: ['checkout'] },
  { value: 'wrong_status',    label: '📍 Wrong status (WFH → Office)', fields: ['status'] },
  { value: 'other',           label: '✏️ Other correction',           fields: [] },
]

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

  const ct        = CORR_TYPES.find(c => c.value === type) || CORR_TYPES[0]
  const dateOpts  = history.map(r => ({ value: r.date, label: `${r.date} — ${r.status || '—'}` }))
  const dateOptsFull = [{ value: '', label: 'Select a date…' }, ...dateOpts]

  const submit = async (e) => {
    e.preventDefault()
    if (!date)         { toast('Select a date.', 'warning');   return }
    if (!reason.trim()){ toast('Add a reason.', 'warning');    return }
    setBusy(true)
    try {
      const istOffset = 5.5 * 60 * 60 * 1000
      const ci  = checkin  ? new Date(new Date(`${date}T${checkin}:00`).getTime()  - istOffset).toISOString() : null
      const co  = checkout ? new Date(new Date(`${date}T${checkout}:00`).getTime() - istOffset).toISOString() : null
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
  const STATUS = { pending: 'text-amber-400', approved: 'text-emerald-400', rejected: 'text-red-400' }
  if (!requests.length) return (
    <Card>
      <EmptyState emoji="✍️" title="No correction requests yet"
        subtitle="Submit a correction above if you notice a wrong or missed check-in." />
    </Card>
  )
  return (
    <div className="flex flex-col gap-3">
      {requests.map(r => {
        const ct = CORR_TYPES.find(c => c.value === r.type) || CORR_TYPES[3]
        return (
          <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{ct.label}</span>
                    <span className="text-xs font-mono text-gray-500">{r.date}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 italic">"{r.reason}"</p>
                  {r.admin_note && <p className="text-xs text-gray-500 mt-0.5">Admin: {r.admin_note}</p>}
                </div>
                <span className={`text-xs font-semibold capitalize ${STATUS[r.status]}`}>{r.status}</span>
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
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
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
    </div>
  )
}

export default function Corrections() {
  return <Page><ToastProvider><CorrectionsInner /></ToastProvider></Page>
}
