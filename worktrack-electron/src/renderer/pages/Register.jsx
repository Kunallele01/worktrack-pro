import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { signUp } from '../lib/supabase'
import { Page, Button, Input, PasswordInput, Select } from '../components/ui'

const DEPT_OPTIONS = [{ value: 'RPA', label: 'RPA' }, { value: 'SAP', label: 'SAP' }]

const MONTHS = [
  { value: '01', label: 'January' },   { value: '02', label: 'February' },
  { value: '03', label: 'March' },     { value: '04', label: 'April' },
  { value: '05', label: 'May' },       { value: '06', label: 'June' },
  { value: '07', label: 'July' },      { value: '08', label: 'August' },
  { value: '09', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' },  { value: '12', label: 'December' },
]
const DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: String(i + 1),
}))
const YEAR_END = new Date().getFullYear() - 16
const YEARS = Array.from({ length: YEAR_END - 1959 }, (_, i) => {
  const y = YEAR_END - i
  return { value: String(y), label: String(y) }
})

function StrengthBar({ password }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /\d/.test(password),
    password.length >= 12 && /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  const labels  = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors  = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500']
  const textCls = ['', 'text-red-400', 'text-amber-400', 'text-blue-400', 'text-emerald-400']

  if (!password) return null
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex gap-1 flex-1">
        {[1,2,3,4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-white/10'}`} />
        ))}
      </div>
      <span className={`text-xs font-medium w-12 text-right ${textCls[score]}`}>{labels[score]}</span>
    </div>
  )
}

export default function Register() {
  const navigate  = useNavigate()
  const [form, setForm] = useState({ emp_id: '', name: '', email: '', dept: '', pw: '', pw2: '' })
  const [bday, setBday] = useState({ month: '', day: '', year: '' })
  const [err,  setErr ] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErr('') }

  const birthday = (bday.month && bday.day && bday.year)
    ? `${bday.year}-${bday.month}-${bday.day}`
    : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.dept)  { setErr('Please select your department.'); return }
    if (!birthday)   { setErr('Please select your date of birth.'); return }
    if (form.pw !== form.pw2) { setErr('Passwords do not match.'); return }
    setLoading(true)
    try {
      await signUp(form.email, form.pw, form.emp_id, form.name, form.dept, birthday)
      navigate('/', { replace: true })
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Page className="flex items-center justify-center min-h-screen bg-surface-900 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-8 transition-colors">
          ← Back to Sign In
        </Link>
        <h1 className="text-2xl font-bold text-gray-50 mb-1">Create your account</h1>
        <p className="text-sm text-gray-400 mb-8">Join your team on WorkTrack Pro</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Employee ID" placeholder="EMP001" value={form.emp_id} onChange={set('emp_id')} required />
            <Input label="Full Name"   placeholder="Your name" value={form.name}   onChange={set('name')}   required />
          </div>
          <Input label="Email Address" type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Department</label>
            <Select value={form.dept} onChange={v => setForm(f => ({...f, dept: v}))} options={DEPT_OPTIONS} placeholder="Select department…" />
          </div>

          {/* Birthday */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Date of Birth <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Select
                value={bday.month}
                onChange={v => setBday(b => ({ ...b, month: v }))}
                options={MONTHS}
                placeholder="Month"
              />
              <Select
                value={bday.day}
                onChange={v => setBday(b => ({ ...b, day: v }))}
                options={DAYS}
                placeholder="Day"
              />
              <Select
                value={bday.year}
                onChange={v => setBday(b => ({ ...b, year: v }))}
                options={YEARS}
                placeholder="Year"
              />
            </div>
          </div>

          <div>
            <PasswordInput label="Password" placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.pw} onChange={set('pw')} required />
            <StrengthBar password={form.pw} />
          </div>
          <PasswordInput label="Confirm Password" placeholder="Repeat password" value={form.pw2} onChange={set('pw2')} required />

          {err && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">{err}</p>
          )}

          <Button type="submit" loading={loading} className="w-full h-11 mt-1">
            {loading ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">Sign In</Link>
        </p>
      </motion.div>
    </Page>
  )
}
