import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { AlertCircle, MapPin, LayoutDashboard, CalendarDays } from 'lucide-react'
import { signIn } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Page, Button, Input, PasswordInput } from '../components/ui'

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

function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const big = 72
  const date = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="text-center select-none">
      <div className="flex items-center justify-center font-mono font-bold text-white leading-none" style={{ letterSpacing: '-3px' }}>
        <OdoDigit d={+hh[0]} size={big} /><OdoDigit d={+hh[1]} size={big} />
        <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          className="text-white/70" style={{ fontSize: big * 0.5, margin: '0 4px' }}>:</motion.span>
        <OdoDigit d={+mm[0]} size={big} /><OdoDigit d={+mm[1]} size={big} />
      </div>
      <div className="flex items-center justify-center font-mono font-light text-white/40 tabular-nums mt-3" style={{ letterSpacing: '-1px' }}>
        <OdoDigit d={+ss[0]} size={34} /><OdoDigit d={+ss[1]} size={34} />
      </div>
      <p className="text-white/50 text-base font-light mt-4">{date}</p>
    </div>
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

const FEATURES = [
  { Icon: MapPin,          title: 'Smart Location',       desc: 'Auto-detects WFH or in-office via WiFi' },
  { Icon: LayoutDashboard, title: 'Real-time Overview',   desc: "See your whole team's status at a glance" },
  { Icon: CalendarDays,    title: 'Leave Management',     desc: 'Apply, track, and approve time-off in one place' },
]

export default function Login() {
  const navigate  = useNavigate()
  const setUser   = useStore(s => s.setUser)
  const [id,  setId ] = useState('')
  const [pw,  setPw ] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!id.trim() || !pw) return
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
    <Page className="flex h-screen">
      {/* Left panel */}
      <div className="relative hidden lg:flex flex-col items-center justify-center w-[55%] overflow-hidden">
        <AmbientSky />
        <div className="relative z-10 flex flex-col items-center gap-10 px-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-2xl bg-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/30">
              <div className="absolute inset-0 rounded-2xl bg-accent-400 blur-lg opacity-50 animate-pulse" />
              <span className="relative text-white font-black text-lg">W</span>
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">WorkTrack Pro</p>
              <p className="text-white/40 text-xs">Attendance Intelligence</p>
            </div>
          </div>

          <LiveClock />

          {/* Feature highlights */}
          <div className="flex flex-col gap-4 w-full max-w-xs">
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.12, duration: 0.5, ease: [0.16,1,0.3,1] }}
                className="flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-accent-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/75 leading-tight">{title}</p>
                  <p className="text-xs text-white/30 leading-snug">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-white/20 text-xs text-center max-w-xs">
            Built for teams who value time — yours and everyone else's.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="auth-divider hidden lg:block w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />

      {/* Right panel */}
      <div className="login-panel flex-1 flex items-center justify-center relative overflow-hidden px-8">
        {/* Subtle background that echoes the left panel */}
        <div className="absolute inset-0" style={{ background: '#0a0e1a' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom right, #0a0e1a, #0a0e1a, rgba(67,56,202,0.14))' }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="rdots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="white"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rdots)"/>
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm relative z-10 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl px-8 py-9
                     shadow-[0_24px_70px_-20px_rgba(0,0,0,0.7)]"
        >
          {/* Logo (mobile only) */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-accent-500 flex items-center justify-center">
              <span className="text-white font-black">W</span>
            </div>
            <p className="font-bold text-gray-100">WorkTrack Pro</p>
          </div>

          <h1 className="text-2xl font-bold text-gray-50 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-400 mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email or Employee ID"
              placeholder="you@company.com or EMP001"
              value={id}
              onChange={e => { setId(e.target.value); setErr('') }}
              autoFocus
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              value={pw}
              onChange={e => { setPw(e.target.value); setErr('') }}
            />

            <div className="flex justify-end -mt-1">
              <Link to="/forgot" className="text-xs text-accent-400 hover:text-accent-300 transition-colors">
                Forgot password?
              </Link>
            </div>

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

            <Button type="submit" loading={loading} className="w-full h-11 mt-1">
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
              Register
            </Link>
          </p>
        </motion.div>
      </div>
    </Page>
  )
}
