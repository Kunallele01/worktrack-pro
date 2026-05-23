import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { CheckCircle, XCircle, Clock, LogIn, LogOut, ArrowLeftRight } from 'lucide-react'
import { getAllCorrections, reviewCorrection } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { Card, Button, Avatar, EmptyState } from '../../components/ui'
import { useToast } from '../../components/ui'

const CORR_TYPES = {
  forgot_checkin:  { label: 'Forgot Check-in',          icon: '🔑', color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   accent: 'border-l-blue-500'   },
  forgot_checkout: { label: 'Forgot Check-out',          icon: '🚪', color: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/30', accent: 'border-l-violet-500' },
  wrong_status:    { label: 'Wrong Status',              icon: '📍', color: 'text-amber-400',  bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  accent: 'border-l-amber-500'  },
  other:           { label: 'Other Correction',          icon: '✏️', color: 'text-gray-400',   bg: 'bg-white/[0.06]',  border: 'border-white/10',      accent: 'border-l-gray-500'   },
}

const STATUS_LABELS = { in_office: 'In Office', wfh: 'Work From Home', auto_checkout: 'Auto Checkout' }

function fmtTime(iso) {
  if (!iso) return null
  try { return format(parseISO(iso), 'hh:mm a') } catch { return null }
}
function fmtDate(iso) {
  if (!iso) return null
  try { return format(parseISO(iso), 'dd MMM yyyy') } catch { return iso }
}

function ReviewModal({ req, onClose, onDone }) {
  const toast = useToast()
  const user  = useStore(s => s.user)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const ct = CORR_TYPES[req.type] || CORR_TYPES.other

  const handle = async (approved) => {
    setBusy(true)
    try {
      await reviewCorrection(req.id, user.id, approved, note)
      toast(approved ? 'Correction applied!' : 'Request rejected.', approved ? 'success' : 'info')
      onDone()
    } catch (e) { toast(e.message, 'error') }
    finally { setBusy(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">

        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl ${ct.bg} border ${ct.border} flex items-center justify-center text-xl`}>
            {ct.icon}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-100">{req.profiles?.full_name}</p>
            <p className="text-xs text-gray-400">{ct.label} · {req.date}{req.profiles?.department ? ` · ${req.profiles.department}` : ''}</p>
          </div>
        </div>

        {(req.requested_checkin || req.requested_checkout || req.requested_status) && (
          <div className="bg-white/[0.04] rounded-xl p-3.5 mb-4 border border-white/[0.06] flex flex-col gap-2">
            {req.requested_checkin && (
              <div className="flex items-center gap-2 text-xs">
                <LogIn size={12} className="text-emerald-400 shrink-0" />
                <span className="text-gray-400">Check-in</span>
                <span className="text-emerald-400 font-semibold font-mono ml-auto">{fmtTime(req.requested_checkin)}</span>
              </div>
            )}
            {req.requested_checkout && (
              <div className="flex items-center gap-2 text-xs">
                <LogOut size={12} className="text-blue-400 shrink-0" />
                <span className="text-gray-400">Check-out</span>
                <span className="text-blue-400 font-semibold font-mono ml-auto">{fmtTime(req.requested_checkout)}</span>
              </div>
            )}
            {req.requested_status && (
              <div className="flex items-center gap-2 text-xs">
                <ArrowLeftRight size={12} className="text-amber-400 shrink-0" />
                <span className="text-gray-400">Status</span>
                <span className="text-amber-400 font-semibold ml-auto">{STATUS_LABELS[req.requested_status] || req.requested_status}</span>
              </div>
            )}
          </div>
        )}

        <div className="bg-white/[0.04] rounded-xl p-3.5 mb-4 border border-white/[0.06]">
          <p className="text-xs text-gray-300 leading-relaxed italic">"{req.reason}"</p>
        </div>

        <div className="flex flex-col gap-1.5 mb-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Note to Employee <span className="text-gray-600 font-normal normal-case">(optional)</span></label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            className="input-base resize-none text-sm" placeholder="Optional note to employee…" />
        </div>

        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={onClose} className="flex-1 text-sm">Cancel</Button>
          <Button variant="danger" onClick={() => handle(false)} loading={busy} className="flex-1 text-sm gap-1.5">
            <XCircle size={14} /> Reject
          </Button>
          <Button onClick={() => handle(true)} loading={busy} className="flex-1 text-sm gap-1.5">
            <CheckCircle size={14} /> Apply
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function PendingCard({ r, onReview }) {
  const ct       = CORR_TYPES[r.type] || CORR_TYPES.other
  const daysAgo  = differenceInCalendarDays(new Date(), new Date(r.created_at))
  const urgency  = daysAgo >= 3 ? 'overdue' : daysAgo >= 1 ? 'waiting' : null
  const urgencyChip = urgency === 'overdue'
    ? { label: `${daysAgo}d old — urgent`, cls: 'bg-red-500/15 text-red-400 border-red-500/30' }
    : urgency === 'waiting'
    ? { label: `${daysAgo}d ago`, cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' }
    : null

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`p-5 border-l-4 ${ct.accent}`}>
        <div className="flex items-start gap-4">
          <Avatar name={r.profiles?.full_name || ''} size={10} />
          <div className="flex-1 min-w-0">

            {/* Name row */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <p className="text-sm font-bold text-gray-100">{r.profiles?.full_name}</p>
              <span className="text-xs font-mono text-gray-500">{r.profiles?.employee_id}</span>
              {r.profiles?.department && <span className="text-xs text-gray-500">· {r.profiles.department}</span>}
              {urgencyChip && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${urgencyChip.cls}`}>{urgencyChip.label}</span>
              )}
            </div>

            {/* Type + date row */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ct.bg} ${ct.border} ${ct.color}`}>
                {ct.icon} {ct.label}
              </span>
              <span className="text-xs font-semibold text-gray-300 font-mono">{r.date}</span>
            </div>

            {/* Requested changes inline */}
            {(r.requested_checkin || r.requested_checkout || r.requested_status) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {r.requested_checkin && (
                  <div className="flex items-center gap-1.5 text-xs bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    <LogIn size={10} className="text-emerald-400" />
                    <span className="text-gray-400">In</span>
                    <span className="text-emerald-400 font-mono font-semibold">{fmtTime(r.requested_checkin)}</span>
                  </div>
                )}
                {r.requested_checkout && (
                  <div className="flex items-center gap-1.5 text-xs bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                    <LogOut size={10} className="text-blue-400" />
                    <span className="text-gray-400">Out</span>
                    <span className="text-blue-400 font-mono font-semibold">{fmtTime(r.requested_checkout)}</span>
                  </div>
                )}
                {r.requested_status && (
                  <div className="flex items-center gap-1.5 text-xs bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    <ArrowLeftRight size={10} className="text-amber-400" />
                    <span className="text-amber-400 font-semibold">{STATUS_LABELS[r.requested_status] || r.requested_status}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reason */}
            <div className="bg-white/[0.03] rounded-xl px-3.5 py-2.5 mb-3 border border-white/[0.05]">
              <p className="text-xs text-gray-300 leading-relaxed italic line-clamp-2">"{r.reason}"</p>
            </div>

            <div className="flex items-center justify-between">
              <Button onClick={() => onReview(r)} className="gap-1.5 text-xs h-8 px-4">
                Review Request
              </Button>
              <p className="text-xs text-gray-600">Submitted {fmtDate(r.created_at)}</p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function HistoryCard({ r }) {
  const ct      = CORR_TYPES[r.type] || CORR_TYPES.other
  const approved = r.status === 'approved'
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar name={r.profiles?.full_name || ''} size={8} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-200">{r.profiles?.full_name}</p>
            {r.profiles?.department && <span className="text-xs text-gray-500">{r.profiles.department}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${ct.bg} ${ct.border} ${ct.color}`}>{ct.icon} {ct.label}</span>
            <span className="text-xs text-gray-500 font-mono">{r.date}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
              ${approved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {approved ? '✓ Applied' : '✕ Rejected'}
            </span>
          </div>
          {r.admin_note && <p className="text-xs text-gray-500 mt-1 italic">Note: "{r.admin_note}"</p>}
        </div>
      </div>
    </Card>
  )
}

export default function AdminCorrections() {
  const toast = useToast()
  const [all,       setAll      ] = useState([])
  const [reviewing, setReviewing] = useState(null)
  const [tab,       setTab      ] = useState('pending')
  const [loading,   setLoading  ] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setAll(await getAllCorrections()) }
    catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const pending  = all.filter(r => r.status === 'pending')
  const reviewed = all.filter(r => r.status !== 'pending')
  const shown    = tab === 'pending' ? pending : reviewed

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Correction Requests</h1>
          <p className="text-sm text-gray-400 mt-0.5">Attendance fix & regularization requests</p>
        </div>
        <Button variant="secondary" onClick={load} loading={loading} className="text-sm">Refresh</Button>
      </div>

      <div className="flex gap-2">
        {[['pending','Pending', pending.length], ['reviewed','History', reviewed.length]].map(([v,l,n]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors
              ${tab === v ? 'bg-accent-500/20 text-accent-400' : 'text-gray-400 hover:text-gray-200'}`}>
            {v === 'pending' && <Clock size={14} />}
            {l}
            {n > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab===v&&v==='pending'?'bg-accent-500 text-white':'bg-white/10 text-gray-400'}`}>{n}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <Card>
            {tab === 'pending'
              ? <EmptyState emoji="🎯" title="No pending corrections" subtitle="All attendance correction requests have been reviewed. Great work!" />
              : <EmptyState emoji="📁" title="No history yet" subtitle="Reviewed correction requests will show up here over time." />
            }
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map(r => tab === 'pending'
              ? <PendingCard key={r.id} r={r} onReview={setReviewing} />
              : <HistoryCard key={r.id} r={r} />
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {reviewing && (
          <ReviewModal req={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); load() }} />
        )}
      </AnimatePresence>
    </div>
  )
}
