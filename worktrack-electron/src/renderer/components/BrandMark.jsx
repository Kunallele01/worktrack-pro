import React from 'react'
import { motion } from 'framer-motion'

// No tile, no letter. The mark is the working day drawn as a register: each
// tick is a slice of the day, filled as it elapses, with a bright tick for
// where you are right now. It genuinely closes when the day is done.

const N      = 30
const R_IN   = 13.6
const R_OUT  = 19.4
const CENTER = 24

const marks = Array.from({ length: N }, (_, i) => {
  const a  = (-90 + i * (360 / N)) * (Math.PI / 180)
  const cs = Math.cos(a), sn = Math.sin(a)
  return {
    i,
    x1: CENTER + cs * R_IN,  y1: CENTER + sn * R_IN,
    x2: CENTER + cs * R_OUT, y2: CENTER + sn * R_OUT,
  }
})

const toMins = (hhmm, fallback) => {
  const [h, m] = String(hhmm || fallback).split(':').map(Number)
  return (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 30)
}

// How far through the working day we are, 0 → 1.
function dayProgress(dayStart, dayEnd) {
  const now   = new Date()
  const mins  = now.getHours() * 60 + now.getMinutes()
  const start = toMins(dayStart, '09:30')
  const end   = toMins(dayEnd,   '18:30')
  if (end <= start) return 1
  return Math.min(1, Math.max(0, (mins - start) / (end - start)))
}

export default function BrandMark({
  size = 50,
  animated = true,
  pulse = true,
  dayStart = '09:30',
  dayEnd = '18:30',
  progress,                 // pass 0–1 to override the clock entirely
  className = '',
}) {
  const id = React.useId()
  const [auto, setAuto] = React.useState(() => dayProgress(dayStart, dayEnd))
  const [entered, setEntered] = React.useState(!animated)

  React.useEffect(() => {
    if (progress != null) return
    setAuto(dayProgress(dayStart, dayEnd))
    const t = setInterval(() => setAuto(dayProgress(dayStart, dayEnd)), 60000)
    return () => clearInterval(t)
  }, [dayStart, dayEnd, progress])

  // Let the entrance stagger play once; after that, ticks just light up.
  React.useEffect(() => {
    if (!animated) return
    const t = setTimeout(() => setEntered(true), 200 + N * 35 + 700)
    return () => clearTimeout(t)
  }, [animated])

  const p      = progress != null ? Math.min(1, Math.max(0, progress)) : auto
  const filled = Math.round(p * N)
  const done   = filled >= N

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <motion.div
        className="absolute -inset-2 rounded-full blur-xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(79,134,247,0.55), transparent 70%)' }}
        animate={animated && pulse ? { opacity: [0.4, 0.7, 0.4] } : { opacity: 0.5 }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg viewBox="0 0 48 48" width={size} height={size} className="relative overflow-visible">
        <defs>
          <linearGradient id={`${id}-arc`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%"   stopColor="#2A5AD0" />
            <stop offset="55%"  stopColor="#4F86F7" />
            <stop offset="100%" stopColor="#7DD3FC" />
          </linearGradient>
          <linearGradient id={`${id}-check`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="100%" stopColor="#CFE3FF" />
          </linearGradient>
        </defs>

        {marks.map(m => {
          const elapsed = m.i < filled
          const nowTick = !done && m.i === filled
          const stagger = !entered ? 0.1 + m.i * 0.035 : 0

          return (
            <motion.line
              key={m.i}
              x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
              stroke={nowTick ? '#ffffff' : elapsed ? `url(#${id}-arc)` : '#ffffff'}
              strokeWidth={nowTick ? 3 : 2.5}
              strokeLinecap="round"
              initial={animated ? { pathLength: 0, strokeOpacity: 0 } : false}
              animate={
                nowTick && pulse
                  ? { pathLength: 1, strokeOpacity: [1, 0.3, 1] }
                  : { pathLength: 1, strokeOpacity: elapsed || nowTick ? 1 : 0.14 }
              }
              transition={
                nowTick && pulse
                  ? { pathLength:    { duration: 0.3, delay: stagger },
                      strokeOpacity: { duration: 1.9, repeat: Infinity, ease: 'easeInOut', delay: stagger } }
                  : { duration: entered ? 0.5 : 0.3, delay: stagger, ease: [0.16, 1, 0.3, 1] }
              }
            />
          )
        })}

        <motion.path
          d="M17.4 24.3 L21.6 28.4 L30.6 19.4"
          fill="none" stroke={`url(#${id}-check)`} strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round"
          initial={animated ? { pathLength: 0, opacity: 0 } : false}
          animate={animated ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: entered ? 0 : 0.1 + N * 0.035 }}
        />
      </svg>
    </div>
  )
}
