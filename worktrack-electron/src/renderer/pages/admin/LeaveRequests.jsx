import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { getAllLeaveRequests, reviewLeave } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { Card, Button, Avatar } from '../../components/ui'
import { useToast } from '../../components/ui'
import { LEAVE_TYPES, LEAVE_COLORS } from '../Leave'

const STATUS_BADGE = {
  pending:  'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border border-red-500/30',
}

function ReviewModal({ req, onClose, onDone }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const type = LEAVE_TYPES.find(t => t.value === req.type) || LEAVE_TYPES[0]
  const c    = LEAVE_COLORS[type.color]

  const handle = async (approved) => {
    setBusy(true)
    try {
      await reviewLeave(req.id, req._reviewerId, approved, note)
      toast(approved ? 'Leave approved! Email sent to employee.' : 'Leave rejected.', approved ? 'success' : 'info')
      onDone()
    } catch (e) { toast(e.message, 'error') }
    finally { setBusy(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">

        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center text-xl`}>
            {type.icon}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-100">{req.profiles?.full_name}</p>
            <p className="text-xs text-gray-400">{type.label} · {req.days} day{req.days !== 1 ? 's' : ''} · {format(parseISO(req.start_date), 'd MMM')}
              {req.start_date !== req.end_date ? ` – ${format(parseISO(req.end_date), 'd MMM yyyy')}` : ' ' + format(parseISO(req.start_date), 'yyyy')}
            </p>
          </div>
        </div>

        <div className="bg-white/[0.04] rounded-xl p-3.5 mb-4 border border-white/[0.06]">
          <p className="text-xs text-gray-300 leading-relaxed italic">"{req.reason}"</p>
        </div>

        <div className="flex flex-col gap-1.5 mb-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Note to Employee <span className="text-gray-600 font-normal normal-case">(optional)</span>
          </label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="e.g. Approved — enjoy your time off!"
            className="input-base resize-none text-sm" />
        </div>

        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={onClose} className="flex-1 text-sm">Cancel</Button>
          <Button variant="danger" onClick={() => handle(false)} loading={busy} className="flex-1 text-sm gap-1.5">
            <XCircle size={14} /> Reject
          </Button>
          <Button onClick={() => handle(true)} loading={busy} className="flex-1 text-sm gap-1.5">
            <CheckCircle size={14} /> Approve
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function PendingCard({ req, onReview }) {
  const type  = LEAVE_TYPES.find(t => t.value === req.type) || LEAVE_TYPES[0]
  const c     = LEAVE_COLORS[type.color]
  const start = format(parseISO(req.start_date), 'd MMM')
  const end   = format(parseISO(req.end_date),   'd MMM yyyy')

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`p-5 border-l-4 ${c.border.replace('border', 'border-l')}`}>
        <div className="flex items-start gap-4">
          <Avatar name={req.profiles?.full_name || ''} size={10} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-bold text-gray-100">{req.profiles?.full_name}</p>
              <span className="text-xs text-gray-500 font-mono">{req.profiles?.employee_id}</span>
              {req.profiles?.department && <span className="text-xs text-gray-500">· {req.profiles.department}</span>}
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>
                {type.icon} {type.label}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                {req.start_date === req.end_date ? start : `${start} – ${end}`}
              </span>
              <span className="text-xs font-semibold text-gray-300">
                {req.days} day{req.days !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="bg-white/[0.03] rounded-xl px-3.5 py-2.5 mb-3 border border-white/[0.05]">
              <p className="text-xs text-gray-300 leading-relaxed italic line-clamp-3">"{req.reason}"</p>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={() => onReview(req)} className="gap-1.5 text-xs h-8 px-4">
                Review Request
              </Button>
              <p className="text-xs text-gray-600">
                Applied {format(parseISO(req.created_at), 'dd MMM, hh:mm a')}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function HistoryCard({ req }) {
  const type     = LEAVE_TYPES.find(t => t.value === req.type) || LEAVE_TYPES[0]
  const c        = LEAVE_COLORS[type.color]
  const approved = req.status === 'approved'
  return (
    <Card className="p-4 opacity-80">
      <div className="flex items-center gap-3">
        <Avatar name={req.profiles?.full_name || ''} size={8} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-200">{req.profiles?.full_name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${c.badge}`}>{type.icon} {type.label}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
              ${approved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {approved ? '✓ Approved' : '✕ Rejected'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
            {format(parseISO(req.start_date), 'd MMM')}
            {req.start_date !== req.end_date ? ` – ${format(parseISO(req.end_date), 'd MMM yyyy')}` : ''} · {req.days}d
          </p>
          {req.admin_note && <p className="text-xs text-gray-500 mt-1 italic">"{req.admin_note}"</p>}
        </div>
      </div>
    </Card>
  )
}

export default function LeaveRequests() {
  const toast      = useToast()
  const user       = useStore(s => s.user)
  const [all,      setAll     ] = useState([])
  const [reviewing,setReviewing] = useState(null)
  const [tab,      setTab     ] = useState('pending')
  const [loading,  setLoading ] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setAll(await getAllLeaveRequests()) }
    catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const pending  = all.filter(r => r.status === 'pending')
  const reviewed = all.filter(r => r.status !== 'pending')

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Leave Requests</h1>
          <p className="text-sm text-gray-400 mt-0.5">Review and manage team leave</p>
        </div>
        <Button variant="secondary" onClick={load} loading={loading} className="text-sm">Refresh</Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {[['pending', 'Pending Review', pending.length], ['reviewed', 'History', reviewed.length]].map(([val, label, count]) => (
          <button key={val} onClick={() => setTab(val)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors
              ${tab === val ? 'bg-accent-500/20 text-accent-400' : 'text-gray-400 hover:text-gray-200'}`}>
            {val === 'pending' && <Clock size={14} />}
            {label}
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                ${tab === val && val === 'pending' ? 'bg-accent-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {(tab === 'pending' ? pending : reviewed).length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-4xl mb-3">{tab === 'pending' ? '✅' : '📋'}</p>
            <p className="text-sm text-gray-400">{tab === 'pending' ? 'No pending requests' : 'No reviewed requests yet'}</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {tab === 'pending'
              ? pending.map(r => <PendingCard key={r.id} req={{ ...r, _reviewerId: user?.id }} onReview={setReviewing} />)
              : reviewed.map(r => <HistoryCard key={r.id} req={r} />)
            }
          </div>
        )}
      </div>

      <AnimatePresence>
        {reviewing && (
          <ReviewModal req={{ ...reviewing, _reviewerId: user?.id }}
            onClose={() => setReviewing(null)}
            onDone={() => { setReviewing(null); load() }} />
        )}
      </AnimatePresence>
    </div>
  )
}
