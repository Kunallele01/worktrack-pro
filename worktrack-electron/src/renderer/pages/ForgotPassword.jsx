import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { sendPasswordOtp, verifyOtpAndReset } from '../lib/supabase'
import { Page, Button, Input, PasswordInput } from '../components/ui'

export default function ForgotPassword() {
  const [stage, setStage] = useState('email') // email | otp | done
  const [email, setEmail] = useState('')
  const [otp,   setOtp  ] = useState('')
  const [pw,    setPw   ] = useState('')
  const [err,   setErr  ] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendOtp(e) {
    e.preventDefault(); setErr(''); setLoading(true)
    try { await sendPasswordOtp(email); setStage('otp') }
    catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  async function resetPw(e) {
    e.preventDefault(); setErr(''); setLoading(true)
    try { await verifyOtpAndReset(email, otp, pw); setStage('done') }
    catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Page className="flex items-center justify-center min-h-screen bg-surface-900 p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }} className="w-full max-w-sm">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-8 transition-colors">← Back to Sign In</Link>

        <AnimatePresence mode="wait">
          {stage === 'email' && (
            <motion.div key="email" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-2xl font-bold text-gray-50 mb-1">Reset password</h1>
              <p className="text-sm text-gray-400 mb-8">We'll send a 6-digit code to your email.</p>
              <form onSubmit={sendOtp} className="flex flex-col gap-4">
                <Input label="Email Address" type="email" placeholder="you@company.com"
                  value={email} onChange={e => { setEmail(e.target.value); setErr('') }} required />
                {err && <p className="text-sm text-red-400">{err}</p>}
                <Button type="submit" loading={loading} className="w-full h-11">
                  {loading ? 'Sending…' : 'Send Reset Code'}
                </Button>
              </form>
            </motion.div>
          )}
          {stage === 'otp' && (
            <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-2xl font-bold text-gray-50 mb-1">Check your inbox</h1>
              <p className="text-sm text-gray-400 mb-8">Enter the 6-digit code sent to <span className="text-accent-400">{email}</span></p>
              <form onSubmit={resetPw} className="flex flex-col gap-4">
                <Input label="6-Digit Code" placeholder="123456" maxLength={6}
                  value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/,'')); setErr('') }} required />
                <PasswordInput label="New Password" placeholder="Min 8 chars"
                  value={pw} onChange={e => { setPw(e.target.value); setErr('') }} required />
                {err && <p className="text-sm text-red-400">{err}</p>}
                <Button type="submit" loading={loading} className="w-full h-11">
                  {loading ? 'Verifying…' : 'Set New Password'}
                </Button>
              </form>
            </motion.div>
          )}
          {stage === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-gray-50 mb-2">Password updated!</h1>
              <p className="text-sm text-gray-400 mb-8">Sign in with your new password.</p>
              <Link to="/"><Button className="w-full h-11">Back to Sign In</Button></Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Page>
  )
}
