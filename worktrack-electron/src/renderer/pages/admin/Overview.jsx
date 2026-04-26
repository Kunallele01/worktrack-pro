import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Building2, Home, Clock, RefreshCw } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { getLiveOverview, getWeeklyData, supabase } from '../../lib/supabase'
import { StatCard, Card, Badge, Avatar, Button, AnimatedNumber, ActivityRing } from '../../components/ui'

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
  if (!feed?.length) return <p className="text-sm text-gray-500 py-6 text-center">No check-ins yet today</p>
  return (
    <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
      {feed.map((item, i) => (
        <motion.div
          key={item.user_id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.03] transition-colors"
        >
          <Avatar name={item.full_name} size={8} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{item.full_name}</p>
            <p className="text-xs text-gray-500 font-mono">
              {item.check_in_time ? format(new Date(item.check_in_time), 'hh:mm a') : '—'}
            </p>
          </div>
          <Badge status={item.status} />
        </motion.div>
      ))}
    </div>
  )
}

const CHART_COLORS = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B']

// Donut chart card with hover-to-see-employees tooltip on each legend row
function DonutCard({ donut, byCategory }) {
  const [hovered, setHovered] = useState(null)
  const categoryKey = { 'In Office': 'in_office', 'WFH': 'wfh', 'Absent': 'absent', 'Late': 'late' }

  return (
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
          {donut.map((d, i) => {
            const key  = categoryKey[d.name]
            const list = byCategory?.[key] || []
            const isHovered = hovered === d.name
            return (
              <div key={d.name} className="relative">
                <div
                  className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg cursor-default transition-colors
                    ${isHovered ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}
                  onMouseEnter={() => setHovered(d.name)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i] }} />
                  <span className="text-gray-300">{d.name}</span>
                  <span className="text-gray-500 ml-auto font-mono font-semibold">{d.value}</span>
                  {d.value > 0 && <span className="text-gray-600 text-xs">›</span>}
                </div>
                <AnimatePresence>
                  {isHovered && list.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -8, scale: 0.96 }}
                      animate={{ opacity: 1, x:  0, scale: 1    }}
                      exit={{   opacity: 0, x: -8, scale: 0.96 }}
                      transition={{ duration: 0.12 }}
                      className="absolute left-full top-0 ml-2 z-50
                                 bg-surface-700 border border-white/10 rounded-xl
                                 shadow-2xl p-3 w-48 pointer-events-none"
                    >
                      <p className="text-xs font-semibold text-gray-300 mb-2 pb-1 border-b border-white/10">
                        {d.name} ({list.length})
                      </p>
                      {list.slice(0, 10).map((e, j) => (
                        <div key={j} className="flex items-center gap-2 py-0.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i] }} />
                          <p className="text-xs text-gray-300 truncate">{e.full_name}</p>
                          {e.employee_id && <span className="text-xs text-gray-500 ml-auto shrink-0">{e.employee_id}</span>}
                        </div>
                      ))}
                      {list.length > 10 && <p className="text-xs text-gray-500 mt-1">+{list.length - 10} more</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
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

  const total    = stats.total_employees || 0
  const inOff    = stats.in_office       || 0
  const wfhCount = stats.wfh             || 0
  const lateCount= stats.late            || 0
  const pctInOff = total > 0 ? Math.round(inOff    / total * 100) : 0
  const pctWfh   = total > 0 ? Math.round(wfhCount / total * 100) : 0
  const pctOnsit = total > 0 ? Math.round((inOff + wfhCount) / total * 100) : 0

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

      {/* Animated stat cards with activity rings */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: total, pct: pctOnsit, color: '#4F86F7',  sub: 'checked in today' },
          { label: 'In Office', value: inOff, pct: pctInOff, color: '#10B981', sub: `${pctInOff}% of team` },
          { label: 'WFH',       value: wfhCount, pct: pctWfh, color: '#3B82F6', sub: `${pctWfh}% of team` },
          { label: 'Late',      value: lateCount, pct: total > 0 ? Math.round(lateCount/total*100):0, color: '#F59E0B', sub: 'arrivals today' },
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
            <p className="text-sm font-semibold text-gray-300">● Live Check-ins</p>
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
