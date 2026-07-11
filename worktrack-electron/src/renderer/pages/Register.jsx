import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BadgeCheck, ShieldCheck, Sparkles } from 'lucide-react'
import { signUp } from '../lib/supabase'
import { Page, Button, Input, PasswordInput, Select } from '../components/ui'

// ─── Static data ──────────────────────────────────────────────────────────────

const DEPT_OPTIONS = [{ value: 'RPA', label: 'RPA' }, { value: 'SAP', label: 'SAP' }]

const MONTHS = [
  { value: '01', label: 'January' },   { value: '02', label: 'February' },
  { value: '03', label: 'March' },     { value: '04', label: 'April' },
  { value: '05', label: 'May' },       { value: '06', label: 'June' },
  { value: '07', label: 'July' },      { value: '08', label: 'August' },
  { value: '09', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' },  { value: '12', label: 'December' },
]

const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: THIS_YEAR - 1959 }, (_, i) => ({
  value: String(THIS_YEAR - 16 - i),
  label: String(THIS_YEAR - 16 - i),
}))

function getDaysInMonth(year, month) {
  if (!year || !month) return 31
  const y = parseInt(year, 10), m = parseInt(month, 10)
  if (m === 2) return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(m) ? 30 : 31
}
function buildDays(y, m) {
  return Array.from({ length: getDaysInMonth(y, m) }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'), label: String(i + 1),
  }))
}

// ─── Left panel background — a drifting node network ("join your team") ───────

function NetworkBackground() {
  const cvs = useRef(null)
  useEffect(() => {
    const canvas = cvs.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rand = (a, b) => a + Math.random() * (b - a)
    const LINK = 132
    let raf, last = 0, running = true, W = 0, H = 0, nodes = []

    function makeNodes() {
      const n = Math.max(28, Math.min(64, Math.round((W * H) / 16000)))
      nodes = Array.from({ length: n }, () => ({
        x: rand(0, W), y: rand(0, H), vx: rand(-13, 13), vy: rand(-13, 13),
        r: rand(1.2, 2.6), bright: Math.random() < 0.25,
      }))
    }
    function resize() {
      const b = canvas.getBoundingClientRect(); W = b.width; H = b.height
      canvas.width = W * dpr; canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      makeNodes()
    }
    function draw(t) {
      if (!running) return
      raf = requestAnimationFrame(draw)
      if (t - last < 33) return
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t
      ctx.clearRect(0, 0, W, H)
      for (const p of nodes) {
        p.x += p.vx * dt; p.y += p.vy * dt
        if (p.x < 0) { p.x = 0; p.vx *= -1 } else if (p.x > W) { p.x = W; p.vx *= -1 }
        if (p.y < 0) { p.y = 0; p.vy *= -1 } else if (p.y > H) { p.y = H; p.vy *= -1 }
      }
      // links
      ctx.lineWidth = 1
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = `rgba(139,92,246,${(1 - Math.sqrt(d2) / LINK) * 0.28})`
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          }
        }
      }
      // nodes
      for (const p of nodes) {
        ctx.globalAlpha = p.bright ? 0.9 : 0.5
        ctx.fillStyle = p.bright ? '#c4b5fd' : '#8b5cf6'
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    resize()
    raf = requestAnimationFrame(draw)
    const ro = new ResizeObserver(resize); ro.observe(canvas)
    const onVis = () => { running = !document.hidden; if (running) { last = 0; raf = requestAnimationFrame(draw) } }
    document.addEventListener('visibilitychange', onVis)
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d0a1a] via-[#140d2e] to-[#0a0e1a]" />
      <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.13), transparent 65%)', filter: 'blur(30px)' }} />
      <div className="absolute bottom-1/4 right-1/5 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(79,134,247,0.10), transparent 65%)', filter: 'blur(30px)' }} />
      <canvas ref={cvs} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

// ─── Password strength bar ────────────────────────────────────────────────────

function StrengthBar({ password }) {
  const score = [
    password.length >= 8, /[A-Z]/.test(password), /\d/.test(password),
    password.length >= 12 && /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  const colors  = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500']
  const labels  = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const textCls = ['', 'text-red-400', 'text-amber-400', 'text-blue-400', 'text-emerald-400']

  if (!password) return null
  return (
    <div className="flex items-center gap-2 mt-1.5 relative">
      <div className="flex gap-1 flex-1">
        {[1,2,3,4].map(i => (
          <motion.div key={i}
            className={`h-1 flex-1 rounded-full ${i <= score ? colors[score] : 'bg-white/10'}`}
            animate={{ scaleX: i <= score ? 1 : 0.6, opacity: i <= score ? 1 : 0.4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ originX: 0 }}
          />
        ))}
      </div>
      <span className={`text-xs font-medium w-12 text-right ${textCls[score]}`}>{labels[score]}</span>
      <AnimatePresence>
        {score === 4 && (
          <motion.span key="strong"
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -28, scale: 1.4 }}
            exit={{}}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ position: 'absolute', right: 48, top: -4, fontSize: 16, pointerEvents: 'none' }}
          >💪</motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Left panel feature list ──────────────────────────────────────────────────

const REG_FEATURES = [
  { Icon: BadgeCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', title: 'Employee ID auto-generated',    desc: 'Assigned instantly — no admin action needed' },
  { Icon: ShieldCheck, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20',  title: 'Secure from day one',             desc: 'Email verified, bcrypt-hashed passwords' },
  { Icon: Sparkles,   color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',    title: 'Full dashboard access instantly', desc: 'Check in, view leaves, request corrections' },
]

// ─── Animation helpers ────────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0  },
  transition: { delay, type: 'spring', damping: 22, stiffness: 240 },
})

// ─── Scramble hook ────────────────────────────────────────────────────────────

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$@!%&*'

function useScramble(active, target, durationMs = 750) {
  const [text, setText] = useState(target)
  const interval        = useRef(null)

  useEffect(() => {
    if (!active) { setText(target); return }
    let frame = 0
    const total = durationMs / 35
    interval.current = setInterval(() => {
      frame++
      const progress = frame / total
      setText(
        target.split('').map((ch, i) => {
          if (ch === ' ') return ' '
          return i / target.length < progress
            ? ch
            : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
        }).join('')
      )
      if (frame >= total) clearInterval(interval.current)
    }, 35)
    return () => clearInterval(interval.current)
  }, [active, target])

  return text
}

// ─── Register page ────────────────────────────────────────────────────────────

export default function Register() {
  const navigate = useNavigate()
  const [form,       setForm      ] = useState({ name: '', email: '', dept: '', pw: '', pw2: '' })
  const [bday,       setBday      ] = useState({ year: '', month: '', day: '' })
  const [days,       setDays      ] = useState(buildDays('', ''))
  const [errors,     setErrors    ] = useState({})
  const [formErr,    setFormErr   ] = useState('')
  const [loading,    setLoading   ] = useState(false)
  const [scrambling, setScrambling] = useState(false)

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: undefined })); setFormErr('') }
  const clearErr = k => setErrors(er => ({ ...er, [k]: undefined }))

  useEffect(() => {
    const nd = buildDays(bday.year, bday.month)
    setDays(nd)
    if (bday.day && parseInt(bday.day, 10) > nd.length) setBday(b => ({ ...b, day: '' }))
  }, [bday.year, bday.month])

  const birthday = bday.year && bday.month && bday.day
    ? `${bday.year}-${bday.month}-${bday.day}` : null

  const btnLabel   = loading ? '⚙️  Generating your Employee ID…' : 'Create Account'
  const scrambled  = useScramble(scrambling, 'Create Account')
  const displayBtn = scrambling ? scrambled : btnLabel

  function validate() {
    const e = {}
    if (!form.name.trim())  e.name  = 'Full name is required.'
    if (!form.email.trim()) e.email = 'Email is required.'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = 'Enter a valid email address.'
    if (!form.dept)         e.dept  = 'Select a department.'
    if (!bday.year || !bday.month || !bday.day) e.bday = 'Select your full date of birth.'
    if (!form.pw)                    e.pw = 'Set a password.'
    else if (form.pw.length < 8)     e.pw = 'At least 8 characters.'
    else if (!/[A-Z]/.test(form.pw)) e.pw = 'Add an uppercase letter.'
    else if (!/\d/.test(form.pw))    e.pw = 'Add a number.'
    if (!form.pw2)                 e.pw2 = 'Re-enter your password.'
    else if (form.pw2 !== form.pw) e.pw2 = 'Passwords don’t match.'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormErr('')
    const v = validate()
    setErrors(v)
    if (Object.keys(v).length) return

    setScrambling(true)
    await new Promise(r => setTimeout(r, 820))
    setScrambling(false)

    setLoading(true)
    try {
      await signUp(form.email, form.pw, form.name.trim(), form.dept, birthday)
      navigate('/', { replace: true })
    } catch (e) { setFormErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Page className="flex h-screen">

      {/* ── Left branding panel ── */}
      <div className="relative hidden lg:flex flex-col items-center justify-center w-[42%] overflow-hidden">
        <NetworkBackground />
        <div className="relative z-10 flex flex-col items-center gap-10 px-10 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 self-start">
            <div className="relative w-10 h-10 rounded-2xl bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <div className="absolute inset-0 rounded-2xl bg-violet-400 blur-lg opacity-50 animate-pulse" />
              <span className="relative text-white font-black text-lg">W</span>
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">WorkTrack Pro</p>
              <p className="text-white/40 text-xs">Attendance Intelligence</p>
            </div>
          </div>

          {/* Headline */}
          <div className="self-start">
            <h2 className="text-3xl font-black text-white leading-tight mb-2">
              Join your team<br />in minutes.
            </h2>
            <p className="text-white/35 text-sm leading-relaxed max-w-xs">
              One account. Full attendance tracking, leave management, and real-time insights — ready from day one.
            </p>
          </div>

          {/* Feature list */}
          <div className="flex flex-col gap-4 w-full">
            {REG_FEATURES.map(({ Icon, color, bg, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.5, ease: [0.16,1,0.3,1] }}
                className="flex items-center gap-3"
              >
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon size={16} className={color} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/80 leading-tight">{title}</p>
                  <p className="text-xs text-white/30 leading-snug">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-white/15 text-xs text-center self-start">
            Your data is encrypted and never shared.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="auth-divider hidden lg:block w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />

      {/* ── Right form panel ── */}
      <div className="login-panel flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Background — hardcoded dark so light-mode theme doesn't bleed through */}
        <div className="absolute inset-0" style={{ background: '#0a0e1a' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom right, #0a0e1a, #0a0e1a, rgba(109,40,217,0.12))' }} />

        <div className="w-full max-w-sm relative z-10 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl
                        shadow-[0_24px_70px_-20px_rgba(0,0,0,0.7)] px-8 py-8 overflow-y-auto max-h-[calc(100vh-2.5rem)]">

          {/* Header */}
          <motion.div {...fadeUp(0.05)} className="mb-5">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-4 transition-colors">
              ← Back to Sign In
            </Link>
            <h1 className="text-2xl font-bold text-gray-50 mb-0.5">Create your account</h1>
            <p className="text-xs text-gray-500">
              Employee ID auto-generated · All fields required
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">

            {/* Name */}
            <motion.div {...fadeUp(0.12)}>
              <Input label="Full Name" placeholder="Your full name"
                value={form.name} onChange={set('name')} error={errors.name} />
            </motion.div>

            {/* Email + Department */}
            <motion.div {...fadeUp(0.19)} className="grid grid-cols-2 gap-3">
              <Input label="Email" type="email" placeholder="you@company.com"
                value={form.email} onChange={set('email')} error={errors.email} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Department <span className="text-red-400">*</span>
                </label>
                <Select value={form.dept}
                  onChange={v => { setForm(f => ({...f, dept: v})); clearErr('dept'); setFormErr('') }}
                  options={DEPT_OPTIONS} placeholder="Select…"
                  className={errors.dept ? 'ring-1 ring-red-500/50 rounded-xl' : ''} />
                {errors.dept && <p className="text-xs text-red-400">{errors.dept}</p>}
              </div>
            </motion.div>

            {/* Date of Birth */}
            <motion.div {...fadeUp(0.26)} className="flex flex-col gap-1.5" style={{ position: 'relative' }}>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Date of Birth <span className="text-red-400">*</span>
                <span className="text-gray-600 font-normal normal-case ml-1.5">— year → month → day</span>
              </label>
              <div className={`grid grid-cols-3 gap-2 ${errors.bday ? 'rounded-xl ring-1 ring-red-500/50 p-0.5' : ''}`}>
                <Select value={bday.year}
                  onChange={v => { setBday(b => ({ ...b, year: v, day: '' })); clearErr('bday') }}
                  options={YEARS} placeholder="Year" />
                <Select value={bday.month}
                  onChange={v => { setBday(b => ({ ...b, month: v, day: '' })); clearErr('bday') }}
                  options={MONTHS} placeholder="Month" />
                <Select value={bday.day}
                  onChange={v => { setBday(b => ({ ...b, day: v })); clearErr('bday') }}
                  options={days} placeholder="Day" />
              </div>
              {errors.bday && <p className="text-xs text-red-400">{errors.bday}</p>}
              <AnimatePresence>
                {birthday && (
                  <motion.span key={birthday}
                    initial={{ opacity: 1, y: 0, scale: 0.7 }}
                    animate={{ opacity: 0, y: -40, scale: 1.6 }}
                    exit={{}}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{ position: 'absolute', right: 0, bottom: 8, fontSize: 20, pointerEvents: 'none' }}
                  >🎂</motion.span>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Password + Confirm */}
            <motion.div {...fadeUp(0.33)} className="grid grid-cols-2 gap-3 items-start">
              <div>
                <PasswordInput label="Password" placeholder="Min 8 chars"
                  value={form.pw} onChange={set('pw')} error={errors.pw} />
                {!errors.pw && <StrengthBar password={form.pw} />}
              </div>
              <PasswordInput label="Confirm Password" placeholder="Repeat"
                value={form.pw2} onChange={set('pw2')} error={errors.pw2} />
            </motion.div>

            {/* General / server error */}
            <AnimatePresence>
              {formErr && (
                <motion.p
                  key={formErr}
                  initial={{ opacity: 0, y: -4, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"
                >{formErr}</motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.div {...fadeUp(0.4)}>
              <motion.button
                type="submit"
                disabled={loading || scrambling}
                whileHover={!loading && !scrambling ? { scale: 1.015 } : {}}
                whileTap={!loading && !scrambling ? { scale: 0.97 } : {}}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-full h-10 mt-0.5 btn-primary font-mono tracking-wide text-sm"
              >
                {displayBtn}
              </motion.button>
            </motion.div>
          </form>

          <motion.p {...fadeUp(0.46)} className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link to="/" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">Sign In</Link>
          </motion.p>
        </div>
      </div>
    </Page>
  )
}
