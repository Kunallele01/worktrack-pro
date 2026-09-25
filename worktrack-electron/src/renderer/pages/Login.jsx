import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { AlertCircle } from 'lucide-react'
import { signIn } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Page, Button, Input, PasswordInput } from '../components/ui'
import BrandMark from '../components/BrandMark'
import { LAUNCH_QUOTE } from '../lib/quotes'

// ── Odometer digit (rolls to its value) ─────────────────────────────────────
function OdoDigit({ d, size }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) gsap.to(ref.current, { yPercent: -d * 10, duration: 0.55, ease: 'power3.out' })
  }, [d])
  return (
    <span style={{ height: size, width: size * 0.6, overflow: 'hidden', display: 'inline-block' }}>
      <span ref={ref} style={{ display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} style={{ height: size, lineHeight: `${size}px`, fontSize: size, textAlign: 'center' }}>{n}</span>
        ))}
      </span>
    </span>
  )
}

// The day is the headline; the time is a supporting detail. No seconds — an
// orphaned counter on a login screen reads as a bug, not a feature.
function DateBlock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const size = 26

  return (
    <div className="select-none">
      <motion.p
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-white font-light tracking-[-0.03em] leading-[0.95]"
        style={{ fontSize: 'clamp(3rem, 5.2vw, 4.75rem)' }}
      >
        {now.toLocaleDateString('en-IN', { weekday: 'long' })}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-baseline gap-3 mt-4"
      >
        <p className="text-white/45 text-lg font-light tracking-wide">
          {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <span className="w-1 h-1 rounded-full bg-white/20 self-center" />
        <div className="flex items-center font-mono text-white/45 tabular-nums" style={{ letterSpacing: '-0.5px' }}>
          <OdoDigit d={+hh[0]} size={size} /><OdoDigit d={+hh[1]} size={size} />
          <span className="text-white/25" style={{ fontSize: size * 0.8, margin: '0 1px' }}>:</span>
          <OdoDigit d={+mm[0]} size={size} /><OdoDigit d={+mm[1]} size={size} />
        </div>
      </motion.div>
    </div>
  )
}

// A horizon to sit the sky on. Without it the scene has no floor and the lower
// half reads as empty rather than open. Deterministic, so it never reflows.
function Skyline({ phase, seed = 20260925, className = '', height = '38%' }) {
  const buildings = React.useMemo(() => {
    let s = seed
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const out = []
    let x = -40
    while (x < 1200) {
      const w = 38 + rnd() * 76
      const h = 60 + rnd() * 190
      const win = []
      const cols = Math.max(1, Math.floor(w / 22))
      const rows = Math.max(1, Math.floor(h / 26))
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rnd() > 0.62) win.push({ x: x + 9 + c * 22, y: 300 - h + 14 + r * 26, lit: rnd() > 0.45 })
        }
      }
      out.push({ x, w, h, win })
      x += w + 3 + rnd() * 16
    }
    return out
  }, [seed])

  const glow = phase === 'day' ? 'rgba(190,215,255,0.5)' : '#FFA637'

  return (
    <svg viewBox="0 0 1200 300" preserveAspectRatio="none"
      style={{ height }}
      className={`absolute bottom-0 left-0 w-full pointer-events-none select-none ${className}`}>
      <defs>
        <linearGradient id="bldg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0b1120" />
          <stop offset="100%" stopColor="#050810" />
        </linearGradient>
      </defs>
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={300 - b.h} width={b.w} height={b.h} fill="url(#bldg)" />
          <rect x={b.x} y={300 - b.h} width={b.w} height="1" fill="rgba(255,255,255,0.05)" />
          {b.win.map((w, j) => (
            <rect key={j} x={w.x} y={w.y} width="7" height="11" rx="1"
              fill={w.lit ? glow : 'rgba(255,255,255,0.035)'}
              opacity={w.lit ? 0.45 + (j % 5) * 0.11 : 1}
              style={w.lit ? { filter: `drop-shadow(0 0 3px ${glow})` } : undefined} />
          ))}
        </g>
      ))}
    </svg>
  )
}

// ── Time-of-day sky (login has no location/weather — system clock only) ──────
const LSKY = {
  night: ['#05070f', '#0a1024', '#0f1a33'],
  dawn:  ['#141230', '#33244a', '#6b4a58'],
  day:   ['#0c2138', '#163a5c', '#21507a'],
  dusk:  ['#161029', '#3a2442', '#6e3f48'],
}
const LGLOW = {
  night: 'rgba(180,205,255,0.16)', dawn: 'rgba(255,180,140,0.28)',
  day:   'rgba(255,228,180,0.24)', dusk: 'rgba(255,150,110,0.28)',
}
function loginSky(now) {
  const mins = now.getHours() * 60 + now.getMinutes()
  const SR = 360, SS = 1110, W = 60 // fixed 6:00 / 18:30 anchors — no location available
  let phase
  if (mins < SR - W || mins > SS + W) phase = 'night'
  else if (mins < SR + W) phase = 'dawn'
  else if (mins > SS - W) phase = 'dusk'
  else phase = 'day'
  const sunT = Math.max(0, Math.min(1, (mins - SR) / (SS - SR)))
  return { phase, sunT, isNight: phase === 'night' }
}

function AmbientSky() {
  const cvs = useRef(null)
  const [sky, setSky] = useState(() => loginSky(new Date()))
  useEffect(() => { const t = setInterval(() => setSky(loginSky(new Date())), 30000); return () => clearInterval(t) }, [])

  const pal  = LSKY[sky.phase]
  const sunX = 8 + sky.sunT * 84
  const sunY = sky.isNight ? 18 : 30 - Math.sin(sky.sunT * Math.PI) * 18
  const disc = sky.isNight ? '#e7edf9' : sky.phase === 'day' ? '#ffe4a0' : '#ffb277'
  const dsz  = sky.isNight ? 46 : 64

  useEffect(() => {
    const canvas = cvs.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rand = (a, b) => a + Math.random() * (b - a)
    const phase = sky.phase
    let raf, last = 0, running = true, W = 0, H = 0
    let stars = [], clouds = [], shoot = null, shootTimer = rand(4, 10)

    function makeStars() {
      stars = phase !== 'day'
        ? Array.from({ length: 160 }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(0.4, 1.8), p: rand(0, 6.28), s: rand(0.6, 2.2), b: rand(0.4, 1) }))
        : []
    }
    function makeClouds() {
      clouds = []
      for (let i = 0; i < 3; i++) clouds.push({ x: rand(0, W), y: rand(H * 0.08, H * 0.4), w: rand(160, 300), h: rand(20, 40), v: rand(6, 14), a: rand(0.04, 0.08) })
    }
    function resize() {
      const r = canvas.getBoundingClientRect(); W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      makeStars(); makeClouds()
    }
    function draw(t) {
      if (!running) return
      raf = requestAnimationFrame(draw)
      if (t - last < 33) return
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t
      ctx.clearRect(0, 0, W, H)

      for (const s of stars) {
        s.p += dt * s.s
        ctx.globalAlpha = (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(s.p))) * s.b
        ctx.fillStyle = '#dbe6ff'
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill()
      }
      ctx.globalAlpha = 1

      if (phase !== 'day') {
        shootTimer -= dt
        if (!shoot && shootTimer <= 0) {
          // Random direction (left/right), angle and speed each time
          const dir = Math.random() < 0.5 ? 1 : -1
          const ang = rand(0.35, 1.2)          // ~20°–69° below horizontal
          const spd = rand(320, 480)
          shoot = {
            x: dir === 1 ? rand(0, W * 0.55) : rand(W * 0.45, W),
            y: rand(0, H * 0.5),
            vx: Math.cos(ang) * spd * dir,
            vy: Math.sin(ang) * spd,
            life: 1,
          }
          shootTimer = rand(6, 14)
        }
        if (shoot) {
          const tx = shoot.x - shoot.vx * 0.12, ty = shoot.y - shoot.vy * 0.12
          const g = ctx.createLinearGradient(shoot.x, shoot.y, tx, ty)
          g.addColorStop(0, `rgba(255,255,255,${0.85 * shoot.life})`); g.addColorStop(1, 'transparent')
          ctx.strokeStyle = g; ctx.lineWidth = 2
          ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(tx, ty); ctx.stroke()
          shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt; shoot.life -= dt * 0.7
          if (shoot.life <= 0 || shoot.x < -60 || shoot.x > W + 60 || shoot.y > H + 60) shoot = null
        }
      }

      const cc = phase === 'night' ? '#4a5876' : phase === 'day' ? '#cdd8e8' : '#d0bebc'
      ctx.filter = 'blur(14px)'; ctx.fillStyle = cc
      for (const c of clouds) {
        ctx.globalAlpha = c.a
        ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, 6.283); ctx.fill()
        ctx.beginPath(); ctx.ellipse(c.x - c.w * 0.3, c.y - c.h * 0.4, c.w * 0.5, c.h * 0.8, 0, 0, 6.283); ctx.fill()
        c.x += c.v * dt
        if (c.x - c.w > W) { c.x = -c.w; c.y = rand(H * 0.08, H * 0.4) }
      }
      ctx.filter = 'none'; ctx.globalAlpha = 1
    }

    resize()
    raf = requestAnimationFrame(draw)
    const ro = new ResizeObserver(resize); ro.observe(canvas)
    const onVis = () => { running = !document.hidden; if (running) { last = 0; raf = requestAnimationFrame(draw) } }
    document.addEventListener('visibilitychange', onVis)
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [sky.phase])

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: `linear-gradient(165deg, ${pal[0]}, ${pal[1]} 55%, ${pal[2]})`, transition: 'background 3s ease' }} />
      {/* Horizon glow near the bottom */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: '42%', background: `linear-gradient(to top, ${LGLOW[sky.phase]}, transparent)`, opacity: sky.isNight ? 0.4 : 1, transition: 'background 3s ease' }} />
      {/* Sun / moon with wide glow */}
      <div className="absolute pointer-events-none" style={{ left: `${sunX}%`, top: `${sunY}%`, width: 0, height: 0 }}>
        <div className="absolute rounded-full" style={{ width: 360, height: 360, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${LGLOW[sky.phase]} 0%, transparent 62%)` }} />
        <div className="absolute rounded-full" style={{ width: dsz, height: dsz, transform: 'translate(-50%,-50%)', background: disc, boxShadow: `0 0 55px 14px ${disc}55` }} />
      </div>
      {/* Particles: stars, shooting stars, drifting clouds */}
      <canvas ref={cvs} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
      {/* Faint dot texture */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="ldots" x="0" y="0" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="white"/></pattern></defs>
        <rect width="100%" height="100%" fill="url(#ldots)"/>
      </svg>
    </div>
  )
}

// Right panel echoes the sky's current phase so both halves share one light source
const PHASE_TINT = {
  night: 'rgba(96,150,255,0.10)',
  dawn:  'rgba(255,170,130,0.11)',
  day:   'rgba(120,170,235,0.10)',
  dusk:  'rgba(255,140,100,0.11)',
}
// Hairline top edge on the glass card, "lit" by the sky beside it
const PHASE_EDGE = {
  night: 'rgba(150,190,255,0.35)',
  dawn:  'rgba(255,185,150,0.40)',
  day:   'rgba(170,205,250,0.35)',
  dusk:  'rgba(255,160,120,0.40)',
}

// Staggered entrance for the form contents (matches Register's cascade)
const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0  },
  transition: { delay, type: 'spring', damping: 22, stiffness: 240 },
})

export default function Login() {
  const navigate  = useNavigate()
  const setUser   = useStore(s => s.setUser)
  const [id,  setId ] = useState('')
  const [pw,  setPw ] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState(() => loginSky(new Date()).phase)

  // Track the sky phase so the right panel's tint follows it
  useEffect(() => {
    const t = setInterval(() => setPhase(loginSky(new Date()).phase), 60000)
    return () => clearInterval(t)
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!id.trim() || !pw) { setErr('Enter your email or Employee ID and password.'); return }
    setErr(''); setLoading(true)
    try {
      const profile = await signIn(id, pw)
      setUser(profile)
      window.api?.createTray()
      navigate(profile.is_admin ? '/admin' : '/dashboard', { replace: true })
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Page className="relative flex h-screen overflow-hidden">
      {/* One scene across the whole window — no panel behind the card, so the
          sky and the city run unbroken from edge to edge. */}
      <div className="absolute inset-0 pointer-events-none">
        <AmbientSky />
        <Skyline phase={phase} height="34%" />
        {/* Deepen the base so type and card always have something solid behind them */}
        <div className="absolute bottom-0 inset-x-0 h-1/2"
          style={{ background: 'linear-gradient(to top, rgba(3,6,14,0.92), transparent)' }} />
      </div>

      {/* Left column — content only; the scene behind it is shared */}
      <div className="relative hidden lg:flex w-[62%]">

        <div className="relative z-10 flex flex-col justify-between w-full px-16 py-14">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3"
          >
            <BrandMark size={50} />
            <div>
              <p className="text-white font-semibold text-lg leading-tight tracking-tight">WorkTrack Pro</p>
              <p className="text-white/35 text-xs tracking-wide">Attendance Intelligence</p>
            </div>
          </motion.div>

          {/* Weight sits low against the horizon, sky breathes above it */}
          <div className="flex items-end gap-5">
            <motion.span
              initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
              transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-px self-stretch origin-bottom shrink-0"
              style={{ background: 'linear-gradient(to top, rgba(79,134,247,0.55), transparent)' }}
            />
            <div>
              <DateBlock />
              <motion.figure
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="mt-8 max-w-[26rem]"
              >
                <blockquote className="text-white/55 text-sm leading-relaxed italic">
                  “{LAUNCH_QUOTE.text}”
                </blockquote>
                <figcaption className="text-white/30 text-xs mt-2 not-italic tracking-wide">
                  — {LAUNCH_QUOTE.author}
                </figcaption>
              </motion.figure>
            </div>
          </div>
        </div>
      </div>

      {/* Right column — the card sits directly on the shared scene */}
      <div className="login-panel flex-1 flex items-center justify-center relative px-8">
        {/* Only a soft pool of light under the card, so it separates from the
            city without a panel edge */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(52% 46% at 50% 48%, rgba(3,6,14,0.82), transparent 72%)` }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[24rem] relative z-10 rounded-2xl border border-white/[0.14] bg-white/[0.07] backdrop-blur-2xl px-8 py-8
                     shadow-[0_40px_90px_-28px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.04)_inset] overflow-hidden"
        >
          {/* Hairline top edge lit by the sky's phase colour */}
          <div className="absolute top-0 inset-x-6 h-px pointer-events-none"
            style={{ background: `linear-gradient(90deg, transparent, ${PHASE_EDGE[phase]}, transparent)`, transition: 'background 3s ease' }} />

          {/* Logo (mobile only) */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-accent-500 flex items-center justify-center">
              <span className="text-white font-black">W</span>
            </div>
            <p className="font-bold text-gray-100">WorkTrack Pro</p>
          </div>

          <motion.div {...fadeUp(0.10)}>
            <h1 className="text-[1.6rem] font-semibold text-white tracking-tight leading-none">{greeting}</h1>
            <p className="text-sm text-white/40 mt-2 mb-7">Sign in to continue</p>
          </motion.div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
            <motion.div {...fadeUp(0.18)}>
              <Input
                label="Email or Employee ID"
                placeholder="you@company.com or EMP001"
                value={id}
                onChange={e => { setId(e.target.value); setErr('') }}
                autoFocus
              />
            </motion.div>
            <motion.div {...fadeUp(0.26)}>
              <PasswordInput
                label="Password"
                placeholder="Your password"
                value={pw}
                onChange={e => { setPw(e.target.value); setErr('') }}
              />
            </motion.div>

            <motion.div {...fadeUp(0.32)} className="flex justify-end -mt-1.5">
              <Link to="/forgot" className="text-xs text-white/35 hover:text-white/70 transition-colors">
                Forgot password?
              </Link>
            </motion.div>

            {err && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{err}</span>
              </motion.div>
            )}

            <motion.div {...fadeUp(0.38)}>
              <Button type="submit" loading={loading}
                className="w-full h-11 mt-1.5 shadow-[0_8px_24px_-6px_rgba(79,134,247,0.6)]">
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </motion.div>
          </form>

          {/* Kept quiet on purpose — it shouldn't compete with the primary action */}
          <motion.p {...fadeUp(0.46)} className="text-center text-xs text-white/30 mt-7">
            Don't have an account?{' '}
            <Link to="/register" className="text-white/60 hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white/60 transition-colors">
              Register
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </Page>
  )
}
