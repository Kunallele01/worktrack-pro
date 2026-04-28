import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, ArrowRightFromLine, Users, Home, Clock, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { getTodayAttendance, getMonthSummary, getMonthHistory, checkIn, checkOut, getSettings, getHolidays } from '../lib/supabase'
import { useStore } from '../lib/store'
import Sidebar from '../components/Sidebar'
import { Page, GpsWidget, StatCard, CalendarWidget, Button, Badge, Card } from '../components/ui'
import { ToastProvider, useToast } from '../components/ui'

function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const h = String(now.getHours()).padStart(2,'0')
  const m = String(now.getMinutes()).padStart(2,'0')
  const s = String(now.getSeconds()).padStart(2,'0')
  return (
    <div className="text-center py-6">
      <div className="font-mono font-bold text-gray-100 leading-none tabular-nums" style={{ fontSize: 56, letterSpacing: '-3px' }}>
        {h}<span className="text-gray-400 mx-1 animate-pulse">:</span>{m}
        <span className="font-mono font-light text-gray-400 ml-2" style={{ fontSize: 28 }}>:{s}</span>
      </div>
      <p className="text-gray-400 text-sm mt-2">{format(now, 'EEEE, d MMMM yyyy')}</p>
    </div>
  )
}

function TodayStatus({ record }) {
  if (!record?.check_in_time) {
    return <p className="text-gray-500 text-sm">Not checked in yet today.</p>
  }
  const fmt = (iso) => {
    try { return format(new Date(iso), 'hh:mm a') } catch { return '—' }
  }
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Badge status={record.status} />
      {record.is_late && <Badge status="late" />}
      <span className="text-sm text-gray-400 font-mono">In: {fmt(record.check_in_time)}</span>
      {record.check_out_time && (
        <span className="text-sm text-gray-400 font-mono">Out: {fmt(record.check_out_time)}</span>
      )}
    </div>
  )
}

function DashboardInner() {
  const toast    = useToast()
  const user     = useStore(s => s.user)
  const gpsLocation = useStore(s => s.gpsLocation)
  const gpsStatus   = useStore(s => s.gpsStatus)
  const setGps   = useStore(s => s.setGps)

  const [today,    setToday   ] = useState(null)
  const [summary,  setSummary ] = useState({})
  const [history,  setHistory ] = useState([])
  const [holidays, setHolidays] = useState([])
  const [checking, setChecking] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    const now = new Date()
    const [t, s, h, hols] = await Promise.all([
      getTodayAttendance(user.id),
      getMonthSummary(user.id, now.getFullYear(), now.getMonth() + 1),
      getMonthHistory(user.id, now.getFullYear(), now.getMonth() + 1),
      getHolidays(),
    ])
    setToday(t); setSummary(s); setHistory(h); setHolidays(hols)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  async function handleCheckIn() {
    if (!gpsLocation) { toast('GPS not ready. Please wait.', 'warning'); return }
    setChecking(true)
    try {
      const rec = await checkIn(user.id, gpsLocation.lat, gpsLocation.lon, gpsLocation.accuracy)
      setToday(rec)
      toast(`Checked in as ${rec.status === 'in_office' ? 'In Office' : 'WFH'}!`, 'success')
      loadData()
    } catch (e) { toast(e.message, 'error') }
    finally { setChecking(false) }
  }

  async function handleCheckOut() {
    setChecking(true)
    try {
      const rec = await checkOut(user.id)
      setToday(rec)
      toast('Checked out successfully!', 'success')
    } catch (e) { toast(e.message, 'error') }
    finally { setChecking(false) }
  }

  const checkedIn  = Boolean(today?.check_in_time)
  const checkedOut = Boolean(today?.check_out_time)
  const canCheckIn  = gpsStatus === 'active' && !checkedIn
  const canCheckOut = checkedIn && !checkedOut

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] || ''

  return (
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex overflow-hidden">
        {/* Left column */}
        <div className="w-80 shrink-0 flex flex-col border-r border-white/[0.06] overflow-y-auto p-5 gap-5">
          <div>
            <h2 className="text-xl font-bold text-gray-100">{greeting}, {firstName} 👋</h2>
            <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Users}     value={summary.present ?? '—'} label="Present"   accentColor="success" />
            <StatCard icon={Home}      value={summary.wfh     ?? '—'} label="WFH"       accentColor="info" />
            <StatCard icon={Clock}     value={summary.late    ?? '—'} label="Late"      accentColor="warning" />
            <StatCard icon={AlertTriangle} value={summary.absent ?? '—'} label="Absent" accentColor="danger" />
          </div>

          <Card className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">This Month</p>
            <CalendarWidget attendance={history} holidays={holidays} />
          </Card>
        </div>

        {/* Right column */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <LiveClock />

          {/* GPS Widget */}
          <GpsWidget onReady={(lat, lon, acc) => setGps({ lat, lon, accuracy: acc })} />

          {/* Check-in / Check-out */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div whileTap={{ scale: 0.98 }}>
              <button
                onClick={handleCheckIn}
                disabled={!canCheckIn || checking}
                className={`w-full flex flex-col items-center justify-center gap-2 h-24 rounded-2xl font-semibold text-sm border transition-all
                  ${canCheckIn
                    ? 'bg-accent-500/10 border-accent-500/30 text-accent-300 hover:bg-accent-500/20 hover:border-accent-500/50 cursor-pointer'
                    : 'bg-white/[0.02] border-white/[0.05] text-gray-600 cursor-not-allowed'
                  }`}
              >
                <CheckCircle size={22} />
                {checking && !checkedIn ? 'Checking in…' : 'Mark Check-In'}
              </button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.98 }}>
              <button
                onClick={handleCheckOut}
                disabled={!canCheckOut || checking}
                className={`w-full flex flex-col items-center justify-center gap-2 h-24 rounded-2xl font-semibold text-sm border transition-all
                  ${canCheckOut
                    ? 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20 cursor-pointer'
                    : 'bg-white/[0.02] border-white/[0.05] text-gray-600 cursor-not-allowed'
                  }`}
              >
                <ArrowRightFromLine size={22} />
                {checking && checkedIn && !checkedOut ? 'Checking out…' : 'Mark Check-Out'}
              </button>
            </motion.div>
          </div>

          {/* Today status */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Today's Status</p>
            <TodayStatus record={today} />
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return <Page><ToastProvider><DashboardInner /></ToastProvider></Page>
}
