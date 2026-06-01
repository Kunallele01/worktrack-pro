import React, { useState, useEffect, useCallback } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AnimatePresence, motion } from 'framer-motion'
import { getAllAttendance, getUsers, getSettings } from '../../lib/supabase'
import { Card, Button, Select, Avatar } from '../../components/ui'
import { useToast } from '../../components/ui'
import { format } from 'date-fns'

const MONTHS = [
  { value: 1,  label: 'January'   }, { value: 2,  label: 'February'  },
  { value: 3,  label: 'March'     }, { value: 4,  label: 'April'     },
  { value: 5,  label: 'May'       }, { value: 6,  label: 'June'      },
  { value: 7,  label: 'July'      }, { value: 8,  label: 'August'    },
  { value: 9,  label: 'September' }, { value: 10, label: 'October'   },
  { value: 11, label: 'November'  }, { value: 12, label: 'December'  },
]
const YEARS = [2024, 2025, 2026, 2027].map(y => ({ value: y, label: String(y) }))

// ── Excel style helpers ───────────────────────────────────────────────────── //
const STATUS_LABEL = { in_office: 'In Office', wfh: 'Work From Home', auto_checkout: 'Auto Checkout' }
const STATUS_FILL  = { in_office: 'FFD1FAE5',  wfh: 'FFDBEAFE', absent: 'FFFEE2E2', auto_checkout: 'FFE2E8F0' }

const THIN   = (c = 'FFD1D5DB') => ({ style: 'thin',   color: { argb: c } })
const BORDER = { top: THIN(), left: THIN(), bottom: THIN(), right: THIN() }
const BORDER_HDR = {
  top: { style: 'medium', color: { argb: 'FF0F172A' } }, bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
  left: THIN('FF1E293B'), right: THIN('FF1E293B'),
}

function fmtT(iso) { if (!iso) return ''; try { return format(new Date(iso), 'hh:mm a') } catch { return '' } }
function calcHours(ci, co) {
  if (!ci || !co) return ''
  const h = (new Date(co) - new Date(ci)) / 3600000
  return h > 0 ? `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m` : ''
}
function attendancePct(present, workdays) { return workdays > 0 ? Math.round(present / workdays * 100) : 0 }
function pctColor(p) { return p >= 80 ? 'FF059669' : p >= 60 ? 'FFD97706' : 'FFDC2626' }

function calcPunctualityScore(records, lateThreshold) {
  const present = records.filter(r => ['in_office','wfh'].includes(r.status))
  if (!present.length) return 0
  const sum = present.reduce((acc, r) => {
    if (!r.is_late || !r.check_in_time) return acc + 1
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(r.check_in_time))
    const h = parseInt(parts.find(p => p.type === 'hour').value, 10)
    const m = parseInt(parts.find(p => p.type === 'minute').value, 10)
    return acc + Math.min(1, Math.max(0, 1 - ((h * 60 + m) - lateThreshold) / 60))
  }, 0)
  return (sum / present.length) * 35
}

function calcScore(present, inOffice, workdays, punctualityScore) {
  if (workdays === 0 || present === 0) return 0
  const consistency    = (present / workdays) * 40
  const officePresence = (inOffice / present) * 25
  return Math.round(consistency + punctualityScore + officePresence)
}
function scoreGrade(s) {
  if (s >= 90) return { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/15', hex: '#10B981' }
  if (s >= 75) return { label: 'Good',      color: 'text-accent-400',  bg: 'bg-accent-500/15',  hex: '#4F86F7' }
  if (s >= 60) return { label: 'Fair',       color: 'text-amber-400',   bg: 'bg-amber-500/15',   hex: '#F59E0B' }
  return              { label: 'At Risk',    color: 'text-red-400',     bg: 'bg-red-500/15',     hex: '#EF4444' }
}

const CHART_TOOLTIP = {
  contentStyle: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 11 },
  labelStyle:   { color: '#e2e8f0', fontWeight: 600 },
  itemStyle:    { color: '#94a3b8' },
  cursor:       { fill: 'rgba(255,255,255,0.04)' },
}

function WeekTrendChart({ data }) {
  if (!data?.length) return null
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Weekly Breakdown</p>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} barGap={2} barCategoryGap="28%">
          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={22} />
          <Tooltip {...CHART_TOOLTIP} />
          <Bar dataKey="inOffice" name="In Office" stackId="a" fill="#10B981" />
          <Bar dataKey="wfh"      name="WFH"       stackId="a" fill="#3B82F6" />
          <Bar dataKey="absent"   name="Absent"    stackId="a" fill="#EF4444" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 justify-center">
        {[['#10B981','In Office'],['#3B82F6','WFH'],['#EF4444','Absent']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c }} />
            <span className="text-[10px] text-gray-500">{l}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function DayOfWeekChart({ data }) {
  if (!data?.length) return null
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Presence by Day</p>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} barCategoryGap="30%">
          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0,100]} unit="%" width={30} />
          <Tooltip {...CHART_TOOLTIP} formatter={(v) => [`${v}%`, 'Presence Rate']} />
          <Bar dataKey="rate" name="Presence Rate" radius={[4,4,0,0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.rate >= 80 ? '#10B981' : d.rate >= 60 ? '#F59E0B' : '#EF4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-600 text-center mt-2">Based on {data[0]?.occurrences} occurrence{data[0]?.occurrences !== 1 ? 's' : ''} of each weekday this month</p>
    </Card>
  )
}

function ArrivalTimeChart({ data }) {
  if (!data?.length || data.every(d => d.count === 0)) return null
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Arrival Time Distribution</p>
      <p className="text-[10px] text-gray-600 mb-3">When does your team actually show up?</p>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} barCategoryGap="15%">
          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
          <Tooltip {...CHART_TOOLTIP} formatter={(v) => [v, 'Check-ins']} />
          <Bar dataKey="count" name="Check-ins" radius={[3,3,0,0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.isLate ? '#F59E0B' : '#4F86F7'} fillOpacity={d.count === 0 ? 0.15 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent-500" /><span className="text-[10px] text-gray-500">On time</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /><span className="text-[10px] text-gray-500">After grace period</span></div>
      </div>
    </Card>
  )
}

function sc(cell, value, { fill, font, align, border = BORDER } = {}) {
  cell.value = value
  if (fill)   cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
  if (font)   cell.font      = { size: 10, ...font }
  if (align)  cell.alignment = { vertical: 'middle', ...align }
  if (border) cell.border    = border
}

function writeHeader(ws, company, title, sub, info, cols) {
  ws.views = [{ showGridLines: false }]
  // Row 1 — dark brand bar
  ws.mergeCells(1, 1, 1, cols)
  sc(ws.getCell('A1'), `${company}`, {
    fill: 'FF0F172A', font: { bold: true, size: 11, color: { argb: 'FF94A3B8' } },
    align: { horizontal: 'left', indent: 2 }, border: null,
  })
  ws.getRow(1).height = 22

  // Row 2 — report title
  ws.mergeCells(2, 1, 2, cols)
  sc(ws.getCell('A2'), title, {
    fill: 'FF0F172A', font: { bold: true, size: 15, color: { argb: 'FFFFFFFF' } },
    align: { horizontal: 'left', indent: 2 }, border: null,
  })
  ws.getRow(2).height = 30

  // Row 3 — period / subtitle
  ws.mergeCells(3, 1, 3, cols)
  sc(ws.getCell('A3'), sub, {
    fill: 'FF1E293B', font: { size: 10, color: { argb: 'FFE2E8F0' } },
    align: { horizontal: 'left', indent: 2 }, border: null,
  })
  ws.getRow(3).height = 20

  // Row 4 — generated stamp
  ws.mergeCells(4, 1, 4, cols)
  sc(ws.getCell('A4'), info, {
    fill: 'FF1E293B', font: { size: 9, italic: true, color: { argb: 'FF64748B' } },
    align: { horizontal: 'left', indent: 2 }, border: null,
  })
  ws.getRow(4).height = 16

  // Row 5 — thin accent line
  for (let c = 1; c <= cols; c++) {
    ws.getCell(5, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }
  }
  ws.getRow(5).height = 3
}

function writeColHeaders(ws, headers, rowNum) {
  headers.forEach((h, i) => {
    const cell = ws.getCell(rowNum, i + 1)
    cell.value     = typeof h === 'string' ? h : h.label
    cell.font      = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: (typeof h === 'object' ? h.align : null) || 'center', vertical: 'middle' }
    cell.border    = BORDER_HDR
  })
  ws.getRow(rowNum).height = 24
  ws.autoFilter  = { from: { row: rowNum, column: 1 }, to: { row: rowNum, column: headers.length } }
  ws.views       = [{ state: 'frozen', ySplit: rowNum, showGridLines: false }]
}

// ── Main Excel builder ────────────────────────────────────────────────────── //
async function buildExcel(kind, year, month) {
  const ExcelJS   = (await import('exceljs')).default
  const settings  = await getSettings()
  const company   = settings?.company_name || 'WorkTrack Pro'
  const wb = new ExcelJS.Workbook()
  wb.creator = company; wb.created = new Date()

  const monthLabel = MONTHS.find(m => m.value === month)?.label || ''
  const dateRange  = `${monthLabel} ${year}`
  const genStamp   = `Generated: ${format(new Date(), 'dd MMM yyyy · hh:mm a')}`
  const today      = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
  const start      = kind === 'daily' ? today : `${year}-${String(month).padStart(2,'0')}-01`
  const end        = kind === 'daily' ? today : `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`

  let { items } = await getAllAttendance({ start, end, status: kind === 'wfh' ? 'wfh' : undefined, limit: 5000 })
  if (kind === 'late') items = items.filter(r => r.is_late)

  // ── MONTHLY ────────────────────────────────────────────────────────────── //
  if (kind === 'monthly') {
    const users  = await getUsers()
    const byUser = {}
    items.forEach(r => {
      if (!byUser[r.user_id]) byUser[r.user_id] = []
      byUser[r.user_id].push(r)
    })
    const daysInMonth = new Date(year, month, 0).getDate()
    const allDays     = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month - 1, i + 1)
      return { date: d.toLocaleDateString('sv-SE'), day: d.toLocaleDateString('en', { weekday: 'short' }) }
    })
    const workdays = allDays.filter(d => !['Sat','Sun'].includes(d.day)).length

    // ── Summary sheet ─────────────────────────────────────────────────────
    const sum = wb.addWorksheet('📊 Summary')
    writeHeader(sum, company, 'Monthly Attendance Report',
      `Period: ${dateRange}  ·  Working Days: ${workdays}  ·  Employees: ${users.length}`,
      genStamp, 9)
    writeColHeaders(sum, [
      { label: 'Employee',    align: 'left'   },
      { label: 'Employee ID', align: 'center' },
      { label: 'Department',  align: 'left'   },
      { label: 'Present',     align: 'center' },
      { label: 'WFH Days',    align: 'center' },
      { label: 'In-Office',   align: 'center' },
      { label: 'Late',        align: 'center' },
      { label: 'Absent',      align: 'center' },
      { label: 'Attendance %',align: 'center' },
    ], 6)

    let row = 7
    let tPres = 0, tWfh = 0, tLate = 0, tAbs = 0
    users.forEach(u => {
      const recs     = byUser[u.id] || []
      const present  = recs.filter(r => ['in_office','wfh'].includes(r.status)).length
      const wfh      = recs.filter(r => r.status === 'wfh').length
      const inOff    = recs.filter(r => r.status === 'in_office').length
      const late     = recs.filter(r => r.is_late).length
      const absent   = Math.max(0, workdays - present)
      const att      = attendancePct(present, workdays)
      const bg       = row % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF'
      tPres += present; tWfh += wfh; tLate += late; tAbs += absent

      sc(sum.getCell(row, 1), u.full_name,       { fill: bg, font: { bold: true },                                              align: { horizontal: 'left'   } })
      sc(sum.getCell(row, 2), u.employee_id,     { fill: bg, font: { color: { argb: 'FF6B7280' } },                             align: { horizontal: 'center' } })
      sc(sum.getCell(row, 3), u.department || '—',{ fill: bg,                                                                   align: { horizontal: 'left'   } })
      sc(sum.getCell(row, 4), present,            { fill: bg, font: { bold: present > 0, color: { argb: 'FF059669' } },          align: { horizontal: 'center' } })
      sc(sum.getCell(row, 5), wfh,                { fill: bg, font: { color: { argb: 'FF3B82F6' } },                             align: { horizontal: 'center' } })
      sc(sum.getCell(row, 6), inOff,              { fill: bg, font: { color: { argb: 'FF10B981' } },                             align: { horizontal: 'center' } })
      sc(sum.getCell(row, 7), late || '—',        { fill: late > 0 ? 'FFFEF3C7' : bg, font: { bold: late > 0, color: { argb: late > 0 ? 'FFD97706' : 'FF9CA3AF' } }, align: { horizontal: 'center' } })
      sc(sum.getCell(row, 8), absent || '—',      { fill: absent > 0 ? 'FFFEE2E2' : bg, font: { color: { argb: absent > 0 ? 'FFDC2626' : 'FF9CA3AF' } },              align: { horizontal: 'center' } })
      sc(sum.getCell(row, 9), `${att}%`,          { fill: bg, font: { bold: true, color: { argb: pctColor(att) } },              align: { horizontal: 'center' } })
      sum.getRow(row).height = 20
      row++
    })

    // Totals row
    const totAtt = attendancePct(tPres, workdays * users.length)
    ;[company + ' Total', '', '', tPres, tWfh, tPres - tWfh, tLate || '—', tAbs, `${totAtt}%`]
      .forEach((v, i) => sc(sum.getCell(row, i + 1), v, {
        fill: 'FF1E3A5F',
        font: { bold: true, size: 10, color: { argb: i >= 3 ? 'FFFFFFFF' : 'FFE2E8F0' } },
        align: { horizontal: i <= 2 ? 'left' : 'center' },
        border: { top: { style: 'medium', color: { argb: 'FF3B82F6' } }, left: THIN(), bottom: THIN(), right: THIN() },
      }))
    sum.getRow(row).height = 22

    sum.columns = [
      { width: 28 }, { width: 13 }, { width: 20 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 9 }, { width: 9 }, { width: 12 },
    ]
    sum.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

    // ── Per-employee sheets ───────────────────────────────────────────────
    for (const u of users) {
      const ws = wb.addWorksheet(u.full_name.replace(/[*?:\\/[\]]/g, '').substring(0, 31))
      const uRecs    = byUser[u.id] || []
      const byDate   = {}
      uRecs.forEach(r => { byDate[r.date] = r })
      const uPresent = Object.values(byDate).filter(x => ['in_office','wfh'].includes(x.status)).length
      const uWfh     = Object.values(byDate).filter(x => x.status === 'wfh').length
      const uLate    = Object.values(byDate).filter(x => x.is_late).length
      const uAtt     = attendancePct(uPresent, workdays)

      writeHeader(ws, company, u.full_name,
        `${u.department || ''}  ·  ID: ${u.employee_id}  ·  ${dateRange}`,
        `${genStamp}  ·  Attendance: ${uAtt}%  ·  Working Days: ${workdays}`, 7)
      writeColHeaders(ws, [
        { label: 'Date',      align: 'center' }, { label: 'Day',       align: 'center' },
        { label: 'Check-in',  align: 'center' }, { label: 'Check-out', align: 'center' },
        { label: 'Status',    align: 'center' }, { label: 'Hours',     align: 'center' },
        { label: 'Late?',     align: 'center' },
      ], 6)

      let r = 7
      allDays.forEach(({ date, day }) => {
        const isWknd = ['Sat','Sun'].includes(day)
        const rec    = byDate[date]
        const stKey  = rec?.status
        const bg     = isWknd ? 'FFF1F5F9' : (STATUS_FILL[stKey] || (r % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF'))
        const gFont  = { color: { argb: 'FFBFC8D3' } }

        sc(ws.getCell(r,1), date,                             { fill: bg, font: isWknd ? gFont : {},                                              align: { horizontal: 'center' } })
        sc(ws.getCell(r,2), day,                              { fill: bg, font: isWknd ? gFont : { bold: true },                                   align: { horizontal: 'center' } })
        sc(ws.getCell(r,3), fmtT(rec?.check_in_time),         { fill: bg, font: isWknd ? gFont : {},                                              align: { horizontal: 'center' } })
        sc(ws.getCell(r,4), fmtT(rec?.check_out_time),        { fill: bg, font: isWknd ? gFont : {},                                              align: { horizontal: 'center' } })
        sc(ws.getCell(r,5), isWknd ? 'Weekend' : (stKey ? STATUS_LABEL[stKey] || stKey : 'Absent'),
                                                              { fill: isWknd ? 'FFF1F5F9' : (STATUS_FILL[stKey] || bg), font: isWknd ? gFont : { bold: !!stKey }, align: { horizontal: 'center' } })
        sc(ws.getCell(r,6), calcHours(rec?.check_in_time, rec?.check_out_time),
                                                              { fill: bg,          font: isWknd ? gFont : {},                                      align: { horizontal: 'center' } })
        sc(ws.getCell(r,7), rec?.is_late ? '▲ Late' : (isWknd ? '' : '—'),
                                                              { fill: rec?.is_late ? 'FFFEF3C7' : bg,
                                                                font: rec?.is_late ? { bold: true, color: { argb: 'FFD97706' } } : gFont,          align: { horizontal: 'center' } })
        ws.getRow(r).height = 18; r++
      })

      // Summary footer block
      r++
      ws.mergeCells(r, 1, r, 7)
      sc(ws.getCell(r,1), 'MONTHLY SUMMARY', {
        fill: 'FF0F172A', font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
        align: { horizontal: 'center' }, border: null,
      })
      ws.getRow(r).height = 20; r++

      const footRows = [
        ['Working Days',  workdays,                             'FFEFF6FF', 'FF1D4ED8'],
        ['Days Present',  uPresent,                            'FFD1FAE5', 'FF059669'],
        ['WFH Days',      uWfh,                                'FFDBEAFE', 'FF3B82F6'],
        ['Late Arrivals', uLate,    uLate > 0 ?               'FFFEF3C7' : 'FFEFF6FF', uLate > 0 ? 'FFD97706' : 'FF6B7280'],
        ['Days Absent',   Math.max(0, workdays - uPresent),   'FFFEE2E2', 'FFDC2626'],
        ['Attendance %',  `${uAtt}%`,                         'FFEFF6FF', pctColor(uAtt)],
      ]
      footRows.forEach(([label, val, bg, color]) => {
        ws.mergeCells(r, 1, r, 4)
        sc(ws.getCell(r,1), label, { fill: bg, font: { bold: true, color: { argb: 'FF374151' } }, align: { horizontal: 'right' } })
        ws.mergeCells(r, 5, r, 7)
        sc(ws.getCell(r,5), val,   { fill: bg, font: { bold: true, size: 12, color: { argb: color } }, align: { horizontal: 'center' } })
        ws.getRow(r).height = 22; r++
      })

      ws.columns = [{ width: 14 }, { width: 8 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 10 }, { width: 10 }]
      ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    }
    return wb
  }

  // ── DAILY / LATE / WFH — single sheet ─────────────────────────────────── //
  const TITLES = { daily: 'Daily Attendance Report', late: 'Late Arrivals Report', wfh: 'Work From Home Report' }
  const METAS  = {
    daily: `Date: ${today}  ·  All check-ins for today`,
    late:  `Period: ${dateRange}  ·  Showing late arrivals only`,
    wfh:   `Period: ${dateRange}  ·  Showing Work From Home only`,
  }
  const ws  = wb.addWorksheet(TITLES[kind])
  const COL = 10
  writeHeader(ws, company, TITLES[kind], METAS[kind], `${genStamp}  ·  Records: ${items.length}`, COL)
  writeColHeaders(ws, [
    { label: '#',           align: 'center' }, { label: 'Employee',    align: 'left'   },
    { label: 'Employee ID', align: 'center' }, { label: 'Department',  align: 'left'   },
    { label: 'Date',        align: 'center' }, { label: 'Day',         align: 'center' },
    { label: 'Check-in',    align: 'center' }, { label: 'Check-out',   align: 'center' },
    { label: 'Status',      align: 'center' }, { label: 'Hours',       align: 'center' },
  ], 6)

  if (!items.length) {
    ws.mergeCells(7, 1, 7, COL)
    sc(ws.getCell(7,1), 'No records found for this period.', {
      fill: 'FFFAFAFA', font: { italic: true, color: { argb: 'FF9CA3AF' } },
      align: { horizontal: 'center' }, border: null,
    })
  }

  items.forEach((rec, idx) => {
    const p   = rec.profiles || {}
    const bg  = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'
    const stF = STATUS_FILL[rec.status] || bg
    const dayStr = rec.date ? new Date(rec.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }) : ''
    const r   = idx + 7

    sc(ws.getCell(r,1),  idx + 1,                                           { fill: bg,  font: { color: { argb: 'FFB0BAC8' } }, align: { horizontal: 'center' } })
    sc(ws.getCell(r,2),  p.full_name || '',                                  { fill: bg,  font: { bold: true },                  align: { horizontal: 'left'   } })
    sc(ws.getCell(r,3),  p.employee_id || '',                                { fill: bg,  font: { color: { argb: 'FF6B7280' } }, align: { horizontal: 'center' } })
    sc(ws.getCell(r,4),  p.department || '',                                 { fill: bg,                                         align: { horizontal: 'left'   } })
    sc(ws.getCell(r,5),  rec.date,                                           { fill: bg,                                         align: { horizontal: 'center' } })
    sc(ws.getCell(r,6),  dayStr,                                             { fill: bg,  font: { color: { argb: 'FF6B7280' } }, align: { horizontal: 'center' } })
    sc(ws.getCell(r,7),  fmtT(rec.check_in_time),                            { fill: rec.is_late ? 'FFFEF3C7' : bg, font: rec.is_late ? { bold: true, color: { argb: 'FFD97706' } } : {}, align: { horizontal: 'center' } })
    sc(ws.getCell(r,8),  fmtT(rec.check_out_time),                           { fill: bg,                                         align: { horizontal: 'center' } })
    sc(ws.getCell(r,9),  STATUS_LABEL[rec.status] || rec.status || '',       { fill: stF, font: { bold: true },                  align: { horizontal: 'center' } })
    sc(ws.getCell(r,10), calcHours(rec.check_in_time, rec.check_out_time),   { fill: bg,                                         align: { horizontal: 'center' } })
    ws.getRow(r).height = 19
  })

  ws.columns = [
    { width: 5  }, { width: 26 }, { width: 13 }, { width: 18 },
    { width: 13 }, { width: 7  }, { width: 11 }, { width: 11 },
    { width: 17 }, { width: 10 },
  ]
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  return wb
}

const REPORT_TYPES = [
  { kind: 'daily',   icon: '📅', title: 'Daily Report',    desc: "Today's check-ins" },
  { kind: 'monthly', icon: '📊', title: 'Monthly Report',  desc: 'Per-employee sheets + summary' },
  { kind: 'late',    icon: '⚑',  title: 'Late Arrivals',   desc: 'Employees who arrived late' },
  { kind: 'wfh',    icon: '⌂',  title: 'WFH Summary',     desc: 'Work-from-home check-ins' },
]

// ── Employee Deep-Dive panel ───────────────────────────────────────────────── //

function ScoreBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-gray-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-mono text-gray-400 w-10 text-right shrink-0">
        {Math.round(value)}<span className="text-gray-600">/{max}</span>
      </span>
    </div>
  )
}

function ArrivalMiniChart({ records, officeStartMin, graceMin }) {
  const lateMin = officeStartMin + graceMin
  const data = records
    .filter(r => r.check_in_time)
    .map(r => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(new Date(r.check_in_time))
      const h = parseInt(parts.find(p => p.type === 'hour').value, 10)
      const m = parseInt(parts.find(p => p.type === 'minute').value, 10)
      return { date: r.date.slice(8), minutes: h * 60 + m, isLate: r.is_late }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  if (!data.length) return <p className="text-xs text-gray-600 text-center py-6">No check-in data</p>

  const allMins = data.map(d => d.minutes)
  // Snap Y range to 30-min grid, anchored to office hours context
  const rawMin = Math.min(...allMins, officeStartMin - 40)
  const rawMax = Math.max(...allMins, lateMin + 25)
  const minT   = Math.floor(rawMin / 30) * 30
  const maxT   = Math.ceil(rawMax  / 30) * 30
  const range  = maxT - minT || 60

  const W = 340, H = 150
  const PL = 36, PR = 28, PT = 8, PB = 20
  const cW = W - PL - PR, cH = H - PT - PB
  const xStep = data.length > 1 ? cW / (data.length - 1) : cW / 2
  const yPos  = (m) => PT + cH - ((m - minT) / range) * cH
  const fmt   = (m) => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`

  // 30-min Y gridlines
  const yTicks = []
  for (let t = minT; t <= maxT; t += 30) yTicks.push(t)

  // ~5 x-axis labels
  const labelStep = Math.max(1, Math.ceil(data.length / 5))
  const showLabel = (i) => i === 0 || i === data.length - 1 || i % labelStep === 0

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {/* Subtle horizontal gridlines + left time labels */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={PL} y1={yPos(t)} x2={W - PR} y2={yPos(t)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <text x={PL - 4} y={yPos(t) + 3.5} textAnchor="end" fill="#475569" fontSize={7.5}>{fmt(t)}</text>
        </g>
      ))}

      {/* Office start reference line — label on the right */}
      <line x1={PL} y1={yPos(officeStartMin)} x2={W - PR} y2={yPos(officeStartMin)}
        stroke="#4F86F7" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
      <text x={W - PR + 3} y={yPos(officeStartMin) + 3.5} textAnchor="start" fill="#4F86F7" fontSize={7.5} opacity={0.85}>Start</text>

      {/* Late threshold reference line — label on the right */}
      <line x1={PL} y1={yPos(lateMin)} x2={W - PR} y2={yPos(lateMin)}
        stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
      <text x={W - PR + 3} y={yPos(lateMin) + 3.5} textAnchor="start" fill="#F59E0B" fontSize={7.5} opacity={0.85}>Late</text>

      {/* Connecting line */}
      {data.length > 1 && (
        <polyline
          points={data.map((d, i) => `${PL + i * xStep},${yPos(d.minutes)}`).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1}
        />
      )}

      {/* Dots + sparse date labels */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={PL + i * xStep} cy={yPos(d.minutes)} r={3}
            fill={d.isLate ? '#F59E0B' : '#4F86F7'} opacity={0.9} />
          {showLabel(i) && (
            <text x={PL + i * xStep} y={H - 4} textAnchor="middle" fill="#64748b" fontSize={7.5}>{d.date}</text>
          )}
        </g>
      ))}
    </svg>
  )
}

function MonthCalendar({ records, year, month }) {
  const dim    = new Date(year, month, 0).getDate()
  const byDate = {}
  records.forEach(r => { byDate[r.date] = r })

  const firstDow    = new Date(year, month - 1, 1).getDay()
  const firstMonDow = firstDow === 0 ? 6 : firstDow - 1
  const totalCells  = Math.ceil((firstMonDow + dim) / 7) * 7

  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstMonDow + 1
    if (dayNum < 1 || dayNum > dim) { cells.push(null); continue }
    const date    = `${year}-${String(month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
    const dow     = new Date(year, month - 1, dayNum).getDay()
    const isWknd  = dow === 0 || dow === 6
    const rec     = byDate[date]
    const isFuture = date > new Date().toLocaleDateString('sv-SE')
    cells.push({ dayNum, isWknd, rec, isFuture })
  }

  const cellStyle = (cell) => {
    if (!cell) return 'bg-transparent'
    if (cell.isWknd)   return 'bg-white/[0.03] text-gray-700'
    if (cell.isFuture) return 'bg-white/[0.03] text-gray-700'
    if (!cell.rec)     return 'bg-red-500/20 text-red-400'
    if (cell.rec.is_late) return 'bg-amber-500/20 text-amber-400'
    if (cell.rec.status === 'wfh') return 'bg-blue-500/20 text-blue-400'
    return 'bg-emerald-500/20 text-emerald-400'
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-gray-600 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => (
          <div key={i} className={`aspect-square rounded flex items-center justify-center text-[10px] font-semibold transition-colors ${cellStyle(cell)}`}>
            {cell?.dayNum || ''}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {[['bg-emerald-500/20 text-emerald-400','On Time'],['bg-blue-500/20 text-blue-400','WFH'],
          ['bg-amber-500/20 text-amber-400','Late'],['bg-red-500/20 text-red-400','Absent']].map(([cls, lbl]) => (
          <div key={lbl} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-sm ${cls.split(' ')[0]}`} />
            <span className="text-[9px] text-gray-500">{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmployeeDeepDive({ row, workdays, month, year, settings, onClose }) {
  const { full_name, employee_id, department, score, present, wfh, inOffice, late, absent, records = [] } = row
  const grade = scoreGrade(score)

  const officeStartMin = (() => {
    const [h, m] = (settings?.office_start_time || '09:30').split(':').map(Number)
    return h * 60 + m
  })()
  const graceMin = parseInt(settings?.grace_period_minutes || '10', 10)

  const consistency    = workdays > 0 ? (present / workdays) * 40                : 0
  const punctuality    = calcPunctualityScore(records, officeStartMin + graceMin)
  const officePresence = present  > 0 ? (inOffice / present) * 25                : 0

  const avgHours = (() => {
    const withBoth = records.filter(r => r.check_in_time && r.check_out_time)
    if (!withBoth.length) return null
    const avg = withBoth.reduce((acc, r) => acc + (new Date(r.check_out_time) - new Date(r.check_in_time)), 0) / withBoth.length / 3600000
    return `${Math.floor(avg)}h ${Math.round((avg % 1) * 60)}m`
  })()

  return (
    <>
      {/* Backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 499, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 420, zIndex: 500, overflowY: 'auto' }}
        className="bg-surface-800 border-l border-white/10 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <Avatar name={full_name || ''} size={10} textSize="text-sm" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-100 leading-tight">{full_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{department || '—'} · <span className="font-mono">{employee_id}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-gray-500 hover:text-gray-300 transition-colors shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 flex flex-col gap-5">

          {/* Score */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Attendance Score</p>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-black font-mono tabular-nums ${grade.color}`}>{score}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${grade.bg} ${grade.color}`}>{grade.label}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-600">out of 100</p>
                {avgHours && <p className="text-xs text-gray-400 mt-1">Avg <span className="font-mono font-semibold">{avgHours}</span>/day</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <ScoreBar label="Consistency"   value={consistency}    max={40} color="#4F86F7" />
              <ScoreBar label="Punctuality"   value={punctuality}    max={35} color="#10B981" />
              <ScoreBar label="Office Presence" value={officePresence} max={25} color="#8B5CF6" />
            </div>
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Present', value: present, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Absent',  value: absent,  color: 'text-red-400',     bg: 'bg-red-500/10'     },
              { label: 'Late',    value: late,     color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
              { label: 'WFH',     value: wfh,      color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl px-2 py-2.5 text-center`}>
                <p className={`text-lg font-bold font-mono tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Calendar */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {new Date(year, month - 1).toLocaleString('en', { month: 'long' })} {year}
            </p>
            <MonthCalendar records={records} year={year} month={month} />
          </div>

          {/* Arrival time chart */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Arrival Times</p>
            <p className="text-[10px] text-gray-600 mb-3">
              Blue line = office start · Amber line = late threshold
            </p>
            <ArrivalMiniChart records={records} officeStartMin={officeStartMin} graceMin={graceMin} />
          </div>

        </div>
      </motion.div>
    </>
  )
}

export default function Reports() {
  const now   = new Date()
  const toast = useToast()
  const [month,       setMonth      ] = useState(now.getMonth() + 1)
  const [year,        setYear       ] = useState(now.getFullYear())
  const [preview,     setPreview    ] = useState(null)
  const [loadingPrev, setLoadingPrev] = useState(false)
  const [busyKind,    setBusyKind   ] = useState(null)
  const [deepDive,    setDeepDive   ] = useState(null)

  const loadPreview = useCallback(async () => {
    setLoadingPrev(true)
    try {
      const start = `${year}-${String(month).padStart(2,'0')}-01`
      const end   = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`
      const [{ items: allItems }, users, settings] = await Promise.all([
        getAllAttendance({ start, end, limit: 5000 }),
        getUsers(),
        getSettings(),
      ])
      // Only non-admin employees for analytics
      const empUsers = users.filter(u => !u.is_admin)
      const items    = allItems // keep all for table; analytics use empUsers cross-ref

      // Use elapsed working days for current month, full month for past months
      const today = new Date()
      const isCurrentMonth = year === today.getFullYear() && month === (today.getMonth() + 1)
      const lastDay = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate()
      const dim     = new Date(year, month, 0).getDate()
      let workdays = 0
      for (let d = 1; d <= lastDay; d++) {
        const wd = new Date(year, month - 1, d).getDay()
        if (wd !== 0 && wd !== 6) workdays++
      }

      const officeStartMin = (() => {
        const [h, m] = (settings?.office_start_time || '09:30').split(':').map(Number)
        return h * 60 + m
      })()
      const graceMin = parseInt(settings?.grace_period_minutes || '10', 10)
      const lateThreshold = officeStartMin + graceMin

      const byUser = {}
      items.forEach(r => {
        if (!byUser[r.user_id]) byUser[r.user_id] = []
        byUser[r.user_id].push(r)
      })

      const rows = users.map(u => {
        const recs     = byUser[u.id] || []
        const present  = recs.filter(r => ['in_office','wfh'].includes(r.status)).length
        const wfh      = recs.filter(r => r.status === 'wfh').length
        const inOffice = recs.filter(r => r.status === 'in_office').length
        const late     = recs.filter(r => r.is_late).length
        const absent   = Math.max(0, workdays - present)
        const pct      = workdays > 0 ? Math.round(present / workdays * 100) : 0
        const punct    = calcPunctualityScore(recs, lateThreshold)
        const score    = calcScore(present, inOffice, workdays, punct)
        return { ...u, present, wfh, inOffice, late, absent, pct, score, records: recs }
      }).sort((a, b) => b.score - a.score)

      // Summary totals
      const totals = rows.reduce((acc, r) => ({
        present: acc.present + r.present,
        wfh:     acc.wfh     + r.wfh,
        late:    acc.late    + r.late,
        absent:  acc.absent  + r.absent,
      }), { present: 0, wfh: 0, late: 0, absent: 0 })

      // ── Chart data (all computed from already-fetched items) ──────────────

      // 1. Week-by-week trend
      const empIds = new Set(empUsers.map(u => u.id))
      const empItems = items.filter(r => empIds.has(r.user_id))

      const todayStr = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
      const weekTrend = []
      let wkStart = 1
      while (wkStart <= dim) {
        const wkEnd = Math.min(wkStart + 6, dim)
        const dates = []
        for (let d = wkStart; d <= wkEnd; d++) {
          const dow = new Date(year, month - 1, d).getDay()
          if (dow !== 0 && dow !== 6) {
            dates.push(`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
          }
        }
        if (dates.length) {
          const pastDates = isCurrentMonth ? dates.filter(d => d <= todayStr) : dates
          if (!pastDates.length) { wkStart += 7; continue }
          const wkItems  = empItems.filter(r => pastDates.includes(r.date))
          const office   = wkItems.filter(r => r.status === 'in_office').length
          const wfhCount = wkItems.filter(r => r.status === 'wfh').length
          const expected = pastDates.length * empUsers.length
          const absent   = Math.max(0, expected - office - wfhCount)
          weekTrend.push({ label: `Wk ${Math.ceil(wkStart / 7)}`, inOffice: office, wfh: wfhCount, absent })
        }
        wkStart += 7
      }

      // 2. Day-of-week presence rate
      const DOW = ['Mon','Tue','Wed','Thu','Fri']
      const dowData = DOW.map((label, i) => {
        const dayNum = i + 1
        const dates = []
        for (let d = 1; d <= lastDay; d++) {
          if (new Date(year, month - 1, d).getDay() === dayNum)
            dates.push(`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
        }
        if (!dates.length) return null
        const dayItems = empItems.filter(r => dates.includes(r.date))
        const present  = dayItems.filter(r => ['in_office','wfh'].includes(r.status)).length
        const expected = dates.length * empUsers.length
        const rate     = expected > 0 ? Math.round(present / expected * 100) : 0
        return { label, rate, occurrences: dates.length }
      }).filter(Boolean)

      // 3. Arrival time distribution (IST, 30-min buckets 8:00–12:00)
      const toISTMinutes = (iso) => {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(new Date(iso))
        const h = parseInt(parts.find(p => p.type === 'hour').value,   10)
        const m = parseInt(parts.find(p => p.type === 'minute').value, 10)
        return h * 60 + m
      }

      const timeSlots = []
      for (let h = 8; h <= 11; h++) {
        for (let m = 0; m < 60; m += 30) {
          const slotMin = h * 60 + m
          const label   = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
          const count   = empItems.filter(r => {
            if (!r.check_in_time) return false
            const arrMin = toISTMinutes(r.check_in_time)
            return arrMin >= slotMin && arrMin < slotMin + 30
          }).length
          timeSlots.push({ label, count, isLate: slotMin >= lateThreshold })
        }
      }
      const after12 = empItems.filter(r => {
        if (!r.check_in_time) return false
        return toISTMinutes(r.check_in_time) >= 12 * 60
      }).length
      if (after12 > 0) timeSlots.push({ label: '12:00+', count: after12, isLate: true })

      setPreview({ rows, workdays, totals, totalItems: items.length, isCurrentMonth, weekTrend, dowData, timeSlots, settings })
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoadingPrev(false)
    }
  }, [month, year])

  useEffect(() => { loadPreview() }, [loadPreview])

  const download = async (kind) => {
    setBusyKind(kind)
    try {
      const wb  = await buildExcel(kind, year, month)
      const buf = await wb.xlsx.writeBuffer()
      const m   = MONTHS.find(x => x.value === month)?.label?.toLowerCase() || month
      await window.api?.saveExcel(buf, `${kind}_report_${year}_${m}.xlsx`)
      toast('Report saved to Downloads!', 'success')
    } catch (e) {
      console.error(e)
      toast(e.message, 'error')
    } finally {
      setBusyKind(null)
    }
  }

  const monthLabel = MONTHS.find(m => m.value === month)?.label || ''

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">{monthLabel} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month} onChange={v => setMonth(Number(v))} options={MONTHS} className="w-36" />
          <Select value={year}  onChange={v => setYear(Number(v))}  options={YEARS}  className="w-24" />
          <Button variant="secondary" onClick={loadPreview} loading={loadingPrev} className="gap-2 text-sm">
            <RefreshCw size={13} className={loadingPrev ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Summary band */}
      {preview && (() => {
        const totalSlots  = preview.workdays * preview.rows.length
        const teamAttPct  = totalSlots > 0 ? Math.round(preview.totals.present / totalSlots * 100) : 0
        const onTimePct   = preview.totals.present > 0 ? Math.round((preview.totals.present - preview.totals.late) / preview.totals.present * 100) : 0
        const wfhPct      = preview.totals.present > 0 ? Math.round(preview.totals.wfh / preview.totals.present * 100) : 0
        const avgDaily    = preview.workdays > 0 ? Math.round(preview.totals.present / preview.workdays) : 0
        const daysSuffix  = preview.isCurrentMonth ? ' working days so far' : ' working days'
        const stats = [
          { label: 'Team Attendance',  value: `${teamAttPct}%`, sub: `${preview.workdays}${daysSuffix}`,                    color: 'text-accent-400',  bg: 'bg-accent-500/10',  border: 'border-accent-500/20'  },
          { label: 'On-time Rate',     value: `${onTimePct}%`,  sub: `${preview.totals.late} late arrival${preview.totals.late !== 1 ? 's' : ''}`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { label: 'WFH Rate',         value: `${wfhPct}%`,     sub: `of all present days`,                                  color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
          { label: 'Avg Daily Presence', value: `${avgDaily}`,  sub: `employees per working day`,                            color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
        ]
        return (
          <div className="grid grid-cols-4 gap-3">
            {stats.map(s => (
              <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl px-4 py-3`}>
                <p className={`text-2xl font-bold font-mono tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-300 mt-0.5 font-medium">{s.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Analytics charts */}
      {preview && (preview.weekTrend?.length > 0 || preview.dowData?.length > 0 || preview.timeSlots?.some(s => s.count > 0)) && (
        <div className="grid grid-cols-3 gap-3">
          <WeekTrendChart   data={preview.weekTrend} />
          <DayOfWeekChart   data={preview.dowData}   />
          <ArrivalTimeChart data={preview.timeSlots} />
        </div>
      )}

      {/* Preview table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-200">
            {monthLabel} {year} — Team Attendance
            {preview && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                {preview.workdays} working day{preview.workdays !== 1 ? 's' : ''}{preview.isCurrentMonth ? ' so far' : ''} · {preview.rows.length} employees
              </span>
            )}
          </p>
          <p className="text-[10px] text-gray-600">Sorted by Attendance Score ↓</p>
        </div>

        {loadingPrev ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-white/[0.03] animate-pulse"
                style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        ) : preview?.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['#', 'Employee', 'Dept', 'Present', 'WFH', 'Late', 'Absent', 'Att %', 'Score'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => {
                  const grade = scoreGrade(r.score)
                  return (
                    <tr key={r.id}
                      onClick={() => setDeepDive(r)}
                      className={`border-b border-white/[0.04] hover:bg-white/[0.05] transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
                      <td className="px-3 py-2.5 text-xs text-gray-600 font-mono w-8">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <p className="text-sm text-gray-200 font-medium truncate max-w-[150px]">{r.full_name}</p>
                        <p className="text-xs text-gray-600 font-mono">{r.employee_id}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{r.department || '—'}</td>
                      <td className="px-3 py-2.5 text-sm font-mono font-semibold text-emerald-400">{r.present}</td>
                      <td className="px-3 py-2.5 text-sm font-mono text-blue-400">{r.wfh || '—'}</td>
                      <td className="px-3 py-2.5 text-sm font-mono text-amber-400">{r.late || '—'}</td>
                      <td className="px-3 py-2.5 text-sm font-mono text-red-400">{r.absent}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          r.pct >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
                          r.pct >= 60 ? 'bg-amber-500/15 text-amber-400' :
                                        'bg-red-500/15 text-red-400'
                        }`}>{r.pct}%</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold font-mono tabular-nums ${grade.color}`}>{r.score}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${grade.bg} ${grade.color}`}>
                            {grade.label}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm font-medium text-gray-300">No data for {monthLabel} {year}</p>
            <p className="text-xs text-gray-500 mt-1">Try a different month, or check that employees have checked in.</p>
          </div>
        )}
      </Card>

      {/* Export section */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Export Reports</p>
        <div className="grid grid-cols-4 gap-3">
          {REPORT_TYPES.map(({ kind, icon, title, desc }) => (
            <button
              key={kind}
              onClick={() => download(kind)}
              disabled={!!busyKind}
              className="flex flex-col gap-3 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]
                         hover:bg-white/[0.05] hover:border-white/[0.15] transition-all text-left group
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-2xl leading-none">{icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {busyKind === kind ? (
                  <span className="flex items-center gap-1.5 text-accent-400">
                    <RefreshCw size={11} className="animate-spin" /> Generating…
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-gray-500 group-hover:text-accent-400 transition-colors">
                    <Download size={11} /> Download Excel
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Daily report always exports today's data. All other reports use the selected month above.
        </p>
      </div>

      {/* Employee deep-dive panel */}
      <AnimatePresence>
        {deepDive && (
          <EmployeeDeepDive
            row={deepDive}
            workdays={preview?.workdays ?? 0}
            month={month}
            year={year}
            settings={preview?.settings}
            onClose={() => setDeepDive(null)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
