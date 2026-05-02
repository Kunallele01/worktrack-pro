import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { signUp } from '../lib/supabase'
import { Page, Button, Input, PasswordInput, Select } from '../components/ui'

// ─── Static data ─────────────────────────────────────────────────────────────

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

// ─── Floating particles background ──────────────────────────────────────────
const PARTICLE_COLORS = ['#4f86f7', '#a78bfa', '#f472b6', '#34d399', '#fbbf24']

function FloatingParticles() {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    class P {
      constructor(initial) { this.reset(initial) }
      reset(initial) {
        this.x    = Math.random() * canvas.width
        this.y    = initial ? Math.random() * canvas.height : canvas.height + 10
        this.r    = 2 + Math.random() * 5
        this.col  = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]
        this.vy   = -(0.25 + Math.random() * 0.45)
        this.osc  = Math.random() * 0.018
        this.oscX = Math.random() * Math.PI * 2
        this.op   = 0.04 + Math.random() * 0.07
        this.rot  = Math.random() * Math.PI * 2
        this.rotV = (Math.random() - 0.5) * 0.008
        this.sq   = Math.random() > 0.65
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

    const particles = Array.from({ length: 28 }, () => new P(true))
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
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.55,
    }} />
  )
}

// ─── Text scramble hook (used on the submit button) ──────────────────────────
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

// ─── Password strength bar with celebration ───────────────────────────────────
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

      {/* 💪 micro-celebration when hitting Strong */}
      <AnimatePresence>
        {score === 4 && (
          <motion.span key="strong-emoji"
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

// ─── Framer-motion helpers ────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0  },
  transition: { delay, type: 'spring', damping: 22, stiffness: 240 },
})

// ─── Register page ────────────────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate()
  const [form,       setForm      ] = useState({ name: '', email: '', dept: '', pw: '', pw2: '' })
  const [bday,       setBday      ] = useState({ year: '', month: '', day: '' })
  const [days,       setDays      ] = useState(buildDays('', ''))
  const [err,        setErr       ] = useState('')
  const [loading,    setLoading   ] = useState(false)
  const [scrambling, setScrambling] = useState(false)
  const [prevBday,   setPrevBday  ] = useState(null)  // tracks DOB completion for 🎂

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErr('') }

  useEffect(() => {
    const nd = buildDays(bday.year, bday.month)
    setDays(nd)
    if (bday.day && parseInt(bday.day, 10) > nd.length) setBday(b => ({ ...b, day: '' }))
  }, [bday.year, bday.month])

  const birthday = bday.year && bday.month && bday.day
    ? `${bday.year}-${bday.month}-${bday.day}` : null

  // Detect when DOB becomes fully complete (fire 🎂 once per complete)
  useEffect(() => {
    if (birthday && birthday !== prevBday) setPrevBday(birthday)
  }, [birthday])

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

    // Scramble animation before the actual API call
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
    <Page className="flex items-center justify-center min-h-screen bg-surface-900 px-8 py-4" style={{ position: 'relative' }}>
      {/* Ambient floating particles */}
      <FloatingParticles />

      <div className="w-full max-w-md" style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <motion.div {...fadeUp(0.05)}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-3 transition-colors">
            ← Back to Sign In
          </Link>
          <h1 className="text-2xl font-bold text-gray-50 mb-0.5">Create your account</h1>
          <p className="text-xs text-gray-500 mb-4">
            Employee ID auto-generated · Welcome email sent on signup · All fields required
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
              <span className="text-gray-600 font-normal normal-case ml-1.5">— year first, then month, then day</span>
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

            {/* 🎂 floats up when DOB is complete */}
            <AnimatePresence>
              {birthday && (
                <motion.span key={birthday}
                  initial={{ opacity: 1, y: 0, scale: 0.7, x: 0 }}
                  animate={{ opacity: 0, y: -40, scale: 1.6, x: 10 }}
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

          {/* Submit button */}
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
    </Page>
  )
}
