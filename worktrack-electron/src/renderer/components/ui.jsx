import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Eye, EyeOff, MapPin, Wifi, ChevronDown } from 'lucide-react'

// ── Page wrapper with fade transition ────────────────────────────────────── //

export function Page({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`h-full w-full ${className}`}
    >
      {children}
    </motion.div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────── //

export function Card({ children, className = '', hover = false, onClick }) {
  return (
    <motion.div
      whileHover={{
        y: -2,
        boxShadow: '0 10px 32px rgba(0,0,0,0.22)',
        borderColor: 'rgba(255,255,255,0.10)',
        ...(hover ? { scale: 1.01 } : {}),
      }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      onClick={onClick}
      className={`card ${hover ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </motion.div>
  )
}

// Counts from 0 to value with an ease-out cubic — used in StatCard
function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(typeof value === 'number' ? 0 : value)
  const rafRef = useRef(null)

  useEffect(() => {
    if (typeof value !== 'number') { setDisplay(value); return }
    const end   = value
    const dur   = 650
    const t0    = performance.now()
    const tick  = (now) => {
      const p = Math.min((now - t0) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)          // ease-out cubic
      setDisplay(Math.round(end * e))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  return display
}

// ── Button ───────────────────────────────────────────────────────────────── //

export function Button({ children, variant = 'primary', className = '', loading = false, ...props }) {
  const cls = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    danger:    'btn-danger',
    ghost:     'btn-ghost',
  }[variant] || 'btn-primary'

  return (
    <button className={`${cls} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
      ) : null}
      {children}
    </button>
  )
}

// ── Input ────────────────────────────────────────────────────────────────── //

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>}
      <input className={`input-base ${error ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20' : ''} ${className}`} {...props} />
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  )
}

export function PasswordInput({ label, error, ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={`input-base pr-11 ${error ? 'border-red-500/60' : ''}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ── Badge ────────────────────────────────────────────────────────────────── //

const STATUS_BADGE = {
  in_office:    { cls: 'badge-success', label: '● In Office' },
  wfh:          { cls: 'badge-info',    label: '⌂ WFH' },
  absent:       { cls: 'badge-danger',  label: '✕ Absent' },
  late:         { cls: 'badge-warning', label: '⚑ Late' },
  auto_checkout:{ cls: 'badge-neutral', label: '↺ Auto-out' },
  active:       { cls: 'badge-success', label: '● Active' },
  inactive:     { cls: 'badge-neutral', label: '○ Inactive' },
  admin:        { cls: 'badge bg-accent-500/15 text-accent-400 border border-accent-500/20', label: '★ Admin' },
  employee:     { cls: 'badge-neutral', label: 'Employee' },
}

export function Badge({ status, label, className = '' }) {
  const cfg = STATUS_BADGE[status] || { cls: 'badge-neutral', label: status }
  return <span className={`${cfg.cls} ${className}`}>{label || cfg.label}</span>
}

// ── Stat card ────────────────────────────────────────────────────────────── //

export function StatCard({ icon: Icon, value, label, delta, accentColor = 'accent', iconColor }) {
  const colorMap = {
    accent:  'text-accent-400 bg-accent-500/10',
    success: 'text-emerald-400 bg-emerald-500/10',
    warning: 'text-amber-400 bg-amber-500/10',
    danger:  'text-red-400 bg-red-500/10',
    info:    'text-blue-400 bg-blue-500/10',
  }
  const borderMap = {
    accent:  'border-l-accent-500',
    success: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    danger:  'border-l-red-500',
    info:    'border-l-blue-500',
  }
  const ic = colorMap[accentColor] || colorMap.accent
  const bc = borderMap[accentColor] || borderMap.accent

  return (
    <Card className={`p-5 border-l-2 ${bc}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">{label}</p>
          <p className="stat-number"><AnimatedNumber value={value} /></p>
          {delta && (
            <p className={`text-xs mt-1 ${delta.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>{delta}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${ic}`}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  )
}

// ── Toast system ─────────────────────────────────────────────────────────── //

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = (message, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => <Toast key={t.id} {...t} onDismiss={() => setToasts(ts => ts.filter(x => x.id !== t.id))} />)}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

const TOAST_CONFIG = {
  success: { icon: CheckCircle,    cls: 'border-emerald-500/30 bg-emerald-500/10', iconCls: 'text-emerald-400' },
  error:   { icon: AlertCircle,    cls: 'border-red-500/30 bg-red-500/10',         iconCls: 'text-red-400' },
  warning: { icon: AlertTriangle,  cls: 'border-amber-500/30 bg-amber-500/10',     iconCls: 'text-amber-400' },
  info:    { icon: Info,           cls: 'border-blue-500/30 bg-blue-500/10',        iconCls: 'text-blue-400' },
}

function Toast({ id, message, type, onDismiss }) {
  const cfg  = TOAST_CONFIG[type] || TOAST_CONFIG.info
  const Icon = cfg.icon
  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0,  scale: 1 }}
      exit={{   opacity: 0, x: 60,  scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md max-w-xs ${cfg.cls}`}
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${cfg.iconCls}`} />
      <p className="text-sm text-gray-200 flex-1">{message}</p>
      <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 ml-1">
        <X size={14} />
      </button>
    </motion.div>
  )
}

// ── GPS Widget ───────────────────────────────────────────────────────────── //

export function GpsWidget({ onReady }) {
  const [status, setStatus] = useState('idle')
  const [coords, setCoords] = useState(null)
  const [error,  setError ] = useState(null)
  const [wifi,   setWifi  ] = useState(null)

  const acquire = () => {
    setStatus('acquiring')
    setError(null)

    // Apply location from whatever source resolved
    const applyLocation = (lat, lon, accuracy) => {
      setCoords({ lat, lon, accuracy })
      setStatus('active')
      if (onReady) onReady(lat, lon, accuracy)
    }

    // Stage 4: WiFi SSID — detects network name for office matching.
    // Also fetches IP coordinates so WFH users appear on the map (not 0,0).
    const tryWifiSSID = () => {
      const p = window.api?.getWifiSSID?.()
      if (!p) {
        setStatus('error')
        setError('Location unavailable. Enable: Windows Settings → Privacy → Location → ON')
        return
      }
      p.then(ssid => {
        if (ssid) {
          setWifi(ssid)
          // Still get IP-based coordinates so the person appears on the map.
          // accuracy=-1 signals "WiFi detection mode" to checkIn().
          fetch('https://ip-api.com/json/?fields=lat,lon,status')
            .then(r => r.json())
            .then(d => {
              applyLocation(
                d.status === 'success' ? d.lat : 0,
                d.status === 'success' ? d.lon : 0,
                -1,
              )
            })
            .catch(() => applyLocation(0, 0, -1))
        } else {
          setStatus('error')
          setError('Location unavailable. Enable: Windows Settings → Privacy → Location → ON')
        }
      }).catch(() => {
        setStatus('error')
        setError('Location unavailable. Enable: Windows Settings → Privacy → Location → ON')
      })
    }

    // Stage 3: IP geolocation — always works, ~city-level accuracy
    const tryIPGeolocation = () => {
      fetch('https://ip-api.com/json/?fields=lat,lon,status,message')
        .then(r => r.json())
        .then(d => {
          if (d.status === 'success') {
            applyLocation(d.lat, d.lon, 200000)
          } else {
            throw new Error(d.message || 'IP geolocation failed')
          }
        })
        .catch(() => {
          tryWifiSSID()
        })
    }

    // Stage 2: Windows Location via Python/winsdk (bypasses Chromium's geo stack)
    const tryWindowsLocation = () => {
      window.api?.getWindowsLocation?.()
        .then(res => {
          if (res?.lat && res?.lon && !res.error) {
            applyLocation(res.lat, res.lon, res.accuracy || 200000)
          } else {
            tryIPGeolocation()
          }
        })
        .catch(() => tryIPGeolocation())
    }

    // Stage 1: Browser geolocation — best accuracy when it works
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => applyLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        (err) => {
          if (err.code === 1) {
            setStatus('error')
            setError('Location permission denied. Enable: Windows Settings → Privacy → Location → ON')
          } else {
            // Code 2 (unavailable) or 3 (timeout) → try Windows Location API
            tryWindowsLocation()
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      )
    } else {
      tryWindowsLocation()
    }
  }

  useEffect(() => { acquire() }, [])

  const tier = !coords ? null
    : coords.accuracy < 0      ? 'wifi'
    : coords.accuracy <= 500   ? 'good'
    : coords.accuracy <= 5000  ? 'fair'
    : 'poor'

  const tierConfig = {
    wifi: { dot: 'bg-blue-400',    text: 'WiFi Detection Active',        sub: `Network: ${wifi || 'detected'} — SSID verified against office list at check-in` },
    good: { dot: 'bg-emerald-400', text: 'GPS / WiFi Active',            sub: `Accuracy: ±${Math.round(coords?.accuracy)}m` },
    fair: { dot: 'bg-amber-400',   text: 'Location Active (Low)',        sub: `Accuracy: ±${Math.round((coords?.accuracy||0)/1000)}km` },
    poor: { dot: 'bg-red-400',     text: 'IP-Based Location (Very Low)', sub: `Accuracy: ±${Math.round((coords?.accuracy||0)/1000)}km — WiFi SSID detection active` },
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {status === 'acquiring' && (
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75"/>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"/>
            </span>
          )}
          {status === 'active'    && <span className={`block h-3 w-3 rounded-full ${tierConfig[tier]?.dot}`} />}
          {status === 'error'     && <span className="block h-3 w-3 rounded-full bg-red-500"/>}
          {status === 'idle'      && <span className="block h-3 w-3 rounded-full bg-gray-600"/>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-200">
              {status === 'acquiring' && 'Acquiring location…'}
              {status === 'active'    && tierConfig[tier]?.text}
              {status === 'error'     && 'Location Unavailable'}
              {status === 'idle'      && 'Location idle'}
            </p>
            <Button variant="ghost" onClick={acquire} className="text-xs py-1 px-2 h-auto">
              Refresh
            </Button>
          </div>
          {status === 'active' && (
            <>
              <p className="text-xs text-gray-400 mt-0.5">{tierConfig[tier]?.sub}</p>
              {(coords.lat !== 0 || coords.lon !== 0) ? (
                <p className="font-mono text-xs text-accent-400 mt-1">
                  {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
                </p>
              ) : (
                <p className="text-xs text-amber-400/70 mt-1">Approximate location unavailable</p>
              )}
            </>
          )}
          {status === 'error' && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      </div>
    </Card>
  )
}

// ── Confirm dialog ────────────────────────────────────────────────────────── //

export function useConfirm() {
  const [state, setState] = useState(null)

  const confirm = (title, message) => new Promise(resolve => {
    setState({ title, message, resolve })
  })

  const Dialog = state ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-6 max-w-sm w-full mx-4 shadow-2xl"
      >
        <h3 className="text-base font-semibold text-gray-100 mb-2">{state.title}</h3>
        <p className="text-sm text-gray-400 mb-6">{state.message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => { state.resolve(false); setState(null) }}>Cancel</Button>
          <Button variant="danger"    onClick={() => { state.resolve(true);  setState(null) }}>Confirm</Button>
        </div>
      </motion.div>
    </div>
  ) : null

  return { confirm, Dialog }
}

// ── Avatar ───────────────────────────────────────────────────────────────── //

const AVATAR_COLORS = [
  'bg-accent-600','bg-emerald-600','bg-amber-600',
  'bg-red-600','bg-purple-600','bg-pink-600','bg-teal-600',
]

export function EmptyState({ emoji = '📭', title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-8 text-center select-none">
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-full bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
          <span style={{ fontSize: 40 }}>{emoji}</span>
        </div>
        <div className="absolute inset-0 rounded-full bg-accent-500/20 blur-2xl opacity-40 pointer-events-none" />
      </div>
      <p className="text-sm font-bold text-gray-200 mb-1.5">{title}</p>
      {subtitle && <p className="text-xs text-gray-500 max-w-xs leading-relaxed">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Avatar({ name = '', size = 8, textSize = 'text-xs' }) {
  const initials = name.split(' ').slice(0,2).map(p => p[0]?.toUpperCase()).join('')
  const color    = AVATAR_COLORS[Math.abs(name.split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length]
  return (
    <div className={`w-${size} h-${size} ${color} rounded-full flex items-center justify-center shrink-0`}>
      <span className={`${textSize} font-semibold text-white`}>{initials || '?'}</span>
    </div>
  )
}

// ── Calendar widget ───────────────────────────────────────────────────────── //

const STATUS_COLORS = {
  in_office:    'bg-emerald-500/80 text-white',
  wfh:          'bg-blue-500/80 text-white',
  absent:       'bg-red-500/80 text-white',
  late:         'bg-amber-500/80 text-white',
  auto_checkout:'bg-gray-500/50 text-gray-300',
}

const LEAVE_CELL_COLORS = {
  sick:      'bg-rose-500/80 text-white',
  casual:    'bg-amber-500/80 text-white',
  planned:   'bg-teal-500/80 text-white',
  emergency: 'bg-orange-500/80 text-white',
}

export function CalendarWidget({ attendance = [], holidays = [], leaves = [] }) {
  const today   = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  // Build leave date map: date → type
  const leaveMap = {}
  for (const l of leaves) {
    if (l.status !== 'approved') continue
    const cur = new Date(l.start_date + 'T12:00:00')
    const end = new Date(l.end_date   + 'T12:00:00')
    while (cur <= end) {
      leaveMap[cur.toLocaleDateString('sv-SE')] = l.type
      cur.setDate(cur.getDate() + 1)
    }
  }
  const [tooltip, setTooltip] = useState(null) // { date, name }

  const byDate   = {}
  attendance.forEach(r => { byDate[r.date] = r.status })

  // Build a holiday lookup: date string → holiday name
  const holidayMap = {}
  holidays.forEach(h => { holidayMap[h.date] = h.name })

  const firstDay    = new Date(year, month, 1).getDay() || 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const blanks      = firstDay - 1
  const cells       = [...Array(blanks).fill(null), ...Array(daysInMonth).fill(0).map((_,i) => i+1)]

  const prev = () => { if (month === 0) { setYear(y=>y-1); setMonth(11) } else setMonth(m=>m-1) }
  const next = () => { if (month === 11) { setYear(y=>y+1); setMonth(0)  } else setMonth(m=>m+1) }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-white/5 transition">←</button>
        <p className="text-sm font-semibold text-gray-200">
          {new Date(year, month).toLocaleDateString('en', { month: 'long', year: 'numeric' })}
        </p>
        <button onClick={next} className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-white/5 transition">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['M','T','W','T','F','S','S'].map((d,i) => (
          <div key={i} className={`text-xs font-semibold py-1 ${i >= 5 ? 'text-gray-600' : 'text-gray-500'}`}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr   = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const status    = byDate[dateStr]
          const isHoliday  = !!holidayMap[dateStr]
          const leaveType  = leaveMap[dateStr]
          const isToday    = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          const isWeekend  = (i % 7) >= 5
          const isFuture   = new Date(year, month, day) > today
          const todayRing  = isToday ? 'ring-2 ring-accent-500 ring-offset-1 ring-offset-surface-800' : ''

          // Approved leave — show with leave-type color
          if (leaveType && !isHoliday) {
            return (
              <div key={i}
                className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-lg text-xs font-medium cursor-default
                  ${LEAVE_CELL_COLORS[leaveType] || 'bg-teal-500/80 text-white'} ${todayRing}`}>
                <span>{day}</span>
                <span style={{ fontSize: 7 }}>🏖</span>
              </div>
            )
          }

          // Holiday overrides remaining states
          if (isHoliday) {
            return (
              <div
                key={i}
                className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-lg text-xs font-medium cursor-default
                  bg-violet-500/20 text-violet-400
                  ${isToday ? 'ring-2 ring-accent-500 ring-offset-1 ring-offset-surface-800' : ''}`}
                onMouseEnter={() => setTooltip({ date: dateStr, name: holidayMap[dateStr] })}
                onMouseLeave={() => setTooltip(null)}
              >
                <span>{day}</span>
                <span style={{ fontSize: 8 }}>🏖</span>
              </div>
            )
          }

          return (
            <div
              key={i}
              className={`
                relative flex items-center justify-center w-full aspect-square rounded-lg text-xs font-medium transition-all
                ${status ? STATUS_COLORS[status] : ''}
                ${!status && !isFuture && !isWeekend ? 'text-gray-500 hover:bg-white/5' : ''}
                ${isWeekend && !status ? 'text-gray-700' : ''}
                ${isFuture ? 'text-gray-700' : ''}
                ${isToday ? 'ring-2 ring-accent-500 ring-offset-1 ring-offset-surface-800' : ''}
              `}
            >
              {day}
            </div>
          )
        })}
      </div>

      {/* Holiday tooltip */}
      {tooltip && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface-700 border border-white/10 rounded-xl px-3 py-2 shadow-xl z-10 whitespace-nowrap text-xs pointer-events-none">
          <span className="text-violet-400 font-semibold">🏖 {tooltip.name}</span>
          <span className="text-gray-500 ml-2">{tooltip.date}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {[
          ['bg-emerald-500/80','In Office'],
          ['bg-blue-500/80','WFH'],
          ['bg-amber-500/80','Late'],
          ['bg-red-500/80','Absent'],
          ['bg-rose-500/80','Sick Leave'],
          ['bg-teal-500/80','Planned Leave'],
          ['bg-violet-500/50','Holiday'],
        ].map(([bg,label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${bg}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Data table ───────────────────────────────────────────────────────────── //

export function DataTable({ columns, data, onRowClick, pageSize = 50 }) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: null, asc: true })

  let sorted = [...(data || [])]
  if (sort.key) {
    sorted.sort((a, b) => {
      const av = a[sort.key] ?? ''
      const bv = b[sort.key] ?? ''
      return sort.asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }

  const pages    = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize)

  const sortBy = (key) => {
    setSort(s => s.key === key ? { key, asc: !s.asc } : { key, asc: true })
    setPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && sortBy(col.key)}
                  className={`text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 select-none
                    ${col.sortable !== false ? 'cursor-pointer hover:text-gray-200' : ''}`}
                  style={{ width: col.width }}
                >
                  {col.label}
                  {sort.key === col.key && <span className="ml-1">{sort.asc ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-12 text-gray-500">No data found</td></tr>
            ) : pageData.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-white/[0.04] transition-colors
                  ${onRowClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''}
                  ${i % 2 === 1 ? 'bg-white/[0.01]' : ''}`}
              >
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-gray-300">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] text-xs text-gray-400">
          <span>{sorted.length} rows · Page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="text-xs h-7 px-3">← Prev</Button>
            <Button variant="ghost" onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page === pages} className="text-xs h-7 px-3">Next →</Button>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Custom Select (dark-themed dropdown) ──────────────────────────────────── //

export function Select({ value, onChange, options = [], placeholder = 'Select…', className = '' }) {
  const [open, setOpen] = useState(false)
  const ref  = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selected = options.find(o => (typeof o === 'string' ? o : o.value) === value)
  const label    = selected ? (typeof selected === 'string' ? selected : selected.label) : placeholder

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input-base flex items-center justify-between gap-2 text-left w-full"
      >
        <span className={selected ? 'text-gray-100' : 'text-gray-500'}>{label}</span>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1   }}
            exit={{   opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute top-full mt-1.5 left-0 right-0 z-50
                       bg-surface-800 border border-white/10 rounded-xl shadow-2xl
                       overflow-auto max-h-56"
          >
            {options.map((opt) => {
              const val = typeof opt === 'string' ? opt : opt.value
              const lbl = typeof opt === 'string' ? opt : opt.label
              const active = val === value
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => { onChange(val); setOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                    hover:bg-white/5
                    ${active ? 'text-accent-400 bg-accent-500/10 font-medium' : 'text-gray-300'}`}
                >
                  {lbl}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── AnimatedNumber — counts up from 0 to value on mount/change ────────────── //

export function AnimatedNumber({ value, className = '' }) {
  const [display, setDisplay] = useState(0)
  const target = Number(value) || 0

  useEffect(() => {
    if (target === 0) { setDisplay(0); return }
    const start = performance.now()
    const duration = 1200
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * target))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target])

  return <span className={className}>{display}</span>
}

// ── ActivityRing — animated SVG attendance ring ───────────────────────────── //

export function ActivityRing({ percentage = 0, color = '#4F86F7', size = 90, trackColor = 'rgba(255,255,255,0.06)', children }) {
  const strokeW = 9
  const r       = (size - strokeW) / 2
  const circ    = 2 * Math.PI * r
  const offset  = circ - Math.max(0, Math.min(100, percentage)) / 100 * circ

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeW} />
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}
