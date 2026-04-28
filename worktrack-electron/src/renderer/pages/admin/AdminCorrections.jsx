import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { getAllCorrections, reviewCorrection } from '../../lib/supabase'
import { useStore } from '../../lib/store'
import { Card, Button, Avatar } from '../../components/ui'
import { useToast } from '../../components/ui'

const CORR_TYPES = {
  forgot_checkin:  { label: 'Forgot Check-in',        icon: '🔑' },
  forgot_checkout: { label: 'Forgot Check-out',        icon: '🚪' },
  wrong_status:    { label: 'Wrong Status (WFH→Office)',icon: '📍' },
  other:           { label: 'Other Correction',         icon: '✏️' },
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
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-bold text-gray-100 mb-1">Review Correction</h3>
        <p className="text-xs text-gray-400 mb-4">{ct.icon} {ct.label} · {req.date}</p>

        {req.requested_checkin && (
          <div className="text-xs text-gray-300 mb-1">Requested check-in: <span className="font-mono text-accent-400">{req.requested_checkin}</span></div>
        )}
        {req.requested_checkout && (
          <div className="text-xs text-gray-300 mb-1">Requested check-out: <span className="font-mono text-accent-400">{req.requested_checkout}</span></div>
        )}
        {req.requested_status && (
          <div className="text-xs text-gray-300 mb-3">Requested status: <span className="font-mono text-emerald-400">{req.requested_status}</span></div>
        )}

        <div className="bg-white/[0.04] rounded-xl p-3.5 mb-4 border border-white/[0.06]">
          <p className="text-xs text-gray-300 leading-relaxed italic">"{req.reason}"</p>
        </div>

        <div className="flex flex-col gap-1.5 mb-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Note (optional)</label>
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
          <Card className="p-10 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-sm text-gray-400">No {tab} correction requests</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map(r => {
              const ct = CORR_TYPES[r.type] || CORR_TYPES.other
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="p-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={r.profiles?.full_name || ''} size={9} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-bold text-gray-100">{r.profiles?.full_name}</p>
                          <span className="text-xs bg-white/[0.06] text-gray-300 px-2 py-0.5 rounded-full">{ct.icon} {ct.label}</span>
                          <span className="text-xs font-mono text-gray-400">{r.date}</span>
                          {r.status !== 'pending' && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                              ${r.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                              {r.status === 'approved' ? '✓ Applied' : '✕ Rejected'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 italic mb-2">"{r.reason}"</p>
                        {r.status === 'pending' && (
                          <Button onClick={() => setReviewing(r)} className="text-xs h-7 px-3">Review</Button>
                        )}
                        {r.admin_note && <p className="text-xs text-gray-500 mt-1">Note: {r.admin_note}</p>}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
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
