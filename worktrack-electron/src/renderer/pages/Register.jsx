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

// ─── Left panel background ────────────────────────────────────────────────────

function MeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d0a1a] via-[#120d28] to-[#0a0e1a]" />
      <motion.div
        animate={{ x: [0, -25, 0], y: [0, 20, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/3 left-1/3 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, 20, 0], y: [0, -25, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-accent-600/15 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-pink-500/8 rounded-full blur-2xl"
      />
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="rdots2" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="white"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rdots2)"/>
      </svg>
    </div>
  )
}

// ─── Floating particles (right panel) ────────────────────────────────────────

const PARTICLE_COLORS = ['#4f86f7', '#a78bfa', '#f472b6', '#34d399', '#fbbf24']

function FloatingParticles() {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    class P {
      constructor(initial) { this.reset(initial) }
      reset(initial) {
        this.x    = Math.random() * canvas.width
        this.y    = initial ? Math.random() * canvas.height : canvas.height + 10
        this.r    = 1.5 + Math.random() * 3.5
        this.col  = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]
        this.vy   = -(0.3 + Math.random() * 0.5)
        this.osc  = Math.random() * 0.018
        this.oscX = Math.random() * Math.PI * 2
        this.op   = 0.18 + Math.random() * 0.22
        this.rot  = Math.random() * Math.PI * 2
        this.rotV = (Math.random() - 0.5) * 0.008
        this.sq   = Math.random() > 0.7
      }
      step() {
        this.y    += this.vy
        this.oscX += this.osc
        this.x    += Math.sin(this.oscX) * 0.5
        this.rot  += this.rotV
        if (this.y < -20) this.reset(false)
      }
      draw() {
        ctx.save()
        ctx.globalAlpha = this.op
        ctx.fillStyle   = this.col
        ctx.translate(this.x, this.y)
        ctx.rotate(this.rot)
        if (this.sq) { ctx.fillRect(-this.r, -this.r, this.r * 2, this.r * 2) }
        else { ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill() }
        ctx.restore()
      }
    }

    const particles = Array.from({ length: 32 }, () => new P(true))
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => { p.step(); p.draw() })
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0,
    }} />
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
  const [err,        setErr       ] = useState('')
  const [loading,    setLoading   ] = useState(false)
  const [scrambling, setScrambling] = useState(false)

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErr('') }

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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim())       { setErr('Full name is required.'); return }
    if (!form.email.trim())      { setErr('Email address is required.'); return }
    if (!form.dept)              { setErr('Please select your department.'); return }
    if (!bday.year)              { setErr('Please select your birth year.'); return }
    if (!bday.month)             { setErr('Please select your birth month.'); return }
    if (!bday.day)               { setErr('Please select your birth day.'); return }
    if (!form.pw)                { setErr('Please set a password.'); return }
    if (form.pw.length < 8)      { setErr('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(form.pw)) { setErr('Must contain at least one uppercase letter.'); return }
    if (!/\d/.test(form.pw))    { setErr('Must contain at least one number.'); return }
    if (form.pw !== form.pw2)   { setErr('Passwords do not match.'); return }

    setScrambling(true)
    await new Promise(r => setTimeout(r, 820))
    setScrambling(false)

    setLoading(true)
    try {
      await signUp(form.email, form.pw, form.name.trim(), form.dept, birthday)
      navigate('/', { replace: true })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Page className="flex h-screen">

      {/* ── Left branding panel ── */}
      <div className="relative hidden lg:flex flex-col items-center justify-center w-[42%] overflow-hidden">
        <MeshBackground />
        <div className="relative z-10 flex flex-col items-center gap-10 px-10 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 self-start">
            <div className="w-10 h-10 rounded-2xl bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <span className="text-white font-black text-lg">W</span>
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
      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-surface-900" />
        <div className="absolute inset-0 bg-gradient-to-br from-surface-900 via-surface-900 to-violet-950/15 pointer-events-none" />
        <FloatingParticles />

        <div className="w-full max-w-sm relative z-10 px-8 py-8 overflow-y-auto max-h-screen">

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

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            {/* Name */}
            <motion.div {...fadeUp(0.12)}>
              <Input label="Full Name" placeholder="Your full name"
                value={form.name} onChange={set('name')} required />
            </motion.div>

            {/* Email + Department */}
            <motion.div {...fadeUp(0.19)} className="grid grid-cols-2 gap-3">
              <Input label="Email" type="email" placeholder="you@company.com"
                value={form.email} onChange={set('email')} required />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Department <span className="text-red-400">*</span>
                </label>
                <Select value={form.dept}
                  onChange={v => { setForm(f => ({...f, dept: v})); setErr('') }}
                  options={DEPT_OPTIONS} placeholder="Select…" />
              </div>
            </motion.div>

            {/* Date of Birth */}
            <motion.div {...fadeUp(0.26)} className="flex flex-col gap-1.5" style={{ position: 'relative' }}>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Date of Birth <span className="text-red-400">*</span>
                <span className="text-gray-600 font-normal normal-case ml-1.5">— year → month → day</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={bday.year}
                  onChange={v => setBday(b => ({ ...b, year: v, day: '' }))}
                  options={YEARS} placeholder="Year" />
                <Select value={bday.month}
                  onChange={v => setBday(b => ({ ...b, month: v, day: '' }))}
                  options={MONTHS} placeholder="Month" />
                <Select value={bday.day}
                  onChange={v => setBday(b => ({ ...b, day: v }))}
                  options={days} placeholder="Day" />
              </div>
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
            <motion.div {...fadeUp(0.33)} className="grid grid-cols-2 gap-3">
              <div>
                <PasswordInput label="Password" placeholder="Min 8 chars"
                  value={form.pw} onChange={set('pw')} required />
                <StrengthBar password={form.pw} />
              </div>
              <PasswordInput label="Confirm Password" placeholder="Repeat"
                value={form.pw2} onChange={set('pw2')} required />
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {err && (
                <motion.p
                  key={err}
                  initial={{ opacity: 0, y: -4, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"
                >{err}</motion.p>
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
