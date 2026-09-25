import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const iso = d => d.toLocaleDateString('sv-SE')
const pad = n => String(n).padStart(2, '0')

// One calendar, two clicks: first sets the start, second the end. Clicking
// before the start moves the start instead, so you can't build a backwards range.
export default function DateRangePicker({ value = {}, onChange, max }) {
  const today   = new Date()
  const todayIS = iso(today)
  const maxISO  = max || todayIS
  const anchor  = value.from ? new Date(`${value.from}T12:00:00`) : today

  const [viewY, setViewY] = useState(anchor.getFullYear())
  const [viewM, setViewM] = useState(anchor.getMonth() + 1)
  const [hover, setHover] = useState(null)

  const { from, to } = value

  const dim      = new Date(viewY, viewM, 0).getDate()
  const firstDow = new Date(viewY, viewM - 1, 1).getDay()
  const lead     = firstDow === 0 ? 6 : firstDow - 1

  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)

  const dateOf = d => `${viewY}-${pad(viewM)}-${pad(d)}`
  const shift  = delta => {
    const d = new Date(viewY, viewM - 1 + delta, 1)
    setViewY(d.getFullYear()); setViewM(d.getMonth() + 1)
  }

  // While picking the end, preview the span under the cursor.
  const tail    = to || (from && hover) || null
  const lo      = from && tail ? (from < tail ? from : tail) : null
  const hi      = from && tail ? (from < tail ? tail : from) : null
  const between = ds => lo && hi && ds > lo && ds < hi

  const pick = (ds) => {
    if (!from || to) return onChange({ from: ds, to: null })
    if (ds < from)   return onChange({ from: ds, to: from })
    onChange({ from, to: ds })
  }

  const atMaxMonth = `${viewY}-${pad(viewM)}` >= maxISO.slice(0, 7)

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 w-[19rem] select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2.5">
        <button type="button" onClick={() => shift(-1)} title="Previous month"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors">
          <ChevronLeft size={15} />
        </button>
        <p className="text-sm font-semibold text-gray-200">
          {new Date(viewY, viewM - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}
        </p>
        <button type="button" onClick={() => shift(1)} disabled={atMaxMonth} title="Next month"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed">
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-gray-600 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5" onMouseLeave={() => setHover(null)}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const ds       = dateOf(d)
          const disabled = ds > maxISO
          const isEnd    = ds === from || ds === to
          const isMid    = between(ds)
          const isToday  = ds === todayIS
          const dow      = new Date(viewY, viewM - 1, d).getDay()
          const weekend  = dow === 0 || dow === 6

          return (
            <button key={i} type="button" disabled={disabled}
              onClick={() => pick(ds)}
              onMouseEnter={() => !disabled && setHover(ds)}
              className={`relative h-8 rounded-lg text-xs font-semibold transition-colors
                ${disabled ? 'text-gray-700 cursor-not-allowed'
                  : isEnd  ? 'bg-accent-500 text-white'
                  : isMid  ? 'bg-accent-500/15 text-accent-300'
                  : weekend ? 'text-gray-600 hover:bg-white/5'
                  : 'text-gray-300 hover:bg-white/5'}`}
            >
              {d}
              {isToday && !isEnd && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-400" />
              )}
            </button>
          )
        })}
      </div>

      {/* Selection readout */}
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/[0.06]">
        <p className="text-[11px] text-gray-500">
          {from
            ? <>
                <span className="text-gray-300 font-medium">{new Date(`${from}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                {' → '}
                {to
                  ? <span className="text-gray-300 font-medium">{new Date(`${to}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  : <span className="text-gray-600">pick an end date</span>}
              </>
            : 'Pick a start date'}
        </p>
        {(from || to) && (
          <button type="button" onClick={() => onChange({ from: null, to: null })}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
