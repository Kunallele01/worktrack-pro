import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Search, X, Download, CornerDownLeft, ArrowRight, Check } from 'lucide-react'
import { useStore } from '../lib/store'
import { getHolidayDates } from '../lib/supabase'
import {
  METRICS, DATE_PRESETS, resolveRange, getTeamEmployees,
  fuzzyMatches, runQuery, exportRows,
} from '../lib/askQueries'
import DateRangePicker from './DateRangePicker'
import { Avatar, useToast } from './ui'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Cycled under the cursor while the box is empty — the fastest way to teach
// someone what this thing can answer. Names come from the admin's own team at
// runtime, so the examples are always people they recognise.
const NAMED_HINTS = [
  n => `${n}’s login times for the last 10 working days…`,
  n => `${n}’s leave balance…`,
  n => `${n}’s early check-outs this month…`,
  n => `${n}’s attendance summary for last month…`,
  n => `How many days was ${n} late…`,
  n => `${n}’s hours and extra days…`,
]
const TEAM_HINTS = [
  'Who was late most last month…',
  'Who worked weekends this month…',
  'Who was absent most…',
  'Who worked from home most…',
]

const shuffled = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v)

const EASE = [0.16, 1, 0.3, 1]

function Chip({ label, value, onClear }) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.85, y: -2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
      className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold pl-2.5 pr-2 py-1.5 rounded-lg bg-accent-500/15 text-accent-400 border border-accent-500/25"
    >
      <span className="text-accent-400/55 font-medium">{label}</span>
      <span className="max-w-[14rem] truncate">{value}</span>
      {onClear && (
        <button onClick={onClear} title="Remove"
          className="ml-0.5 -mr-0.5 w-4 h-4 flex items-center justify-center rounded text-accent-400/50 hover:text-accent-300 hover:bg-accent-500/20 transition-colors">
          <X size={10} />
        </button>
      )}
    </motion.span>
  )
}

// who → what → when, with the current step pulsing.
function Steps({ step, subject, metric, preset }) {
  const dots = [
    { id: 'who',  done: !!subject, active: !subject },
    { id: 'what', done: !!metric,  active: !!subject && !metric },
    { id: 'when', done: !!preset,  active: !!metric && !preset },
  ]
  return (
    <div className="flex items-center gap-1.5">
      {dots.map(d => (
        <motion.span key={d.id} layout
          animate={{
            width: d.active ? 16 : 6,
            opacity: d.done ? 0.9 : d.active ? 1 : 0.25,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className={`h-1.5 rounded-full ${d.done || d.active ? 'bg-accent-500' : 'bg-gray-600'}`}
        />
      ))}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="px-5 py-5 flex flex-col gap-3">
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          initial={{ opacity: 0.35 }} animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.12 }}
          className="h-3 rounded-full bg-gray-500/25"
          style={{ width: `${[70, 45, 58][i]}%` }}
        />
      ))}
    </div>
  )
}

const Kbd = ({ children }) => (
  <kbd className="px-1.5 py-0.5 rounded border border-gray-500/30 bg-gray-500/10 font-mono text-[10px] text-gray-500 leading-none">
    {children}
  </kbd>
)

export default function CommandPalette({ open, onClose }) {
  const toast    = useToast()
  const navigate = useNavigate()
  const admin    = useStore(s => s.user)

  const [team,    setTeam]    = useState([])
  const [holidayDates, setHolidayDates] = useState(new Set())
  const [subject, setSubject] = useState(null)
  const [metric,  setMetric]  = useState(null)
  const [preset,  setPreset]  = useState(null)
  const [extra,   setExtra]   = useState({})
  const [query,   setQuery]   = useState('')
  const [active,  setActive]  = useState(0)
  const [result,  setResult]  = useState(null)
  const [running, setRunning] = useState(false)
  const [error,   setError]   = useState(null)
  const [hint,    setHint]    = useState(0)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  useEffect(() => {
    if (!open) return
    getTeamEmployees(admin).then(setTeam).catch(() => setTeam([]))
    getHolidayDates().then(setHolidayDates).catch(() => setHolidayDates(new Set()))
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [open, admin?.id])

  useEffect(() => {
    if (open) return
    setSubject(null); setMetric(null); setPreset(null)
    setExtra({}); setQuery(''); setResult(null); setActive(0)
  }, [open])

  useEffect(() => { setActive(0) }, [query, subject, metric, preset])

  const step = !subject ? 'subject'
    : !metric ? 'metric'
    : !preset ? 'date'
    : (preset.needs === 'month' && extra.month == null) ? 'month'
    : (preset.needs === 'range' && !(extra.from && extra.to)) ? 'range'
    : 'ready'

  // Real teammates, picked fresh each time the palette opens.
  const hints = useMemo(() => {
    const names = [...new Set(team.map(u => (u.full_name || '').trim().split(/\s+/)[0]).filter(Boolean))]
    if (!names.length) return TEAM_HINTS
    const pick = shuffled(names)
    const named = shuffled(NAMED_HINTS).map((t, i) => t(pick[i % pick.length]))
    return shuffled([...named.slice(0, 5), ...TEAM_HINTS]).slice(0, 8)
  }, [team])

  useEffect(() => { setHint(0) }, [hints])

  // Rotate the hint only while it's actually visible.
  useEffect(() => {
    if (query || step !== 'subject' || hints.length < 2) return
    const t = setInterval(() => setHint(i => (i + 1) % hints.length), 3400)
    return () => clearInterval(t)
  }, [query, step, hints])

  const options = useMemo(() => {
    if (step === 'subject') {
      const people = team.filter(u => fuzzyMatches(query, `${u.full_name} ${u.employee_id}`))
        .map(u => ({ id: u.id, kind: 'person', user: u }))
      const teamOpt = fuzzyMatches(query, 'team everyone whole department')
        ? [{ id: '__team', kind: 'team' }] : []
      return [...teamOpt, ...people]
    }
    if (step === 'metric') {
      const scope = subject.kind === 'team' ? 'team' : 'employee'
      return METRICS.filter(m => m.scope === scope)
        .filter(m => fuzzyMatches(query, `${m.label} ${m.keywords.join(' ')}`))
    }
    if (step === 'date') return DATE_PRESETS.filter(p => fuzzyMatches(query, p.label))
    if (step === 'month') {
      const y = new Date().getFullYear()
      return MONTHS.map((label, i) => ({ id: label, label, month: i + 1, year: y }))
        .filter(m => fuzzyMatches(query, m.label))
    }
    return []
  }, [step, team, query, subject])

  // Keep the highlighted row in view when driving by keyboard.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (it) => {
    setQuery('')
    if (step === 'subject') return setSubject(it.kind === 'team' ? { kind: 'team' } : { kind: 'person', user: it.user })
    if (step === 'metric')  return setMetric(it)
    if (step === 'date')    return setPreset(it)
    if (step === 'month')   return setExtra({ month: it.month, year: it.year })
  }

  const run = async () => {
    if (step !== 'ready' || running) return
    setRunning(true); setError(null)
    try {
      const range = resolveRange(preset.id, holidayDates, extra)
      const res = await runQuery({
        metric: metric.id,
        employee: subject.kind === 'person' ? subject.user : null,
        range, admin,
      })
      setResult({ ...res, range })
    } catch (e) {
      console.error('[Ask]', e)
      setError(e?.message || String(e))
    }
    finally { setRunning(false) }
  }

  useEffect(() => { if (step === 'ready' && !result && !running) run() }, [step])

  // A headline-only answer can still export the detail behind it.
  const downloadRows = result?.rows?.length ? result.rows : result?.download

  const download = async () => {
    try {
      const who  = subject.kind === 'person' ? subject.user.full_name : 'Team'
      const name = await exportRows(downloadRows, `${who} ${metric.label} ${result.range.label}`)
      toast(`Saved ${name} to Downloads`, 'success')
    } catch (e) { toast(e.message, 'error') }
  }

  // Peel back one resolved token at a time.
  const back = () => {
    setResult(null); setQuery('')
    if (preset)  { setPreset(null); setExtra({}); return }
    if (metric)  return setMetric(null)
    if (subject) return setSubject(null)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); return onClose() }
    if (e.key === 'Backspace' && !query) { e.preventDefault(); return back() }
    if (step === 'ready') return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, options.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && options[active]) { e.preventDefault(); pick(options[active]) }
  }

  const staticPlaceholder = {
    metric: 'What do you want to know?',
    date:   'Over what period?',
    month:  'Which month?',
    range:  'Pick a start and end date',
    ready:  '',
  }[step]

  if (!open) return null

  const renderOption = (it, isActive) => {
    if (step === 'subject' && it.kind === 'team') return (
      <>
        <div className="w-7 h-7 rounded-full bg-accent-500/15 border border-accent-500/30 flex items-center justify-center shrink-0 text-accent-400 text-xs font-bold">∑</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-200">Whole team</p>
          <p className="text-xs text-gray-500">Rankings across {team.length} employee{team.length !== 1 ? 's' : ''}</p>
        </div>
      </>
    )
    if (step === 'subject') return (
      <>
        <Avatar name={it.user.full_name} size={7} textSize="text-xs" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-200 truncate">{it.user.full_name}</p>
          <p className="text-xs text-gray-500 font-mono truncate">
            {it.user.employee_id}{it.user.department ? ` · ${it.user.department}` : ''}
          </p>
        </div>
      </>
    )
    return (
      <>
        <span className="text-sm text-gray-200 flex-1">{it.label}</span>
        <AnimatePresence>
          {isActive && (
            <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <CornerDownLeft size={13} className="text-accent-400/70 shrink-0" />
            </motion.span>
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[600] flex items-start justify-center bg-black/65 backdrop-blur-[3px] p-4 pt-[11vh]"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.96, y: -12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.7 }}
        className="bg-surface-800 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden"
        style={{ boxShadow: '0 24px 70px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)' }}
      >
        {/* Query bar */}
        <motion.div layout className="flex items-start gap-2 px-4 py-3.5 border-b border-white/[0.06]">
          <Search size={15} className="text-gray-500 shrink-0 mt-1.5" />

          {/* Chips and input wrap together; the controls stay pinned right */}
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
          <AnimatePresence mode="popLayout">
            {subject && (
              <Chip key="who" label="who"
                value={subject.kind === 'team' ? 'Whole team' : subject.user.full_name}
                onClear={() => { setSubject(null); setMetric(null); setPreset(null); setExtra({}); setResult(null) }} />
            )}
            {metric && (
              <Chip key="what" label="what" value={metric.label}
                onClear={() => { setMetric(null); setPreset(null); setExtra({}); setResult(null) }} />
            )}
            {preset && step !== 'month' && step !== 'range' && (
              <Chip key="when" label="when"
                value={resolveRange(preset.id, holidayDates, extra).label}
                onClear={() => { setPreset(null); setExtra({}); setResult(null) }} />
            )}
          </AnimatePresence>

          <div className="relative flex-1 min-w-[9rem]">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={step === 'subject' ? '' : staticPlaceholder}
              className="w-full bg-transparent outline-none text-sm text-gray-100 placeholder-gray-600 py-1"
            />
            {/* Rotating hint — only while empty on the first step */}
            {step === 'subject' && !query && (
              <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={hint}
                    initial={{ opacity: 0, y: 9 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -9 }}
                    transition={{ duration: 0.34, ease: EASE }}
                    className="text-sm text-gray-600 truncate"
                  >
                    {hints[hint] || ''}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
          </div>

          </div>

          <div className="flex items-center gap-2.5 shrink-0 mt-1.5">
            <Steps step={step} subject={subject} metric={metric} preset={preset} />
            <button onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors">
              <X size={14} />
            </button>
          </div>
        </motion.div>

        {/* Body — deliberately not wrapped in AnimatePresence: a `layout` parent
            plus mode="wait" can strand the incoming branch unmounted. Each branch
            animates on mount via its key instead, which cannot hang. */}
        <div>
            {step === 'range' ? (
              <motion.div key="range"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="px-4 py-4 flex justify-center">
                <DateRangePicker
                  value={{ from: extra.from || null, to: extra.to || null }}
                  onChange={({ from, to }) => setExtra(x => ({ ...x, from, to }))}
                />
              </motion.div>
            ) : step !== 'ready' ? (
              <motion.div key="list" ref={listRef}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="max-h-[19rem] overflow-y-auto py-1.5">
                {/* Remounts per step so the slide-in replays, with no exit to stall on */}
                <motion.div key={step}
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}>
                {options.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-gray-500 text-center">
                    {query ? <>No matches for “{query}”.</> : 'Nothing available here.'}
                  </p>
                ) : options.map((it, i) => (
                  <button key={it.id} data-idx={i}
                    onClick={() => pick(it)}
                    onMouseEnter={() => setActive(i)}
                    className="relative w-full text-left px-4 py-2.5 flex items-center gap-3"
                  >
                    {i === active && (
                      <motion.span layoutId={`ask-active-${step}`}
                        transition={{ type: 'spring', stiffness: 620, damping: 44 }}
                        className="absolute inset-y-0.5 inset-x-2 rounded-xl bg-accent-500/[0.12] border border-accent-500/20"
                      />
                    )}
                    <span className="relative flex items-center gap-3 w-full min-w-0">
                      {renderOption(it, i === active)}
                    </span>
                  </button>
                ))}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div key="answer"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="px-5 py-4">
                {running ? <Skeleton /> : error ? (
                  <div className="py-4">
                    <p className="text-sm font-semibold text-red-400">Couldn’t run that query</p>
                    <p className="text-xs text-gray-400 mt-1 font-mono break-words">{error}</p>
                    <button onClick={() => { setError(null); run() }}
                      className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-gray-200 hover:bg-white/10 transition-colors">
                      Try again
                    </button>
                  </div>
                ) : !result ? (
                  <div className="py-4 flex items-center gap-3">
                    <p className="text-sm text-gray-400">Ready to run.</p>
                    <button onClick={run}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-500 text-white hover:bg-accent-600 transition-colors">
                      Get answer
                    </button>
                  </div>
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.26, ease: EASE }}>
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Check size={11} className="text-emerald-400" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-gray-100 leading-snug">{result.headline}</p>
                          {result.sub && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{result.sub}</p>}
                        </div>
                      </div>
                    </motion.div>

                    {result.rows?.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.26, delay: 0.06, ease: EASE }}
                        className="mt-3.5 max-h-56 overflow-auto rounded-xl border border-white/[0.06]">
                        <table className="w-full text-xs border-collapse">
                          <thead className="sticky top-0 bg-surface-700 z-10">
                            <tr>
                              {Object.keys(result.rows[0]).map(c => (
                                <th key={c} className="text-left font-semibold text-gray-400 uppercase tracking-wide px-3 py-2 whitespace-nowrap">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.rows.map((r, i) => (
                              <motion.tr key={i}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                transition={{ duration: 0.18, delay: Math.min(i * 0.015, 0.25) }}
                                className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                                {Object.keys(result.rows[0]).map(c => (
                                  <td key={c} className="px-3 py-2 text-gray-300 whitespace-nowrap">{r[c]}</td>
                                ))}
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </motion.div>
                    )}

                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ duration: 0.24, delay: 0.12 }}
                      className="flex items-center gap-2 mt-4">
                      {downloadRows?.length > 0 && (
                        <button onClick={download}
                          title={result.rows?.length ? 'Download these rows' : `Download the ${downloadRows.length}-day breakdown`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20 active:scale-[0.98] transition-all">
                          <Download size={13} /> Download
                        </button>
                      )}
                      {result.link && (
                        <button onClick={() => { onClose(); navigate(result.link) }}
                          className="group inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors">
                          Open in app
                          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      )}
                      <button onClick={back}
                        className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors">
                        Change period
                      </button>
                    </motion.div>
                  </>
                )}
              </motion.div>
            )}
        </div>

        {/* Footer */}
        <motion.div layout className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-3 text-[10px] text-gray-600 bg-white/[0.015]">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> select</span>
          <span className="flex items-center gap-1"><Kbd>⌫</Kbd> back</span>
          <span className="flex items-center gap-1"><Kbd>esc</Kbd> close</span>
          <span className="ml-auto text-gray-600">Your team only</span>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
