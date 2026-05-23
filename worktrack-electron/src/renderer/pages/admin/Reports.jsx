import React, { useState, useEffect, useCallback } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { getAllAttendance, getUsers, getSettings } from '../../lib/supabase'
import { Card, Button, Select } from '../../components/ui'
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

export default function Reports() {
  const now   = new Date()
  const toast = useToast()
  const [month,       setMonth      ] = useState(now.getMonth() + 1)
  const [year,        setYear       ] = useState(now.getFullYear())
  const [preview,     setPreview    ] = useState(null)
  const [loadingPrev, setLoadingPrev] = useState(false)
  const [busyKind,    setBusyKind   ] = useState(null)

  const loadPreview = useCallback(async () => {
    setLoadingPrev(true)
    try {
      const start = `${year}-${String(month).padStart(2,'0')}-01`
      const end   = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`
      const [{ items }, users] = await Promise.all([
        getAllAttendance({ start, end, limit: 5000 }),
        getUsers(),
      ])

      let workdays = 0
      const daysInMonth = new Date(year, month, 0).getDate()
      for (let d = 1; d <= daysInMonth; d++) {
        const wd = new Date(year, month - 1, d).getDay()
        if (wd !== 0 && wd !== 6) workdays++
      }

      const byUser = {}
      items.forEach(r => {
        if (!byUser[r.user_id]) byUser[r.user_id] = []
        byUser[r.user_id].push(r)
      })

      const rows = users.map(u => {
        const recs    = byUser[u.id] || []
        const present = recs.filter(r => ['in_office','wfh'].includes(r.status)).length
        const wfh     = recs.filter(r => r.status === 'wfh').length
        const late    = recs.filter(r => r.is_late).length
        const absent  = Math.max(0, workdays - present)
        const pct     = workdays > 0 ? Math.round(present / workdays * 100) : 0
        return { ...u, present, wfh, late, absent, pct }
      })

      // Summary totals
      const totals = rows.reduce((acc, r) => ({
        present: acc.present + r.present,
        wfh:     acc.wfh     + r.wfh,
        late:    acc.late    + r.late,
        absent:  acc.absent  + r.absent,
      }), { present: 0, wfh: 0, late: 0, absent: 0 })

      setPreview({ rows, workdays, totals, totalItems: items.length })
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
      {preview && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Check-ins',  value: preview.totalItems,      color: 'text-accent-400',   bg: 'bg-accent-500/10',   border: 'border-accent-500/20' },
            { label: 'Present Days',     value: preview.totals.present,  color: 'text-emerald-400',  bg: 'bg-emerald-500/10',  border: 'border-emerald-500/20' },
            { label: 'WFH Days',         value: preview.totals.wfh,      color: 'text-blue-400',     bg: 'bg-blue-500/10',     border: 'border-blue-500/20' },
            { label: 'Late Arrivals',    value: preview.totals.late,     color: 'text-amber-400',    bg: 'bg-amber-500/10',    border: 'border-amber-500/20' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl px-4 py-3`}>
              <p className={`text-2xl font-bold font-mono tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Preview table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-200">
            {monthLabel} {year} — Team Attendance
            {preview && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                {preview.workdays} working days · {preview.rows.length} employees
              </span>
            )}
          </p>
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
                  {['Employee', 'Department', 'Present', 'WFH', 'Late', 'Absent', 'Att %'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={r.id}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-gray-200 font-medium truncate max-w-[160px]">{r.full_name}</p>
                      <p className="text-xs text-gray-600 font-mono">{r.employee_id}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{r.department || '—'}</td>
                    <td className="px-4 py-2.5 text-sm font-mono font-semibold text-emerald-400">{r.present}</td>
                    <td className="px-4 py-2.5 text-sm font-mono text-blue-400">{r.wfh || '—'}</td>
                    <td className="px-4 py-2.5 text-sm font-mono text-amber-400">{r.late || '—'}</td>
                    <td className="px-4 py-2.5 text-sm font-mono text-red-400">{r.absent}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        r.pct >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
                        r.pct >= 60 ? 'bg-amber-500/15 text-amber-400' :
                                      'bg-red-500/15 text-red-400'
                      }`}>{r.pct}%</span>
                    </td>
                  </tr>
                ))}
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

    </div>
  )
}
