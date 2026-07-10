import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { CheckCircle, ArrowRightFromLine, Users, Home, Clock, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { getTodayAttendance, getMonthSummary, getMonthHistory, getYearHistory, checkIn, checkOut, getSettings, getHolidays, getMyLeaves, getLeaveBalance, getMyCorrections } from '../lib/supabase'
import { LEAVE_TYPES, LEAVE_COLORS } from '../lib/leaveConstants'
import { useStore } from '../lib/store'
import { GpsWidget, StatCard, CalendarWidget, Button, Badge, Card } from '../components/ui'
import { useToast } from '../components/ui'

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

// Map weather code → framer-motion animation props for the icon
function weatherAnim(code) {
  if (code === 0)  return { animate: { rotate: [0, 360] },                         transition: { duration: 8,   repeat: Infinity, ease: 'linear'    } }  // Clear — spin
  if (code <= 2)   return { animate: { y: [0, -8, 0], scale: [1, 1.08, 1] },       transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } }  // Mostly clear — float
  if (code <= 3)   return { animate: { x: [0, 6, -6, 0] },                         transition: { duration: 4,   repeat: Infinity, ease: 'easeInOut' } }  // Overcast — drift
  if (code <= 48)  return { animate: { opacity: [1, 0.4, 1], scale: [1,1.05,1] },  transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } }  // Fog — pulse
  if (code <= 65)  return { animate: { y: [0, 7, 0] },                             transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } }  // Rain — bounce down
  if (code <= 86)  return { animate: { rotate: [-10, 10, -10], y: [0, 4, 0] },     transition: { duration: 2,   repeat: Infinity, ease: 'easeInOut' } }  // Snow — sway
  return           { animate: { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] },        transition: { duration: 0.8, repeat: Infinity                    } }  // Thunder — flash
}

// ── Weather code → particle type ────────────────────────────────────────────
function precipType(code) {
  if (code == null) return 'none'
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code === 45 || code === 48 || code === 2 || code === 3)   return 'clouds'
  return 'clear'
}

// ── Time-of-day sky palettes (kept dark enough for white text) ───────────────
const SKY_PAL = {
  night: ['#05070f', '#0a0f1e', '#0e1526'],
  dawn:  ['#15122a', '#2c2242', '#5a4050'],
  day:   ['#0b1e34', '#12304a', '#1b3d5c'],
  dusk:  ['#171029', '#34223f', '#5e3641'],
}
const SKY_GLOW = {
  night: 'rgba(180,200,255,0.13)',
  dawn:  'rgba(255,178,138,0.22)',
  day:   'rgba(255,224,178,0.20)',
  dusk:  'rgba(255,148,108,0.22)',
}
function skyState(now, sunrise, sunset) {
  const mins  = now.getHours() * 60 + now.getMinutes()
  const srMin = sunrise ? sunrise.getHours() * 60 + sunrise.getMinutes() : 6 * 60
  const ssMin = sunset  ? sunset.getHours()  * 60 + sunset.getMinutes()  : 18 * 60
  const W = 55 // dawn/dusk window in minutes
  let phase
  if (mins < srMin - W || mins > ssMin + W) phase = 'night'
  else if (mins < srMin + W) phase = 'dawn'
  else if (mins > ssMin - W) phase = 'dusk'
  else phase = 'day'
  const sunT = Math.max(0, Math.min(1, (mins - srMin) / Math.max(1, ssMin - srMin)))
  return { phase, sunT, isNight: phase === 'night' }
}

function weatherQuip(code, phase) {
  const t = precipType(code)
  if (t === 'storm')  return 'Storm rolling through — stay dry out there.'
  if (t === 'rain')   return 'Rain outside — perfect heads-down weather.'
  if (t === 'snow')   return 'Snow is falling — bundle up.'
  if (t === 'clouds') return 'Grey skies — good focus energy.'
  if (phase === 'night') return 'Clear night — burning the midnight oil?'
  if (phase === 'dawn')  return 'A fresh start to the day.'
  if (phase === 'dusk')  return 'Golden hour — winding down.'
  return 'Clear skies — make it a good one.'
}

// ── Live weather particle canvas (rain / snow / clouds / stars / lightning) ──
function SkyCanvas({ type, phase }) {
  const cvs   = useRef(null)
  const flash = useRef(0)

  useEffect(() => {
    const canvas = cvs.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let raf, last = 0, running = true
    let W = 0, H = 0, parts = [], stars = []
    const rnd = (a, b) => a + Math.random() * (b - a)

    function init() {
      parts = []
      // Stars fill the whole pill at night/dawn/dusk — never in daylight, and not during
      // heavy precip where drops/flakes dominate
      const showStars = phase !== 'day' && type !== 'rain' && type !== 'snow' && type !== 'storm'
      stars = showStars
        ? Array.from({ length: 84 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.4, 1.5), p: rnd(0, 6.28), s: rnd(0.8, 2.4) }))
        : []
      if (type === 'rain' || type === 'storm') {
        for (let i = 0; i < 95; i++) parts.push({ x: rnd(0, W), y: rnd(0, H), len: rnd(8, 18), v: rnd(360, 560), a: rnd(0.08, 0.28) })
      } else if (type === 'snow') {
        for (let i = 0; i < 60; i++) parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1, 2.6), v: rnd(18, 42), drift: rnd(-14, 14), ph: rnd(0, 6.28), a: rnd(0.3, 0.8) })
      } else if (type === 'clouds') {
        for (let i = 0; i < 3; i++) parts.push({ x: rnd(0, W), y: rnd(H * 0.14, H * 0.48), w: rnd(130, 210), h: rnd(14, 26), v: rnd(11, 19), a: rnd(0.05, 0.09) })
      }
    }
    function resize() {
      const r = canvas.parentElement.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      init()
    }
    function draw(t) {
      if (!running) return
      raf = requestAnimationFrame(draw)
      if (t - last < 33) return          // throttle ~30fps
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016)
      last = t
      ctx.clearRect(0, 0, W, H)

      for (const s of stars) {
        s.p += dt * s.s
        ctx.globalAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(s.p))
        ctx.fillStyle = '#dbe6ff'
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill()
      }
      ctx.globalAlpha = 1

      if (type === 'rain' || type === 'storm') {
        ctx.strokeStyle = '#9fc4ff'; ctx.lineWidth = 1
        for (const p of parts) {
          ctx.globalAlpha = p.a
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len * 0.3, p.y + p.len); ctx.stroke()
          p.y += p.v * dt; p.x -= p.v * 0.3 * dt
          if (p.y > H) { p.y = -p.len; p.x = rnd(0, W) }
        }
      } else if (type === 'snow') {
        ctx.fillStyle = '#eaf2ff'
        for (const p of parts) {
          p.ph += dt
          ctx.globalAlpha = p.a
          ctx.beginPath(); ctx.arc(p.x + Math.sin(p.ph) * 4, p.y, p.r, 0, 6.283); ctx.fill()
          p.y += p.v * dt; p.x += p.drift * dt * 0.3
          if (p.y > H) { p.y = -4; p.x = rnd(0, W) }
        }
      } else if (type === 'clouds') {
        // Soft wide haze wisps — heavily blurred, dim at night, warm at dawn/dusk
        const cloudCol = phase === 'night' ? '#5d6b85' : phase === 'day' ? '#cdd8e8' : '#d3c1bf'
        ctx.filter = 'blur(11px)'
        ctx.fillStyle = cloudCol
        for (const p of parts) {
          ctx.globalAlpha = p.a
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w, p.h, 0, 0, 6.283); ctx.fill()
          ctx.beginPath(); ctx.ellipse(p.x - p.w * 0.25, p.y - p.h * 0.5, p.w * 0.55, p.h * 0.8, 0, 0, 6.283); ctx.fill()
          p.x += p.v * dt
          if (p.x - p.w > W) { p.x = -p.w; p.y = rnd(H * 0.14, H * 0.48) }
        }
        ctx.filter = 'none'
      }
      ctx.globalAlpha = 1

      if (type === 'storm') {
        if (Math.random() < 0.004) flash.current = 1
        if (flash.current > 0) {
          ctx.fillStyle = `rgba(200,220,255,${flash.current * 0.5})`
          ctx.fillRect(0, 0, W, H)
          flash.current -= dt * 2.5
        }
      }
    }

    resize()
    raf = requestAnimationFrame(draw)
    const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement)
    const onVis = () => {
      running = !document.hidden
      if (running) { last = 0; raf = requestAnimationFrame(draw) }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      running = false; cancelAnimationFrame(raf)
      ro.disconnect(); document.removeEventListener('visibilitychange', onVis)
    }
  }, [type, phase])

  return <canvas ref={cvs} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
}

// ── Rolling odometer digit ───────────────────────────────────────────────────
function OdoDigit({ d, size }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) gsap.to(ref.current, { yPercent: -d * 10, duration: 0.5, ease: 'power3.out' })
  }, [d])
  return (
    <span style={{ height: size, width: size * 0.62, overflow: 'hidden', display: 'inline-block' }}>
      <span ref={ref} style={{ display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} style={{ height: size, lineHeight: `${size}px`, textAlign: 'center' }}>{n}</span>
        ))}
      </span>
    </span>
  )
}

function OdoClock({ now }) {
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const big = 46, small = 22
  return (
    <div className="flex items-center justify-center font-mono font-black text-gray-50" style={{ letterSpacing: '-1px' }}>
      <OdoDigit d={+hh[0]} size={big} /><OdoDigit d={+hh[1]} size={big} />
      <span className="text-gray-500 animate-pulse font-black" style={{ fontSize: big * 0.72, lineHeight: `${big}px`, margin: '0 2px' }}>:</span>
      <OdoDigit d={+mm[0]} size={big} /><OdoDigit d={+mm[1]} size={big} />
      <span className="flex items-center text-gray-400 font-light ml-1.5">
        <span style={{ fontSize: small * 0.8, lineHeight: `${small}px`, marginRight: 1 }}>:</span>
        <OdoDigit d={+ss[0]} size={small} /><OdoDigit d={+ss[1]} size={small} />
      </span>
    </div>
  )
}

// ── Daylight arc — sunrise → now → sunset ────────────────────────────────────
function DaylightArc({ sunT, isNight, sunrise, sunset }) {
  const P0 = [16, 36], P1 = [150, 6], P2 = [284, 36]
  const at = (t) => [
    (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
    (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
  ]
  const [tx, ty] = at(sunT)
  const fmt = (d) => (d ? format(d, 'h:mm a') : '—')
  const path = `M${P0[0]},${P0[1]} Q${P1[0]},${P1[1]} ${P2[0]},${P2[1]}`
  return (
    <div className="flex items-center gap-2 mt-1.5 w-full">
      <span className="text-[10px] text-gray-400 font-mono w-14 text-right shrink-0">↑ {fmt(sunrise)}</span>
      <svg viewBox="0 0 300 42" className="flex-1" style={{ height: 30 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="dl-arc" x1="0" x2="1">
            <stop offset="0" stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="1" stopColor="#fcd34d" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" strokeDasharray="2 4" />
        {!isNight && (
          <path d={path} fill="none" stroke="url(#dl-arc)" strokeWidth="2"
            pathLength="1" strokeDasharray="1" strokeDashoffset={1 - sunT} strokeLinecap="round" />
        )}
        <circle cx={tx} cy={ty} r="4.5" fill={isNight ? '#cbd5e1' : '#fcd34d'}
          style={{ filter: `drop-shadow(0 0 5px ${isNight ? '#94a3b8' : '#fcd34d'})` }} />
      </svg>
      <span className="text-[10px] text-gray-400 font-mono w-14 shrink-0">↓ {fmt(sunset)}</span>
    </div>
  )
}

// ── The full atmospheric header ──────────────────────────────────────────────
function SkyHeader({ lat, lon }) {
  const [now, setNow] = useState(new Date())
  const [w,   setW  ] = useState(null)

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  useEffect(() => {
    if (!lat || !lon || (lat === 0 && lon === 0)) { setW(null); return }
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,apparent_temperature,weather_code,is_day&daily=sunrise,sunset&timezone=auto`)
      .then(r => r.json())
      .then(d => {
        if (!d.current) return
        setW({
          temp:    Math.round(d.current.temperature_2m),
          feels:   Math.round(d.current.apparent_temperature),
          code:    d.current.weather_code,
          isDay:   d.current.is_day === 1,
          sunrise: d.daily?.sunrise?.[0] ? new Date(d.daily.sunrise[0]) : null,
          sunset:  d.daily?.sunset?.[0]  ? new Date(d.daily.sunset[0])  : null,
        })
      })
      .catch(() => {})
  }, [lat, lon])

  const sky   = skyState(now, w?.sunrise, w?.sunset)
  const pal   = SKY_PAL[sky.phase]
  const type  = precipType(w?.code)
  const glowX = 6 + sky.sunT * 88
  const info  = w ? wmoInfo(w.code) : null

  return (
    <div className="relative shrink-0 overflow-hidden rounded-2xl border border-white/[0.06]" style={{ height: 216 }}>
      {/* Sky base gradient */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(168deg, ${pal[0]}, ${pal[1]} 52%, ${pal[2]})`, transition: 'background 2s ease' }} />
      {/* Sun / moon — a bright disc with a soft halo, drifting across with the day */}
      {(() => {
        const isN     = sky.isNight
        const bodyTop = isN ? '22%' : `${16 - Math.sin(sky.sunT * Math.PI) * 8}%`
        const disc    = isN ? '#e7edf9' : sky.phase === 'day' ? '#ffe4a0' : '#ffb277'
        const ds      = isN ? 20 : 30
        return (
          <div className="absolute pointer-events-none" style={{ left: `${glowX}%`, top: bodyTop, width: 0, height: 0 }}>
            <div className="absolute rounded-full" style={{ width: 200, height: 200, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${SKY_GLOW[sky.phase]} 0%, transparent 60%)` }} />
            <div className="absolute rounded-full" style={{ width: ds, height: ds, transform: 'translate(-50%,-50%)', background: disc, boxShadow: `0 0 22px 5px ${disc}80`, opacity: 0.95 }} />
          </div>
        )
      })()}
      {/* Weather particles */}
      <SkyCanvas type={type} phase={sky.phase} />

      {/* Foreground content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 py-3">
        <OdoClock now={now} />
        <p className="text-gray-300 text-sm mt-1.5">{format(now, 'EEEE, d MMMM yyyy')}</p>
        {w && (
          <div className="flex items-center gap-2.5 mt-2">
            <motion.div animate={weatherAnim(w.code).animate} transition={weatherAnim(w.code).transition}
              style={{ fontSize: 26, lineHeight: 1, display: 'inline-flex', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }}>
              {info.icon}
            </motion.div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-100 leading-tight">
                {w.temp}°C <span className="font-normal text-gray-300">{info.label}</span>
              </p>
              <p className="text-[11px] text-gray-400 leading-tight">{weatherQuip(w.code, sky.phase)}</p>
            </div>
          </div>
        )}
        {w?.sunrise && w?.sunset && (
          <div className="w-full max-w-sm px-2">
            <DaylightArc sunT={sky.sunT} isNight={sky.isNight} sunrise={w.sunrise} sunset={w.sunset} />
          </div>
        )}
      </div>
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
  const hoursWorked = (() => {
    const end = record.check_out_time ? new Date(record.check_out_time) : new Date()
    const ms  = end - new Date(record.check_in_time)
    if (ms <= 0) return null
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return record.check_out_time
      ? `${h}h ${m}m worked`
      : `${h}h ${m}m so far`
  })()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Badge status={record.status} />
        {record.is_late && <Badge status="late" />}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-mono">In: <span className="text-gray-300">{fmt(record.check_in_time)}</span></span>
        {record.check_out_time
          ? <span className="font-mono">Out: <span className="text-gray-300">{fmt(record.check_out_time)}</span></span>
          : <span className="text-gray-600 italic">Not checked out</span>
        }
        {hoursWorked && (
          <span className="font-semibold text-accent-400">{hoursWorked}</span>
        )}
      </div>
    </div>
  )
}

function AttendanceScoreCard({ score, grade, consistency, punctuality, officePresence, passedWD, totalWD, monthName }) {
  const rings = [
    { label: 'Consistency', value: consistency,    max: 40, color: '#4F86F7', glow: 'rgba(79,134,247,0.45)'  },
    { label: 'Punctuality', value: punctuality,    max: 35, color: '#10B981', glow: 'rgba(16,185,129,0.45)'  },
    { label: 'Presence',    value: officePresence, max: 25, color: '#8B5CF6', glow: 'rgba(139,92,246,0.45)'  },
  ]
  const GRADE_HEX = { 'Excellent': '#10B981', 'Good': '#4F86F7', 'Fair': '#F59E0B', 'At Risk': '#EF4444' }
  const hex = GRADE_HEX[grade.label] || '#4F86F7'

  // Main gauge geometry — 270° arc, gap at the bottom
  const R    = 46
  const CIRC = 2 * Math.PI * R
  const SPAN = CIRC * 0.75
  const GBOX = 120
  const CX   = 60

  // Mini ring geometry — viewBox leaves margin so the round line-cap + drop-shadow
  // never clip against the SVG edge
  const mR    = 15
  const mCirc = 2 * Math.PI * mR
  const mBox  = 42
  const mCX   = 21

  const scoreRef = useRef(null)
  const arcRef   = useRef(null)
  const ringRefs = useRef([])

  useEffect(() => {
    const pct = Math.min(100, Math.max(0, score)) / 100
    const tl  = gsap.timeline({ delay: 0.25 })

    // Main arc sweeps from empty to score
    if (arcRef.current) {
      tl.fromTo(arcRef.current,
        { strokeDashoffset: SPAN },
        { strokeDashoffset: SPAN * (1 - pct), duration: 1.7, ease: 'power2.inOut' },
        0,
      )
    }
    // Mini rings stagger in after the main arc starts moving
    ringRefs.current.forEach((el, i) => {
      if (!el) return
      const r  = rings[i]
      const rp = r.max > 0 ? Math.min(1, Math.max(0, r.value / r.max)) : 0
      tl.fromTo(el,
        { strokeDashoffset: mCirc },
        { strokeDashoffset: mCirc * (1 - rp), duration: 1.05, ease: 'sine.inOut' },
        0.45 + i * 0.22,
      )
    })
    // Count up the score number
    const obj = { val: 0 }
    const counter = gsap.to(obj, {
      val: score, duration: 1.8, ease: 'power2.inOut', delay: 0.25,
      onUpdate: () => { if (scoreRef.current) scoreRef.current.textContent = Math.round(obj.val) },
    })
    return () => { tl.kill(); counter.kill() }
  }, [score])

  return (
    <Card className="p-4 relative shrink-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Attendance Score</p>

      <div className="flex items-center gap-4">
        {/* ── Main gauge ── */}
        <div className="relative shrink-0" style={{ width: GBOX, height: GBOX }}>
          {/* Ambient glow behind the gauge — colored by grade */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${hex}26 0%, transparent 62%)`, filter: 'blur(14px)' }}
          />
          <svg width={GBOX} height={GBOX} viewBox={`0 0 ${GBOX} ${GBOX}`} className="relative">
            <defs>
              <linearGradient id="asc-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor={hex} stopOpacity="0.45" />
                <stop offset="100%" stopColor={hex} />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle cx={CX} cy={CX} r={R} fill="none" stroke="rgba(255,255,255,0.07)"
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${SPAN} ${CIRC}`}
              transform={`rotate(135 ${CX} ${CX})`} />
            {/* Score arc */}
            <circle ref={arcRef} cx={CX} cy={CX} r={R} fill="none" stroke="url(#asc-grad)"
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${SPAN} ${CIRC}`}
              strokeDashoffset={SPAN}
              transform={`rotate(135 ${CX} ${CX})`}
              style={{ filter: `drop-shadow(0 0 4px ${hex}66)` }} />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span ref={scoreRef}
              className="text-3xl font-black font-mono tabular-nums leading-none text-gray-50"
              style={{ textShadow: `0 0 16px ${hex}55` }}>0</span>
            <span className="text-[9px] text-gray-500 font-medium mt-0.5">of 100</span>
            <motion.span
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`mt-1 inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${grade.bg} ${grade.color} border border-white/10`}
            >
              <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: hex }} />
              {grade.label}
            </motion.span>
          </div>
        </div>

        {/* ── Sub-score rings ── */}
        <div className="flex-1 grid grid-cols-3 gap-1.5">
          {rings.map(({ label, value, max, color, glow }, i) => (
            <div key={label} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="relative" style={{ width: mBox, height: mBox }}>
                <svg width={mBox} height={mBox} viewBox={`0 0 ${mBox} ${mBox}`}>
                  <circle cx={mCX} cy={mCX} r={mR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                  <circle ref={el => ringRefs.current[i] = el}
                    cx={mCX} cy={mCX} r={mR} fill="none" stroke={color}
                    strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={mCirc}
                    strokeDashoffset={mCirc}
                    transform={`rotate(-90 ${mCX} ${mCX})`}
                    style={{ filter: `drop-shadow(0 0 3px ${glow})` }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold font-mono tabular-nums" style={{ color }}>
                    {Math.round(value)}
                  </span>
                </div>
              </div>
              <p className="text-[9px] font-semibold text-gray-400 leading-tight mt-0.5">{label}</p>
              <p className="text-[8px] text-gray-600 font-mono leading-none">/ {max}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-gray-600 mt-2 text-center">
        Based on {passedWD} of {totalWD} working days in {monthName}
      </p>
    </Card>
  )
}

function DashboardInner() {
  const toast       = useToast()
  const user        = useStore(s => s.user)
  const gpsLocation = useStore(s => s.gpsLocation)
  const gpsStatus   = useStore(s => s.gpsStatus)
  const setGps          = useStore(s => s.setGps)
  const setGpsAcquiring = useStore(s => s.setGpsAcquiring)
  const settings    = useStore(s => s.settings)
  const setSettings = useStore(s => s.setSettings)

  const [today,       setToday      ] = useState(null)
  const [summary,     setSummary    ] = useState({})
  const [history,     setHistory    ] = useState([])
  const [calHistory,  setCalHistory ] = useState([])
  const [holidays,    setHolidays   ] = useState([])
  const [leaves,      setLeaves     ] = useState([])
  const [balance,     setBalance    ] = useState({})
  const [corrections, setCorrections] = useState([])
  const [checking,    setChecking   ] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    const now = new Date()
    const [t, s, h, yh, hols, leavs, sett, bal, corrs] = await Promise.all([
      getTodayAttendance(user.id),
      getMonthSummary(user.id, now.getFullYear(), now.getMonth() + 1),
      getMonthHistory(user.id, now.getFullYear(), now.getMonth() + 1),
      getYearHistory(user.id, now.getFullYear()),
      getHolidays(),
      getMyLeaves(user.id, now.getFullYear()),
      getSettings(),
      getLeaveBalance(user.id, now.getFullYear()),
      getMyCorrections(user.id),
    ])
    setToday(t); setSummary(s); setHistory(h); setCalHistory(yh); setHolidays(hols); setLeaves(leavs)
    if (sett) setSettings(sett)
    setBalance(bal || {}); setCorrections(corrs || [])
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  async function handleCheckIn() {
    if (!gpsLocation) { toast('GPS not ready. Please wait.', 'warning'); return }
    setChecking(true)
    try {
      const rec = await checkIn(user.id, gpsLocation.lat, gpsLocation.lon, gpsLocation.accuracy)
      setToday(rec)
      if (burstRef.current) {
        gsap.timeline()
          .set(burstRef.current,  { scale: 0.6, opacity: 0.5, display: 'block' })
          .to(burstRef.current,   { scale: 2.2, opacity: 0, duration: 1.1, ease: 'sine.out' })
          .set(burstRef.current,  { display: 'none' })
      }
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
  const burstRef    = useRef(null)

  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] || ''

  // ── Motivational message — deterministic per user per day ──────────────────
  const MESSAGES = [
    // Consistency & showing up
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
    // Growth & learning
    "Every expert was once a beginner who simply refused to quit.",
    "The gap between who you are and who you want to be is called work.",
    "Skills rust when not used. You're keeping yours sharp today.",
    "Growth happens at the edge of comfort. Step there today.",
    "You can't go back and change the beginning, but you can start today and change the ending.",
    "Learning is not attained by chance. It must be sought with ardor and attended to with diligence.",
    "The more you know, the more you realize how much there is left to know — keep going.",
    "Invest in yourself today. It pays the best interest.",
    "Do something today that your future self will thank you for.",
    "The expert in anything was once a beginner. Keep your beginner's mind.",
    "Knowledge unused is knowledge wasted. Apply something new today.",
    "Every skill you build is a door you can walk through later.",
    "Stretch yourself a little further than yesterday. That's where growth lives.",
    // Focus & execution
    "Clarity of purpose turns ordinary effort into extraordinary output.",
    "One focused hour beats ten distracted ones every single time.",
    "Don't count the days. Make the days count.",
    "The secret of getting ahead is getting started.",
    "A goal without a plan is just a wish. Today you're executing the plan.",
    "Do the hard thing first. Everything else gets easier.",
    "Energy follows attention. Point both at what matters most today.",
    "Work expands to fill time — or you can choose to make time work for you.",
    "Perfection is the enemy of done. Done beats perfect every time.",
    "Start where you are. Use what you have. Do what you can.",
    "Deep work is the superpower of the next decade. Guard your focus.",
    "The difference between a dream and a goal is a deadline. Honor yours.",
    "Stop waiting for the right moment. This moment is the right moment.",
    "You can have results or excuses. Not both.",
    // Team & collaboration
    "A team is not a group of people who work together. It's people who trust each other.",
    "Talent wins games. Teamwork wins championships.",
    "Behind every successful person is a team they're proud to be part of.",
    "Great teams aren't built on stars alone. They're built on reliable contributors — like you.",
    "The strength of the team is each individual member. The strength of each member is the team.",
    "Alone we can do so little. Together we can do so much.",
    "Your presence on this team makes it better. Don't underestimate that.",
    "A good team makes the work feel less like work.",
    "When everyone rows together, the boat moves fast.",
    "Your commitment today holds the team's momentum tomorrow.",
    "Be the teammate you'd want to have.",
    // Mindset & resilience
    "Difficult roads often lead to beautiful destinations.",
    "The obstacle is the way. Face it head-on today.",
    "Pressure is a privilege — it means you've been given something worth fighting for.",
    "You've survived 100% of your hard days so far. Today is no different.",
    "The comeback is always stronger than the setback.",
    "Strong people don't put others down. They lift them up and lead the way.",
    "You don't have to be extreme — just consistent.",
    "Everything you've ever wanted is on the other side of fear.",
    "What you resist persists. What you embrace dissolves.",
    "The mind is a muscle. Train it like one.",
    "You are not your mood. You are your choices.",
    "Respond, don't react. Lead, don't follow. Create, don't consume.",
    "Storms make trees take deeper roots. Today might be building yours.",
    "You can't control everything. Your response — that you can always control.",
    "Champions train when they don't feel like it. Today, be a champion.",
    // Purpose & impact
    "Work done with passion is work that changes the world.",
    "The impact of what you build outlasts any title you hold.",
    "Your best work comes from a place of purpose, not pressure.",
    "Meaningful work isn't always loud. Sometimes it's just quietly excellent.",
    "You are building something bigger than any one day. Remember that.",
    "Not all heroes wear capes. Some just deliver on time, every time.",
    "What you create with your hands and mind is your gift to the world.",
    "The legacy of great work is felt long after the work is done.",
    "Every line of effort you put in shapes something real.",
    "Good work speaks for itself. Let yours do the talking.",
    // Energy & momentum
    "Momentum is built by doing, not by waiting.",
    "Motion creates emotion. Get moving and the motivation follows.",
    "Inertia is the enemy. You've already beaten it by showing up.",
    "One good decision leads to another. You've already made one today.",
    "Ride the momentum you built yesterday into today.",
    "Energy is contagious — bring the kind worth catching.",
    "You can't steer a parked car. Keep moving.",
    "Starting is the hardest part. You're past it now.",
    "Each day you push, the next day gets a little easier.",
    "The fire you carry today lights the way for others around you.",
    // Calm & clarity
    "A calm mind is the ultimate weapon against your challenges.",
    "Take it one task at a time. The mountain is climbed one step at a time.",
    "Breathe. Prioritize. Execute. Repeat.",
    "Clarity comes from action, not thought. Move forward.",
    "Slow is smooth. Smooth is fast.",
    "Not every day needs to be a sprint. Some days, steady wins the race.",
    "Simplicity is the ultimate sophistication. Keep it focused.",
    "Do less, but do it well. Quality over volume, always.",
    "Check in, settle in, dive in. Today is ready for you.",
    "The best preparation for tomorrow is doing your best today.",
    // Wit & lightness
    "Coffee in hand, tasks in queue, world unaware of what's about to happen.",
    "Another day, another chance to make the competition nervous.",
    "You're not just clocking in — you're powering up.",
    "Monday called. You already answered. That's the whole game.",
    "Whatever today throws at you, you've thrown harder things back.",
    "Plot twist: today is the day everything clicks.",
    "Today's forecast: 100% chance of getting things done.",
    "They said it couldn't be done. They weren't talking about you.",
    "Be so good they can't ignore you — starting today.",
    "Let the work do the bragging. You just do the work.",
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
  const monthPct  = totalWD ? Math.round((passedWD / totalWD) * 100) : 0
  const monthName = format(new Date(), 'MMMM')

  // ── Attendance score ───────────────────────────────────────────────────────
  const present      = summary.present  || 0
  const late         = summary.late     || 0
  const wfh          = summary.wfh      || 0
  const inOffice     = Math.max(0, present - wfh)

  const _offStartMin = (() => {
    const [h, m] = (settings?.office_start_time || '09:30').split(':').map(Number)
    return h * 60 + m
  })()
  const _graceMin      = parseInt(settings?.grace_period_minutes || '10', 10)
  const _lateThreshold = _offStartMin + _graceMin

  // Approved-leave working days elapsed this month — excluded from the punctuality denominator
  const _thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const _todayStr        = now.toLocaleDateString('sv-SE')
  const leaveDays = new Set()
  for (const l of leaves) {
    if (l.status !== 'approved') continue
    const cur = new Date(l.start_date + 'T12:00:00')
    const end = new Date(l.end_date   + 'T12:00:00')
    while (cur <= end) {
      const ds  = cur.toLocaleDateString('sv-SE')
      const dow = cur.getDay()
      if (dow !== 0 && dow !== 6 && ds.startsWith(_thisMonthPrefix) && ds <= _todayStr) leaveDays.add(ds)
      cur.setDate(cur.getDate() + 1)
    }
  }
  const leaveWD = leaveDays.size

  const presentRecs = history.filter(r => ['in_office','wfh'].includes(r.status))
  const punctScore = (() => {
    // Denominator = elapsed working days minus approved-leave days (absent days count as 0 punctuality)
    const denom = Math.max(0, passedWD - leaveWD)
    if (denom === 0) return 0
    const sum = presentRecs.reduce((acc, r) => {
      if (!r.is_late || !r.check_in_time) return acc + 1
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(new Date(r.check_in_time))
      const h = parseInt(parts.find(p => p.type === 'hour').value, 10)
      const m = parseInt(parts.find(p => p.type === 'minute').value, 10)
      return acc + Math.min(1, Math.max(0, 1 - ((h * 60 + m) - _lateThreshold) / 60))
    }, 0)
    return Math.min(1, sum / denom) * 35
  })()

  const consistency    = passedWD > 0 ? (present / passedWD) * 40 : 0
  const punctuality    = punctScore
  const officePresence = present  > 0 ? (inOffice / present) * 25  : 0
  const score          = passedWD === 0 || present === 0 ? 0
    : Math.round(consistency + punctuality + officePresence)
  const grade = score >= 90
    ? { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/15' }
    : score >= 75
    ? { label: 'Good',      color: 'text-accent-400',  bg: 'bg-accent-500/15'  }
    : score >= 60
    ? { label: 'Fair',      color: 'text-amber-400',   bg: 'bg-amber-500/15'   }
    : { label: 'At Risk',   color: 'text-red-400',     bg: 'bg-red-500/15'     }

  return (
    <div className="h-full flex overflow-hidden">
        {/* Left column */}
        <div className="w-80 shrink-0 flex flex-col overflow-y-auto p-5 gap-5" style={{ scrollBehavior: 'smooth' }}>

          {/* Greeting */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-100">{greeting}, {firstName} 👋</h2>
            {streak > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                🔥 {streak}d
              </span>
            )}
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
            <CalendarWidget attendance={calHistory} holidays={holidays} leaves={leaves} />
          </Card>

          {/* Leave Balance */}
          {LEAVE_TYPES.some(t => t.quotaKey && settings?.[t.quotaKey]) && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Leave Balance</p>
              <div className="grid grid-cols-2 gap-2">
                {LEAVE_TYPES.filter(t => t.quotaKey).map(t => {
                  const quota = settings?.[t.quotaKey] ? parseInt(settings[t.quotaKey], 10) : null
                  const used  = balance[t.value] || 0
                  const rem   = quota !== null ? Math.max(0, quota - used) : null
                  const lc    = LEAVE_COLORS[t.value]
                  return (
                    <div key={t.value} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${lc.bg} border ${lc.border}`}>
                      <span className="text-base leading-none">{t.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-[10px] font-bold ${lc.text} leading-tight truncate`}>{t.label.replace(' Leave', '')}</p>
                        <p className="text-xs font-mono font-bold text-gray-100 leading-tight">
                          {rem !== null ? rem : '—'}
                          {quota !== null && <span className="text-gray-500 font-normal text-[10px]">/{quota}</span>}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Gradient separator */}
        <div style={{ width: 1, flexShrink: 0, background: 'linear-gradient(to bottom, transparent 0%, rgba(148,163,184,0.18) 18%, rgba(148,163,184,0.18) 82%, transparent 100%)' }} />

        {/* Right column */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Atmospheric header — live sky, odometer clock, weather, daylight arc */}
          {(() => {
            // WiFi mode + office coords configured → use office weather; otherwise resolved coords
            const inWifi = gpsLocation?.accuracy < 0
            const offLat = settings?.office_latitude ? parseFloat(settings.office_latitude) : null
            const offLon = settings?.office_longitude ? parseFloat(settings.office_longitude) : null
            const wLat = inWifi && offLat ? offLat : gpsLocation?.lat
            const wLon = inWifi && offLon ? offLon : gpsLocation?.lon
            return <SkyHeader lat={wLat} lon={wLon} />
          })()}

          {/* GPS Widget */}
          <GpsWidget
            onAcquiring={setGpsAcquiring}
            onReady={(lat, lon, acc) => setGps({ lat, lon, accuracy: acc })}
            officeWifiSSIDs={(settings?.office_wifi_ssid || '').split('\n').map(s => s.trim()).filter(Boolean)}
          />

          {/* Check-in / Check-out */}
          <div className="grid grid-cols-2 gap-4">
            {/* ── Check-in ── */}
            {checkedIn ? (
              <div className="flex flex-col items-center justify-center gap-1.5 h-28 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle size={18} className="text-emerald-400" />
                </div>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Checked In</p>
                <p className="text-base font-mono font-bold text-gray-100">
                  {format(new Date(today.check_in_time), 'hh:mm a')}
                </p>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.975 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                onClick={handleCheckIn}
                disabled={!canCheckIn || checking}
                className={`relative w-full flex flex-col items-center justify-center gap-2 h-28 rounded-2xl text-sm font-semibold overflow-hidden transition-all
                  ${canCheckIn
                    ? 'bg-accent-500/15 border border-accent-500/40 text-accent-300 hover:bg-accent-500/22 hover:border-accent-500/60 cursor-pointer'
                    : 'bg-white/[0.02] border border-white/[0.06] text-gray-600 cursor-not-allowed'}`}
              >
                {canCheckIn && <div className="absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-accent-500/20 to-transparent pointer-events-none" />}
                <div ref={burstRef} className="absolute inset-0 rounded-2xl bg-accent-400/40 pointer-events-none" style={{ display: 'none' }} />
                <div className={`relative w-9 h-9 rounded-full flex items-center justify-center ${canCheckIn ? 'bg-accent-500/20' : 'bg-white/[0.04]'}`}>
                  {checking && !checkedIn
                    ? <div className="w-4 h-4 border-2 border-accent-400/30 border-t-accent-400 rounded-full animate-spin" />
                    : <CheckCircle size={19} />}
                </div>
                <span className="relative">{checking && !checkedIn ? 'Checking in…' : 'Mark Check-In'}</span>
                {!canCheckIn && gpsStatus !== 'active' && (
                  <span className="text-[10px] text-gray-600 font-normal -mt-1">Waiting for GPS…</span>
                )}
              </motion.button>
            )}

            {/* ── Check-out ── */}
            {checkedOut ? (
              <div className="flex flex-col items-center justify-center gap-1.5 h-28 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center">
                  <ArrowRightFromLine size={17} className="text-gray-500" />
                </div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Checked Out</p>
                <p className="text-base font-mono font-bold text-gray-400">
                  {format(new Date(today.check_out_time), 'hh:mm a')}
                </p>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.975 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                onClick={handleCheckOut}
                disabled={!canCheckOut || checking}
                className={`relative w-full flex flex-col items-center justify-center gap-2 h-28 rounded-2xl text-sm font-semibold border transition-all
                  ${canCheckOut
                    ? 'bg-white/[0.05] border-white/[0.15] text-gray-200 hover:bg-white/[0.09] hover:border-white/[0.25] cursor-pointer'
                    : 'bg-white/[0.02] border-white/[0.05] text-gray-600 cursor-not-allowed'}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${canCheckOut ? 'bg-white/[0.08]' : 'bg-white/[0.04]'}`}>
                  {checking && checkedIn && !checkedOut
                    ? <div className="w-4 h-4 border-2 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" />
                    : <ArrowRightFromLine size={19} />}
                </div>
                {checking && checkedIn && !checkedOut ? 'Checking out…' : 'Mark Check-Out'}
              </motion.button>
            )}
          </div>

          {/* Today status */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Today's Status</p>
            <TodayStatus record={today} />
          </Card>

          {/* Pending Requests */}
          {(() => {
            const CORR_LABELS = {
              forgot_checkin:  { icon: '🔑', label: 'Missed Check-in'  },
              forgot_checkout: { icon: '🚪', label: 'Missed Check-out' },
              wrong_status:    { icon: '📍', label: 'Wrong Status'     },
              other:           { icon: '✏️', label: 'Other Correction' },
            }
            const pendingLeaves = leaves.filter(r => r.status === 'pending')
            const pendingCorrs  = corrections.filter(r => r.status === 'pending')
            const items = [
              ...pendingLeaves.map(r => ({ ...r, _kind: 'leave' })),
              ...pendingCorrs.map(r => ({ ...r, _kind: 'correction' })),
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            if (!items.length) return null
            const shown = items.slice(0, 3)
            const extra = items.length - shown.length
            return (
              <Card className="p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pending Requests</p>
                <div className="flex flex-col gap-2">
                  {shown.map((r, i) => {
                    if (r._kind === 'leave') {
                      const lt = LEAVE_TYPES.find(t => t.value === r.type)
                      const lc = LEAVE_COLORS[r.type] || LEAVE_COLORS.casual
                      const dateStr = r.start_date === r.end_date
                        ? r.start_date
                        : `${r.start_date} → ${r.end_date}`
                      return (
                        <div key={r.id || i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${lc.bg} border ${lc.border}`}>
                          <span className="text-base leading-none shrink-0">{lt?.icon ?? '🗓️'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${lc.text} leading-tight`}>{lt?.label ?? 'Leave Request'}</p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{dateStr}</p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 whitespace-nowrap">⏳ Pending</span>
                        </div>
                      )
                    } else {
                      const cl = CORR_LABELS[r.type] || CORR_LABELS.other
                      return (
                        <div key={r.id || i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                          <span className="text-base leading-none shrink-0">{cl.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-300 leading-tight">{cl.label}</p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{r.date}</p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 whitespace-nowrap">⏳ Pending</span>
                        </div>
                      )
                    }
                  })}
                  {extra > 0 && (
                    <p className="text-[10px] text-gray-600 text-center pt-1">+{extra} more pending</p>
                  )}
                </div>
              </Card>
            )
          })()}

          {/* Attendance score */}
          {passedWD > 0 && (
            <AttendanceScoreCard
              score={score}
              grade={grade}
              consistency={consistency}
              punctuality={punctuality}
              officePresence={officePresence}
              passedWD={passedWD}
              totalWD={totalWD}
              monthName={monthName}
            />
          )}

          {/* Daily motivational quote */}
          <div className="text-center px-6 pb-2">
            <p style={{ fontSize: 13.5, fontStyle: 'italic', lineHeight: 1.75, color: '#64748b', opacity: 0.85 }}>
              "{todayMsg}"
            </p>
          </div>
        </div>
      </div>
  )
}

export default function Dashboard() {
  return <DashboardInner />
}
