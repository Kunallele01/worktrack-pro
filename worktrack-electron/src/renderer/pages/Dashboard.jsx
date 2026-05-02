import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, ArrowRightFromLine, Users, Home, Clock, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { getTodayAttendance, getMonthSummary, getMonthHistory, checkIn, checkOut, getSettings, getHolidays, getMyLeaves } from '../lib/supabase'
import { useStore } from '../lib/store'
import Sidebar from '../components/Sidebar'
import { Page, GpsWidget, StatCard, CalendarWidget, Button, Badge, Card } from '../components/ui'
import { ToastProvider, useToast } from '../components/ui'
import { BirthdayManager } from '../components/BirthdayEffects'

// ── WMO weather code → emoji + label ─────────────────────────────────────────
const WMO_MAP = [
  [0,  '☀️',  'Clear Sky'],
  [1,  '🌤️', 'Mainly Clear'],
  [2,  '⛅',  'Partly Cloudy'],
  [3,  '☁️',  'Overcast'],
  [45, '🌫️', 'Foggy'],
  [48, '🌫️', 'Freezing Fog'],
  [51, '🌦️', 'Light Drizzle'],
  [53, '🌦️', 'Drizzle'],
  [55, '🌧️', 'Heavy Drizzle'],
  [61, '🌧️', 'Light Rain'],
  [63, '🌧️', 'Rainy'],
  [65, '🌧️', 'Heavy Rain'],
  [71, '🌨️', 'Light Snow'],
  [73, '🌨️', 'Snowing'],
  [75, '❄️',  'Heavy Snow'],
  [77, '🌨️', 'Snow Grains'],
  [80, '🌦️', 'Rain Showers'],
  [81, '🌧️', 'Showers'],
  [82, '🌧️', 'Heavy Showers'],
  [85, '🌨️', 'Snow Showers'],
  [86, '❄️',  'Heavy Snow Showers'],
  [95, '⛈️', 'Thunderstorm'],
  [96, '⛈️', 'Thunderstorm + Hail'],
  [99, '⛈️', 'Severe Thunderstorm'],
]
function wmoInfo(code) {
  let best = WMO_MAP[0]
  for (const row of WMO_MAP) { if (row[0] <= code) best = row }
  return { icon: best[1], label: best[2] }
}

function WeatherWidget({ lat, lon }) {
  const [w, setW] = useState(null)

  useEffect(() => {
    if (!lat || !lon || (lat === 0 && lon === 0)) return
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`)
      .then(r => r.json())
      .then(d => {
        if (!d.current) return
        setW({
          temp:   Math.round(d.current.temperature_2m),
          feels:  Math.round(d.current.apparent_temperature),
          code:   d.current.weather_code,
        })
      })
      .catch(() => {})
  }, [lat, lon])

  if (!w) return null
  const { icon, label } = wmoInfo(w.code)

  return (
    <div className="flex items-center justify-center gap-3 mt-1">
      <div className="h-px w-12 bg-white/10" />
      <span style={{ fontSize: 28, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }}>{icon}</span>
      <div className="text-left">
        <p className="text-sm font-bold text-gray-200 leading-tight">
          {w.temp}°C
          <span className="font-normal text-gray-400 ml-1.5">{label}</span>
        </p>
        <p className="text-xs text-gray-600">Feels like {w.feels}°C</p>
      </div>
      <div className="h-px w-12 bg-white/10" />
    </div>
  )
}

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
  const toast       = useToast()
  const user        = useStore(s => s.user)
  const gpsLocation = useStore(s => s.gpsLocation)
  const gpsStatus   = useStore(s => s.gpsStatus)
  const setGps      = useStore(s => s.setGps)
  const settings    = useStore(s => s.settings)
  const setSettings = useStore(s => s.setSettings)

  const [today,    setToday   ] = useState(null)
  const [summary,  setSummary ] = useState({})
  const [history,  setHistory ] = useState([])
  const [holidays, setHolidays] = useState([])
  const [leaves,   setLeaves  ] = useState([])
  const [checking, setChecking] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    const now = new Date()
    const [t, s, h, hols, leavs, sett] = await Promise.all([
      getTodayAttendance(user.id),
      getMonthSummary(user.id, now.getFullYear(), now.getMonth() + 1),
      getMonthHistory(user.id, now.getFullYear(), now.getMonth() + 1),
      getHolidays(),
      getMyLeaves(user.id, now.getFullYear()),
      getSettings(),
    ])
    setToday(t); setSummary(s); setHistory(h); setHolidays(hols); setLeaves(leavs)
    if (sett) setSettings(sett)
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

  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] || ''

  // ── Motivational message — deterministic per user per day ──────────────────
  const MESSAGES = [
    "Consistency is the rarest superpower. You're building it right now.",
    "Every great record started with someone showing up today. That's you.",
    "The discipline to check in on time is the same discipline that builds careers.",
    "Small wins compound. Today's check-in is one of them.",
    "You don't need motivation to do great work. You need habits — and you have them.",
    "Progress is rarely loud. It mostly sounds like today — ordinary, consistent, powerful.",
    "Showing up is the first chapter. Make today a good one.",
    "Behind every great result is a long streak of unremarkable days, done well.",
    "Your future self will quietly thank you for what you do today.",
    "The team runs because everyone pulls. Today you're doing your part.",
    "Excellence isn't a singular act — it's what you do when no one's watching.",
    "You showed up. That already puts you ahead of the average.",
    "Good things take time. Great things take showing up every single day.",
    "The work you do today is the story you get to tell tomorrow.",
    "Discipline is choosing the right thing even when it's the harder thing.",
    "Another day, another opportunity to outperform yesterday's version of yourself.",
    "Reliability is the foundation of trust. You're building both, right now.",
    "Not every day feels epic. But every consistent day IS epic in hindsight.",
    "Greatness is ordinary effort, done with extraordinary consistency.",
    "You bring something to this team that no one else can. Today included.",
    "Hard work in silence lets the results do the talking.",
    "Focus on what you can control: full effort, today. Done.",
    "The best version of yourself showed up today. Own it.",
    "Results are just consistency that finally became visible.",
    "One more day of doing it right. That's how legends are made.",
    "Make today something worth putting on your record.",
    "The people who change industries mostly just never stopped showing up.",
    "This moment is part of a bigger story you're writing.",
    "Your work matters more than you realise. Today is proof.",
    "Behind every great career is a thousand unremarkable mornings, just like this one.",
  ]
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  const userHash  = (user?.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const todayMsg  = MESSAGES[(userHash + dayOfYear) % MESSAGES.length]

  // ── Streak — consecutive working days present (current month data) ─────────
  const presentDates = new Set(
    history.filter(r => ['in_office','wfh'].includes(r.status)).map(r => r.date)
  )
  let streak = 0
  const cur = new Date()
  // include today if already checked in, else start from yesterday
  if (!presentDates.has(cur.toLocaleDateString('sv-SE'))) cur.setDate(cur.getDate() - 1)
  for (let i = 0; i < 60; i++) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) {
      if (presentDates.has(cur.toLocaleDateString('sv-SE'))) streak++
      else break
    }
    cur.setDate(cur.getDate() - 1)
  }

  // ── Month progress ─────────────────────────────────────────────────────────
  const now = new Date()
  let totalWD = 0, passedWD = 0
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  for (let d = 1; d <= dim; d++) {
    const wd = new Date(now.getFullYear(), now.getMonth(), d).getDay()
    if (wd !== 0 && wd !== 6) { totalWD++; if (d <= now.getDate()) passedWD++ }
  }
  const monthPct = totalWD ? Math.round((passedWD / totalWD) * 100) : 0

  return (
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      <BirthdayManager user={user} />
      <Sidebar />
      <div className="flex-1 flex overflow-hidden">
        {/* Left column */}
        <div className="w-80 shrink-0 flex flex-col border-r border-white/[0.06] overflow-y-auto p-5 gap-5">

          {/* Greeting */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-100">{greeting}, {firstName} 👋</h2>
              {streak > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  🔥 {streak}d
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
            <p className="text-xs text-gray-500 italic mt-2 leading-relaxed border-l-2 border-accent-500/30 pl-2">
              {todayMsg}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Users}         value={summary.present ?? '—'} label="Present"   accentColor="success" />
            <StatCard icon={Home}          value={summary.wfh     ?? '—'} label="WFH"       accentColor="info" />
            <StatCard icon={Clock}         value={summary.late    ?? '—'} label="Late"      accentColor="warning" />
            <StatCard icon={AlertTriangle} value={summary.absent  ?? '—'} label="Absent"    accentColor="danger" />
          </div>

          {/* Month progress */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Month Progress</p>
              <span className="text-xs font-bold text-accent-400">{monthPct}%</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-accent-500 rounded-full transition-all duration-700"
                style={{ width: `${monthPct}%` }} />
            </div>
            <p className="text-xs text-gray-600">{passedWD} of {totalWD} working days through {format(new Date(), 'MMMM')}</p>
          </div>

          <Card className="p-4">
            <CalendarWidget attendance={history} holidays={holidays} leaves={leaves} />
          </Card>
        </div>

        {/* Right column */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Clock + Weather */}
          <div>
            <LiveClock />
            {(() => {
              // WiFi mode + office coords configured → show office weather; otherwise use resolved coords
              const inWifi = gpsLocation?.accuracy < 0
              const offLat = settings?.office_lat ? parseFloat(settings.office_lat) : null
              const offLon = settings?.office_lng ? parseFloat(settings.office_lng) : null
              const wLat = inWifi && offLat ? offLat : gpsLocation?.lat
              const wLon = inWifi && offLon ? offLon : gpsLocation?.lon
              return wLat && wLon ? <WeatherWidget lat={wLat} lon={wLon} /> : null
            })()}
          </div>

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
