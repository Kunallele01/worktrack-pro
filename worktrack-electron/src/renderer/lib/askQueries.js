// Query catalogue for the admin command palette.
//
// Every query is built from three resolved tokens — who / what / when — so the
// admin always sees exactly what will run before it runs. Nothing is parsed out
// of free text: typing only filters the lists.

import {
  getAllAttendance, getUsers, getMyLeaves, getSettings, getHolidayDates,
  isNonWorkingDate, isEarlyCheckout, calcDayCompletion,
} from './supabase'
import { LEAVE_TYPES } from './leaveConstants'

const pad = n => String(n).padStart(2, '0')
const iso = d => d.toLocaleDateString('sv-SE')
const hm  = t => t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
const dayLabel = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
const hoursBetween = (a, b) => (new Date(b) - new Date(a)) / 3600000
const fmtHours = h => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`

// ── What can be asked ─────────────────────────────────────────────────────── //

export const METRICS = [
  { id: 'summary', label: 'Attendance summary',   scope: 'employee', shape: 'metric',  keywords: ['summary','attendance','overview','present','absent'] },
  { id: 'logins',  label: 'Login times',          scope: 'employee', shape: 'list',    keywords: ['login','check in','checkin','arrival','times','in time'] },
  { id: 'late',    label: 'Late days',            scope: 'employee', shape: 'list',    keywords: ['late','delay','tardy'] },
  { id: 'early',   label: 'Early check-outs',     scope: 'employee', shape: 'list',    keywords: ['early','left early','checkout','check out'] },
  { id: 'leave',   label: 'Leave taken & balance',scope: 'employee', shape: 'metric',  keywords: ['leave','holiday','sick','casual','planned','balance','off'] },
  { id: 'hours',   label: 'Hours & extra days',   scope: 'employee', shape: 'metric',  keywords: ['hours','worked','extra','weekend','overtime'] },

  { id: 'rank_late',   label: 'Who was late most',        scope: 'team', shape: 'ranking', keywords: ['who late','most late','latest','late most'] },
  { id: 'rank_absent', label: 'Who was absent most',      scope: 'team', shape: 'ranking', keywords: ['who absent','most absent','absences'] },
  { id: 'rank_wfh',    label: 'Who worked from home most',scope: 'team', shape: 'ranking', keywords: ['who wfh','work from home','remote'] },
  { id: 'rank_extra',  label: 'Who worked extra days',    scope: 'team', shape: 'ranking', keywords: ['extra','weekend','holiday work','extra mile'] },
  { id: 'rank_score',  label: 'Lowest attendance %',      scope: 'team', shape: 'ranking', keywords: ['score','lowest','ranking','worst','best','percent'] },
]

export const DATE_PRESETS = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'wd7',        label: 'Last 7 working days',  workingDays: 7  },
  { id: 'wd10',       label: 'Last 10 working days', workingDays: 10 },
  { id: 'd30',        label: 'Last 30 days',         days: 30 },
  { id: 'month',      label: 'Specific month…',      needs: 'month' },
  { id: 'range',      label: 'Custom range…',        needs: 'range' },
]

// ── When ──────────────────────────────────────────────────────────────────── //

export function resolveRange(preset, holidayDates, extra = {}) {
  const now = new Date()
  const p   = DATE_PRESETS.find(x => x.id === preset) || DATE_PRESETS[0]

  if (p.id === 'this_month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: iso(s), end: iso(now), label: 'This month' }
  }
  if (p.id === 'last_month') {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const e = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start: iso(s), end: iso(e), label: s.toLocaleString('en', { month: 'long', year: 'numeric' }) }
  }
  if (p.id === 'month') {
    const y = extra.year ?? now.getFullYear()
    const m = extra.month ?? (now.getMonth() + 1)
    const e = new Date(y, m, 0)
    return {
      start: `${y}-${pad(m)}-01`,
      end:   iso(e > now ? now : e),
      label: new Date(y, m - 1).toLocaleString('en', { month: 'long', year: 'numeric' }),
    }
  }
  if (p.id === 'range') {
    return { start: extra.from, end: extra.to, label: `${dayLabel(extra.from)} – ${dayLabel(extra.to)}` }
  }
  if (p.days) {
    const s = new Date(now); s.setDate(s.getDate() - (p.days - 1))
    return { start: iso(s), end: iso(now), label: p.label }
  }
  // Walk back until we've collected N working days.
  const cur = new Date(now)
  let found = 0, guard = 0
  while (found < p.workingDays && guard++ < 200) {
    if (!isNonWorkingDate(iso(cur), holidayDates)) found++
    if (found < p.workingDays) cur.setDate(cur.getDate() - 1)
  }
  return { start: iso(cur), end: iso(now), label: p.label }
}

// ── Who ───────────────────────────────────────────────────────────────────── //

// Admins only query their own team, mirroring how leave routing is scoped.
export async function getTeamEmployees(admin) {
  const users = await getUsers()
  const emps  = users.filter(u => !u.is_admin && u.is_active !== false)
  const dept  = (admin?.department || '').trim().toLowerCase()
  if (!dept) return emps
  const mine = emps.filter(u => (u.department || '').trim().toLowerCase() === dept)
  return mine.length ? mine : emps
}

// Levenshtein-bounded match, so "laet" still finds "late" without ever
// rewriting what the admin typed.
function withinEditDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]; prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = tmp
    }
  }
  return prev[b.length] <= max
}

export function fuzzyMatches(query, haystack) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = haystack.toLowerCase()
  if (hay.includes(q)) return true
  return hay.split(/\s+/).some(w => withinEditDistance(q, w, q.length <= 4 ? 1 : 2))
}

// ── Running a query ───────────────────────────────────────────────────────── //

export async function runQuery({ metric, employee, range, admin }) {
  const def = METRICS.find(m => m.id === metric)
  if (!def) throw new Error('Unknown query.')

  const [settings, holidayDates] = await Promise.all([getSettings(), getHolidayDates()])
  const { start, end } = range

  if (def.scope === 'team') return runTeamQuery(def, { start, end, settings, holidayDates, admin })

  const { items } = await getAllAttendance({ start, end, userId: employee.id, limit: 2000 })
  const all     = items || []
  const working = all.filter(r => !isNonWorkingDate(r.date, holidayDates))
  const present = working.filter(r => ['in_office','wfh'].includes(r.status))

  // Carry the question's scope into the page we hand off to, so "Open in app"
  // lands on the same employee and period rather than resetting to today.
  const attendanceLink = `/admin/attendance?start=${start}&end=${end}`
    + `&q=${encodeURIComponent(employee.employee_id || employee.full_name || '')}`
  const reportsLink = `/admin/reports?year=${end.slice(0, 4)}&month=${Number(end.slice(5, 7))}`

  if (def.id === 'summary') {
    const late = working.filter(r => r.is_late).length
    const wfh  = present.filter(r => r.status === 'wfh').length
    let workdays = 0
    for (let d = new Date(`${start}T12:00:00`); iso(d) <= end; d.setDate(d.getDate() + 1)) {
      if (!isNonWorkingDate(iso(d), holidayDates)) workdays++
    }
    const pct = workdays ? Math.round(present.length / workdays * 100) : 0
    return {
      shape: 'metric',
      headline: `${present.length} of ${workdays} working days present — ${pct}%`,
      sub: `${wfh} from home · ${late} late · ${Math.max(0, workdays - present.length)} absent`,
      // Not shown in the card — the day-by-day detail behind the numbers,
      // so a headline answer is still downloadable.
      download: working.map(r => ({
        Date: dayLabel(r.date),
        Status: r.status === 'wfh' ? 'WFH' : r.status === 'in_office' ? 'In office' : r.status,
        'Checked in': hm(r.check_in_time),
        'Checked out': hm(r.check_out_time),
        Hours: r.check_in_time && r.check_out_time ? fmtHours(hoursBetween(r.check_in_time, r.check_out_time)) : '—',
        Late: r.is_late ? 'Yes' : 'No',
      })),
      link: reportsLink,
    }
  }

  if (def.id === 'logins') {
    const rows = present.map(r => ({
      Date: dayLabel(r.date),
      'Checked in': hm(r.check_in_time),
      'Checked out': hm(r.check_out_time),
      Hours: r.check_in_time && r.check_out_time ? fmtHours(hoursBetween(r.check_in_time, r.check_out_time)) : '—',
      Status: r.status === 'wfh' ? 'WFH' : 'In office',
    }))
    return { shape: 'list', headline: `${rows.length} working day${rows.length !== 1 ? 's' : ''} with a check-in`, rows, link: attendanceLink }
  }

  if (def.id === 'late') {
    const rows = working.filter(r => r.is_late).map(r => ({
      Date: dayLabel(r.date),
      'Checked in': hm(r.check_in_time),
      'Office starts': settings.office_start_time || '09:30',
      Status: r.status === 'wfh' ? 'WFH' : 'In office',
    }))
    return {
      shape: 'list',
      headline: rows.length ? `Late on ${rows.length} day${rows.length !== 1 ? 's' : ''}` : 'Never late in this period',
      rows, link: attendanceLink,
    }
  }

  if (def.id === 'early') {
    const rows = working.filter(r => isEarlyCheckout(r, settings, holidayDates)).map(r => ({
      Date: dayLabel(r.date),
      'Checked in': hm(r.check_in_time),
      'Checked out': hm(r.check_out_time),
      Worked: fmtHours(hoursBetween(r.check_in_time, r.check_out_time)),
    }))
    return {
      shape: 'list',
      headline: rows.length ? `Left early on ${rows.length} day${rows.length !== 1 ? 's' : ''}` : 'No early check-outs in this period',
      sub: `Office ends ${settings.office_end_time || '18:30'}`,
      rows, link: attendanceLink,
    }
  }

  if (def.id === 'hours') {
    const closed = present.filter(r => r.check_out_time && !r.auto_checked_out)
    const avg    = closed.length ? closed.reduce((a, r) => a + hoursBetween(r.check_in_time, r.check_out_time), 0) / closed.length : 0
    const auto   = present.filter(r => r.auto_checked_out).length
    const extra  = all.filter(r => isNonWorkingDate(r.date, holidayDates) && ['in_office','wfh'].includes(r.status)).length
    return {
      shape: 'metric',
      headline: closed.length ? `${fmtHours(avg)} average day` : 'No properly closed days in this period',
      sub: `${closed.length} day${closed.length !== 1 ? 's' : ''} checked out properly · ${auto} auto-closed · ${extra} extra day${extra !== 1 ? 's' : ''} worked`
        + ` · Day Completion ${Math.round(calcDayCompletion(working, parseFloat(settings.full_day_hours || '8')))}/25`,
      download: present.map(r => ({
        Date: dayLabel(r.date),
        'Checked in': hm(r.check_in_time),
        'Checked out': hm(r.check_out_time),
        Hours: r.check_out_time ? fmtHours(hoursBetween(r.check_in_time, r.check_out_time)) : '—',
        'Closed by': r.check_out_time ? (r.auto_checked_out ? 'System (auto)' : 'Employee') : 'Not closed',
      })),
      link: reportsLink,
    }
  }

  if (def.id === 'leave') {
    const year   = Number(end.slice(0, 4))
    const leaves = await getMyLeaves(employee.id, year)
    const inRange = (leaves || []).filter(l => l.start_date <= end && l.end_date >= start)
    const used = {}
    for (const l of (leaves || []).filter(l => l.status === 'approved')) {
      used[l.type] = (used[l.type] || 0) + l.days
    }
    const balance = LEAVE_TYPES.filter(t => t.quotaKey).map(t => {
      const quota = parseInt(settings[t.quotaKey] || '0', 10)
      return `${t.label.replace(' Leave','')} ${Math.max(0, quota - (used[t.type] || 0))}/${quota}`
    }).join(' · ')
    const rows = inRange.map(l => ({
      Type: LEAVE_TYPES.find(t => t.value === l.type)?.label || l.type,
      From: dayLabel(l.start_date),
      To: dayLabel(l.end_date),
      Days: l.days,
      Status: l.status,
      Reason: l.reason,
    }))
    return {
      shape: 'list',
      headline: `${inRange.reduce((a, l) => a + (l.status === 'approved' ? l.days : 0), 0)} approved leave day(s) in this period`,
      sub: `Remaining this year — ${balance}`,
      rows, link: '/admin/leaves',
    }
  }

  throw new Error('Unknown query.')
}

async function runTeamQuery(def, { start, end, settings, holidayDates, admin }) {
  const team = await getTeamEmployees(admin)
  const ids  = new Set(team.map(u => u.id))
  const { items } = await getAllAttendance({ start, end, limit: 5000 })
  const mine = (items || []).filter(r => ids.has(r.user_id))

  let workdays = 0
  for (let d = new Date(`${start}T12:00:00`); iso(d) <= end; d.setDate(d.getDate() + 1)) {
    if (!isNonWorkingDate(iso(d), holidayDates)) workdays++
  }

  const byUser = {}
  mine.forEach(r => { (byUser[r.user_id] ||= []).push(r) })

  const rows = team.map(u => {
    const all     = byUser[u.id] || []
    const working = all.filter(r => !isNonWorkingDate(r.date, holidayDates))
    const present = working.filter(r => ['in_office','wfh'].includes(r.status))
    const extra   = all.filter(r => isNonWorkingDate(r.date, holidayDates) && ['in_office','wfh'].includes(r.status))
    return {
      name: u.full_name,
      Employee: u.full_name,
      late:   working.filter(r => r.is_late).length,
      absent: Math.max(0, workdays - present.length),
      wfh:    present.filter(r => r.status === 'wfh').length,
      extra:  extra.length,
      score:  workdays ? Math.round(present.length / workdays * 100) : 0,
    }
  })

  const cfg = {
    rank_late:   { key: 'late',   col: 'Late days',    dir: 'desc', zero: 'Nobody was late in this period' },
    rank_absent: { key: 'absent', col: 'Days absent',  dir: 'desc', zero: 'Nobody was absent in this period' },
    rank_wfh:    { key: 'wfh',    col: 'WFH days',     dir: 'desc', zero: 'Nobody worked from home in this period' },
    rank_extra:  { key: 'extra',  col: 'Extra days',   dir: 'desc', zero: 'Nobody worked a weekend or holiday' },
    rank_score:  { key: 'score',  col: 'Attendance %', dir: 'asc',  zero: 'No attendance data in this period' },
  }[def.id]

  const sorted = [...rows].sort((a, b) => cfg.dir === 'desc' ? b[cfg.key] - a[cfg.key] : a[cfg.key] - b[cfg.key])
  const shown  = cfg.dir === 'desc' ? sorted.filter(r => r[cfg.key] > 0) : sorted
  const top    = shown[0]

  return {
    shape: 'ranking',
    headline: shown.length
      ? `${top.name} — ${top[cfg.key]}${cfg.key === 'score' ? '%' : ` ${cfg.col.toLowerCase()}`}`
      : cfg.zero,
    sub: `${team.length} employee${team.length !== 1 ? 's' : ''} · ${workdays} working day${workdays !== 1 ? 's' : ''}`,
    rows: shown.map((r, i) => ({ '#': i + 1, Employee: r.Employee, [cfg.col]: cfg.key === 'score' ? `${r.score}%` : r[cfg.key] })),
    link: `/admin/reports?year=${end.slice(0, 4)}&month=${Number(end.slice(5, 7))}`,
  }
}

// ── Download ──────────────────────────────────────────────────────────────── //

export async function exportRows(rows, title) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Results')
  const cols = Object.keys(rows[0] || {})

  ws.columns = cols.map(c => ({ header: c, key: c, width: Math.max(14, c.length + 4) }))
  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.alignment = { vertical: 'middle' }
  })
  rows.forEach((r, i) => {
    ws.addRow(r).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } }
    })
  })

  const buf = await wb.xlsx.writeBuffer()
  const safe = String(title).trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    .replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
  await window.api?.saveExcel(buf, `${safe}.xlsx`)
  return `${safe}.xlsx`
}
