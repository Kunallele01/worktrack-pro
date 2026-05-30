import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Building2, Home, Clock, RefreshCw, AlertTriangle, UserX, Timer, TrendingDown } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { getLiveOverview, getWeeklyData, supabase } from '../../lib/supabase'
import { StatCard, Card, Badge, Avatar, Button, AnimatedNumber, ActivityRing } from '../../components/ui'

function getISTMinutes() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return ist.getHours() * 60 + ist.getMinutes()
}

function SmartAlerts({ data, stats }) {
  const istMins = getISTMinutes()
  const absent   = data?.by_category?.absent || []
  const late     = data?.by_category?.late   || []
  const total    = stats?.total_employees || 0
  const checkedIn = stats?.checked_in    || 0
  const lateCount = stats?.late          || 0

  const alerts = []

  // After 11:00 AM IST — surface employees who still haven't checked in
  if (istMins >= 11 * 60 && absent.length > 0) {
    const names = absent.slice(0, 3).map(e => e.full_name).join(', ')
    const overflow = absent.length > 3 ? ` +${absent.length - 3} more` : ''
    alerts.push({
      id: 'absent',
      Icon: UserX,
      title: `${absent.length} employee${absent.length !== 1 ? 's' : ''} haven't checked in`,
      detail: names + overflow,
      color: '#EF4444',
      ring: 'border-red-500/25',
      bg: 'bg-red-500/[0.08]',
    })
  }

  // Any late arrivals today (show as soon as they exist)
  if (lateCount > 0) {
    const names = late.slice(0, 3).map(e => e.full_name).join(', ')
    const overflow = late.length > 3 ? ` +${late.length - 3} more` : ''
    const pct = checkedIn > 0 ? Math.round(lateCount / checkedIn * 100) : 0
    alerts.push({
      id: 'late',
      Icon: Timer,
      title: `${lateCount} late arrival${lateCount !== 1 ? 's' : ''} today${pct ? ` · ${pct}% of present` : ''}`,
      detail: names + overflow,
      color: '#F59E0B',
      ring: 'border-amber-500/25',
      bg: 'bg-amber-500/[0.08]',
    })
  }

  // Attendance well below 50% after 11 AM
  const pctPresent = total > 0 ? checkedIn / total : 1
  if (istMins >= 11 * 60 && total >= 4 && pctPresent < 0.5) {
    const missed = total - checkedIn
    alerts.push({
      id: 'low',
      Icon: TrendingDown,
      title: `Low turnout — only ${checkedIn}/${total} employees present`,
      detail: `${missed} employee${missed !== 1 ? 's' : ''} yet to check in`,
      color: '#8B5CF6',
      ring: 'border-violet-500/25',
      bg: 'bg-violet-500/[0.08]',
    })
  }

  if (alerts.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mb-5"
    >
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={12} className="text-gray-500" />
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Needs Attention</p>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(alerts.length, 3)}, 1fr)` }}>
        {alerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.07, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`flex items-start gap-3 p-3.5 rounded-xl border ${alert.bg} ${alert.ring}`}
          >
            <div className="mt-0.5 p-1.5 rounded-lg" style={{ background: `${alert.color}20` }}>
              <alert.Icon size={13} style={{ color: alert.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight" style={{ color: alert.color }}>{alert.title}</p>
              <p className="text-xs text-gray-400 mt-1 truncate">{alert.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// Subtle floating orbs behind the content
function FloatingOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {[
        { w: 420, h: 420, x: '5%',  y: '10%', c: 'rgba(79,134,247,0.04)',  d: 0  },
        { w: 300, h: 300, x: '65%', y: '55%', c: 'rgba(16,185,129,0.035)', d: 3  },
        { w: 350, h: 350, x: '40%', y: '5%',  c: 'rgba(139,92,246,0.03)',  d: 1.5},
        { w: 200, h: 200, x: '80%', y: '15%', c: 'rgba(245,158,11,0.025)', d: 5  },
      ].map((o, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{ width: o.w, height: o.h, left: o.x, top: o.y, background: o.c }}
          animate={{ scale: [1, 1.12, 1], x: [0, 18, 0], y: [0, -14, 0] }}
          transition={{ duration: 9 + i, repeat: Infinity, ease: 'easeInOut', delay: o.d }}
        />
      ))}
    </div>
  )
}

function LiveFeed({ feed }) {
  const events = []
  feed?.forEach(item => {
    if (item.check_in_time)  events.push({ ...item, type: 'in',  time: item.check_in_time  })
    if (item.check_out_time) events.push({ ...item, type: 'out', time: item.check_out_time })
  })
  events.sort((a, b) => new Date(b.time) - new Date(a.time))

  if (!events.length) return <p className="text-sm text-gray-500 py-6 text-center">No activity yet today</p>
  return (
    <div className="space-y-1 overflow-y-auto max-h-72 pr-1">
      {events.map((item, i) => (
        <motion.div
          key={`${item.user_id}-${item.type}`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.03] transition-colors"
        >
          <Avatar name={item.full_name} size={8} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{item.full_name}</p>
            <p className="text-xs text-gray-500 font-mono">{format(new Date(item.time), 'hh:mm a')}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {item.type === 'in' ? (
              <>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">▲ IN</span>
                <Badge status={item.status} />
              </>
            ) : (
              <span className="text-[10px] font-bold text-gray-400 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded-full">▼ OUT</span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

const CHART_COLORS = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B']

// Donut chart card — tooltip rendered in document.body via portal so it always
// appears above every other element regardless of stacking context.
function DonutCard({ donut, byCategory }) {
  const [hovered,  setHovered ] = useState(null)
  const [tipPos,   setTipPos  ] = useState({ top: 0, left: 0 })
  const categoryKey = { 'In Office': 'in_office', 'WFH': 'wfh', 'Absent': 'absent', 'Late': 'late' }

  const handleEnter = (e, name) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTipPos({ top: rect.top, left: rect.right + 10 })
    setHovered(name)
  }

  const hovIdx  = donut.findIndex(d => d.name === hovered)
  const hovList = hovered ? (byCategory?.[categoryKey[hovered]] || []) : []

  return (
    <>
      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-300 mb-4">Today's Distribution</p>
        <div className="flex items-center gap-6">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie data={donut} cx="50%" cy="50%" innerRadius={50} outerRadius={72}
                dataKey="value" strokeWidth={2} stroke="rgba(255,255,255,0.05)">
                {donut.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 flex-1">
            {donut.map((d, i) => (
              <div
                key={d.name}
                className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg cursor-default transition-colors
                  ${hovered === d.name ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}
                onMouseEnter={e => handleEnter(e, d.name)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i] }} />
                <span className="text-gray-300">{d.name}</span>
                <span className="text-gray-500 ml-auto font-mono font-semibold">{d.value}</span>
                {d.value > 0 && <span className="text-gray-600 text-xs">›</span>}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {createPortal(
        <AnimatePresence>
          {hovered && hovList.length > 0 && (
            <motion.div
              key={hovered}
              initial={{ opacity: 0, x: -8, scale: 0.96 }}
              animate={{ opacity: 1, x:  0, scale: 1    }}
              exit={{   opacity: 0, x: -8, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              style={{ position: 'fixed', top: tipPos.top, left: tipPos.left, zIndex: 9999 }}
              className="bg-surface-700 border border-white/10 rounded-xl shadow-2xl p-3 w-52 pointer-events-none"
            >
              <p className="text-xs font-semibold text-gray-300 mb-2 pb-1 border-b border-white/10">
                {hovered} ({hovList.length})
              </p>
              {hovList.slice(0, 10).map((e, j) => (
                <div key={j} className="flex items-center gap-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CHART_COLORS[hovIdx] }} />
                  <p className="text-xs text-gray-300 truncate">{e.full_name}</p>
                  {e.employee_id && <span className="text-xs text-gray-500 ml-auto shrink-0 font-mono">{e.employee_id}</span>}
                </div>
              ))}
              {hovList.length > 10 && <p className="text-xs text-gray-500 mt-1.5">+{hovList.length - 10} more</p>}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

export default function Overview() {
  const [data, setData]   = useState(null)
  const [week, setWeek]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [ov, wk] = await Promise.all([getLiveOverview(), getWeeklyData()])
      setData(ov); setWeek(wk)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    // Real-time subscription — no polling needed
    const channel = supabase.channel('attendance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const stats = data?.stats || {}
  const donut = [
    { name: 'In Office', value: stats.in_office || 0 },
    { name: 'WFH',       value: stats.wfh       || 0 },
    { name: 'Absent',    value: Math.max(0, (stats.total_employees || 0) - (stats.checked_in || 0)) },
    { name: 'Late',      value: stats.late       || 0 },
  ]

  const total      = stats.total_employees || 0
  const inOff      = stats.in_office       || 0
  const wfhCount   = stats.wfh             || 0
  const lateCount  = stats.late            || 0
  const checkedIn  = stats.checked_in      || 0
  const absent     = Math.max(0, total - checkedIn)
  const pctInOff   = total > 0 ? Math.round(inOff      / total      * 100) : 0
  const pctWfh     = total > 0 ? Math.round(wfhCount   / total      * 100) : 0
  const pctPresent = total > 0 ? Math.round(checkedIn  / total      * 100) : 0
  const pctLate    = checkedIn > 0 ? Math.round(lateCount / checkedIn * 100) : 0

  return (
    <div className="relative h-full overflow-y-auto p-6">
      <FloatingOrbs />
      <div className="relative z-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Overview</h1>
          <p className="text-sm text-gray-400">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <Button variant="secondary" onClick={load} className="gap-2 text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* Smart Alerts — time-aware, only renders when there is something to flag */}
      {!loading && data && <SmartAlerts data={data} stats={stats} />}

      {/* Animated stat cards with activity rings */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Present',   value: checkedIn, pct: pctPresent, color: '#4F86F7',  sub: absent === 0 ? 'Full house today!' : `${absent} not yet checked in` },
          { label: 'In Office', value: inOff,     pct: pctInOff,   color: '#10B981', sub: `${wfhCount} WFH · ${absent} absent` },
          { label: 'WFH',       value: wfhCount,  pct: pctWfh,     color: '#3B82F6', sub: `${inOff} in office · ${absent} absent` },
          { label: 'Late',      value: lateCount, pct: pctLate,    color: '#F59E0B', sub: lateCount === 0 ? 'All on time today' : `of ${checkedIn} present` },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16,1,0.3,1] }}
          >
            <Card className="p-4 flex items-center gap-4">
              <ActivityRing percentage={s.pct} color={s.color} size={72}>
                <div className="text-center">
                  <p className="text-xs font-bold" style={{ color: s.color }}>{s.pct}%</p>
                </div>
              </ActivityRing>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-100 font-mono tabular-nums">
                  <AnimatedNumber value={s.value} />
                </p>
                <p className="text-xs font-semibold text-gray-300 mt-0.5">{s.label}</p>
                <p className="text-xs text-gray-500 truncate">{s.sub}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Donut chart with hover tooltips */}
        <DonutCard donut={donut} byCategory={data?.by_category} />

        {/* Live feed */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-300">● Live Check-ins / Check-outs</p>
            <span className="text-xs text-gray-500">Updates in real-time</span>
          </div>
          <LiveFeed feed={data?.feed} />
        </Card>
      </div>

      {/* Weekly bar chart */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-300 mb-4">This Week</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={week} barCategoryGap="40%">
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#F9FAFB', fontSize: 12 }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="in_office" name="In Office" stackId="a" fill="#10B981" radius={[0,0,4,4]} />
            <Bar dataKey="wfh"       name="WFH"       stackId="a" fill="#3B82F6" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      </div>{/* end z-10 */}
    </div>
  )
}
