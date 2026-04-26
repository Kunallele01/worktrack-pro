import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, AlertCircle } from 'lucide-react'
import { signIn } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Page, Button, Input, PasswordInput } from '../components/ui'

function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const h = String(time.getHours()).padStart(2, '0')
  const m = String(time.getMinutes()).padStart(2, '0')
  const s = String(time.getSeconds()).padStart(2, '0')
  const date = time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="text-center select-none">
      <div className="font-mono font-bold text-white leading-none mb-2" style={{ fontSize: 72, letterSpacing: '-4px' }}>
        <span>{h}</span>
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-1"
        >:</motion.span>
        <span>{m}</span>
      </div>
      <p className="font-mono text-4xl font-light text-white/40 tabular-nums mb-5">{s}</p>
      <p className="text-white/60 text-base font-light">{date}</p>
    </div>
  )
}

// Animated mesh gradient background
function MeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e1a] via-[#0d1628] to-[#0a0e1a]" />
      {/* Orbs */}
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-600/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-600/15 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-accent-500/10 rounded-full blur-2xl"
      />
      {/* Grid dots */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="white"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)"/>
      </svg>
    </div>
  )
}

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
      // Register tray icon now that we're logged in
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
        <MeshBackground />
        <div className="relative z-10 flex flex-col items-center gap-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-accent-500 flex items-center justify-center">
              <LogIn size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">WorkTrack Pro</p>
              <p className="text-white/40 text-xs">Attendance Intelligence</p>
            </div>
          </div>
          <LiveClock />
          <p className="text-white/30 text-sm max-w-xs text-center mt-4">
            Built for teams who value time — yours and everyone else's.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-surface-900 px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          {/* Logo (mobile) */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-accent-500 flex items-center justify-center">
              <LogIn size={16} className="text-white" />
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
