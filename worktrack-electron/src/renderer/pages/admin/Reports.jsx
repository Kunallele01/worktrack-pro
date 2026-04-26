import React, { useState } from 'react'
import { Download } from 'lucide-react'
import { getAllAttendance, getUsers } from '../../lib/supabase'
import { Card, Button, Select } from '../../components/ui'
import { useToast } from '../../components/ui'
import { format } from 'date-fns'

const MONTHS = [
  { value: 1,  label: 'January'  }, { value: 2,  label: 'February' },
  { value: 3,  label: 'March'    }, { value: 4,  label: 'April'    },
  { value: 5,  label: 'May'      }, { value: 6,  label: 'June'     },
  { value: 7,  label: 'July'     }, { value: 8,  label: 'August'   },
  { value: 9,  label: 'September'}, { value: 10, label: 'October'  },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
]
const YEARS = [2024, 2025, 2026, 2027].map(y => ({ value: y, label: String(y) }))

const STATUS_FILLS = {
  in_office:    'FFD1FAE5', wfh: 'FFBFDBFE', absent: 'FFFECACA',
  late:         'FFFEF08A', auto_checkout: 'FFE2E8F0',
}

function fmtT(iso) {
  if (!iso) return ''
  try { return format(new Date(iso), 'hh:mm a') } catch { return '' }
}
function calcHours(ci, co) {
  if (!ci || !co) return ''
  const h = (new Date(co) - new Date(ci)) / 3600000
  return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`
}

async function applyTitleRow(ws, title, colCount) {
  ws.mergeCells(1, 1, 1, colCount)
  const c = ws.getCell('A1')
  c.value     = title
  c.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  c.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 28
}

async function applyHeaderRow(ws, headers, rowNum = 2) {
  headers.forEach((h, i) => {
    const cell = ws.getCell(rowNum, i + 1)
    cell.value     = h
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = {
      bottom: { style: 'thin', color: { argb: 'FF475569' } },
    }
  })
  ws.getRow(rowNum).height = 22
}

async function buildExcel(kind, year, month) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'WorkTrack Pro'
  wb.created = new Date()

  const monthLabel = MONTHS.find(m => m.value === month)?.label || ''
  const dateRange  = `${monthLabel} ${year}`
  const today      = new Date().toLocaleDateString('sv-SE')
  const start      = kind === 'daily' ? today : `${year}-${String(month).padStart(2,'0')}-01`
  const end        = kind === 'daily' ? today : `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`

  let { items } = await getAllAttendance({ start, end, status: kind === 'wfh' ? 'wfh' : undefined, limit: 5000 })
  if (kind === 'late') items = items.filter(r => r.is_late)

  // ── Monthly: per-employee sheets ────────────────────────────────────────── //
  if (kind === 'monthly') {
    const users   = await getUsers({ limit: 500 })
    const byUser  = {}
    items.forEach(r => {
      if (!byUser[r.user_id]) byUser[r.user_id] = []
      byUser[r.user_id].push(r)
    })
    const daysInMonth = new Date(year, month, 0).getDate()
    const allDays = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month - 1, i + 1)
      return { date: d.toLocaleDateString('sv-SE'), day: d.toLocaleDateString('en', { weekday: 'short' }) }
    })

    // ── Summary sheet ────────────────────────────────────────────────────── //
    const summary = wb.addWorksheet('📊 Summary')
    summary.views = [{ showGridLines: false }]
    await applyTitleRow(summary, `WorkTrack Pro — ${dateRange} — Team Summary`, 8)
    summary.getRow(2).values = ['', 'Generated:', format(new Date(), 'dd MMM yyyy, hh:mm a'), '', '', '', '', '']
    summary.getRow(2).getCell(2).font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 }
    await applyHeaderRow(summary, ['Employee', 'Employee ID', 'Department', 'Present', 'WFH', 'Late', 'Absent', 'Attendance %'], 3)
    summary.views = [{ state: 'frozen', ySplit: 3 }]

    const workdays = allDays.filter(d => {
      const wd = new Date(d.date + 'T12:00:00').getDay()
      return wd !== 0 && wd !== 6
    }).length

    let row = 4
    users.forEach(u => {
      const recs = byUser[u.id] || []
      const present = recs.filter(r => ['in_office','wfh'].includes(r.status)).length
      const wfh     = recs.filter(r => r.status === 'wfh').length
      const late    = recs.filter(r => r.is_late).length
      const pct     = workdays > 0 ? Math.round(present / workdays * 100) : 0
      const absent  = Math.max(0, workdays - present)
      const bg      = row % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF'

      const vals = [u.full_name, u.employee_id, u.department || '', present, wfh, late, absent, `${pct}%`]
      vals.forEach((v, i) => {
        const c = summary.getCell(row, i + 1)
        c.value = v
        c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        if (i === 7) {
          c.font = { bold: true, color: { argb: pct >= 80 ? 'FF059669' : pct >= 60 ? 'FFD97706' : 'FFDC2626' } }
        }
      })
      row++
    })
    summary.columns = [
      { width: 26 }, { width: 12 }, { width: 18 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 14 },
    ]

    // ── Per-employee sheets ───────────────────────────────────────────────── //
    for (const u of users) {
      const sheetName = u.full_name.replace(/[*?:\\/[\]]/g, '').substring(0, 31)
      const ws = wb.addWorksheet(sheetName)
      ws.views = [{ showGridLines: false }]

      await applyTitleRow(ws, `${u.full_name} — ${dateRange}`, 7)

      // Employee info block
      ws.getRow(2).values = ['', 'Employee ID:', u.employee_id, '', 'Department:', u.department || '—', '']
      ws.getRow(2).font   = { color: { argb: 'FF94A3B8' }, size: 10 }
      ws.getRow(2).getCell(2).font = { bold: true, color: { argb: 'FF94A3B8' }, size: 10 }
      ws.getRow(2).getCell(5).font = { bold: true, color: { argb: 'FF94A3B8' }, size: 10 }

      await applyHeaderRow(ws, ['Date', 'Day', 'Check-in', 'Check-out', 'Status', 'Late?', 'Hours'], 3)
      ws.views = [{ state: 'frozen', ySplit: 3 }]

      const userRecs = byUser[u.id] || []
      const byDate   = {}
      userRecs.forEach(r => { byDate[r.date] = r })

      let r = 4
      allDays.forEach(({ date, day }) => {
        const isWeekend = ['Sat','Sun'].includes(day)
        const rec       = byDate[date]
        const status    = rec?.status || (isWeekend ? 'weekend' : '—')
        const bg        = isWeekend ? 'FFF1F5F9'
                        : STATUS_FILLS[status] || (r % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF')

        const vals = [
          date, day,
          fmtT(rec?.check_in_time),
          fmtT(rec?.check_out_time),
          status === 'weekend' ? '—' : status || '—',
          rec?.is_late ? '⚑ Yes' : '—',
          calcHours(rec?.check_in_time, rec?.check_out_time),
        ]
        vals.forEach((v, i) => {
          const c = ws.getCell(r, i + 1)
          c.value = v
          c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
          if (i === 4 && rec?.status) {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILLS[rec.status] || bg } }
          }
          if (isWeekend) c.font = { color: { argb: 'FF94A3B8' } }
        })
        r++
      })

      // Summary footer
      r++
      const userItems = Object.values(byDate)
      const present = userItems.filter(x => ['in_office','wfh'].includes(x.status)).length
      const late    = userItems.filter(x => x.is_late).length

      const footerData = [
        ['Total Working Days', workdays],
        ['Days Present',       present],
        ['WFH Days',           userItems.filter(x => x.status === 'wfh').length],
        ['Late Arrivals',      late],
        ['Attendance %',       `${workdays > 0 ? Math.round(present / workdays * 100) : 0}%`],
      ]
      footerData.forEach(([label, val]) => {
        ws.getCell(r, 1).value = label
        ws.getCell(r, 1).font  = { bold: true, color: { argb: 'FF64748B' }, size: 10 }
        ws.getCell(r, 2).value = val
        ws.getCell(r, 2).font  = { bold: true, size: 10 }
        ws.getCell(r, 2).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
        r++
      })

      ws.columns = [
        { width: 14 }, { width: 8 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 8 }, { width: 10 },
      ]
    }
    return wb
  }

  // ── Other report types (daily, late, wfh) — single sheet ─────────────────── //
  const ws      = wb.addWorksheet(kind.charAt(0).toUpperCase() + kind.slice(1))
  const headers = ['Employee', 'Employee ID', 'Dept', 'Date', 'Check-in', 'Check-out', 'Status', 'Late?', 'Hours']
  ws.views      = [{ showGridLines: false }]
  await applyTitleRow(ws, `WorkTrack Pro — ${kind.charAt(0).toUpperCase() + kind.slice(1)} — ${dateRange}`, headers.length)
  ws.getRow(2).getCell(1).value = `Generated: ${format(new Date(), 'dd MMM yyyy hh:mm a')}`
  ws.getRow(2).getCell(1).font  = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 }
  await applyHeaderRow(ws, headers, 3)
  ws.views = [{ state: 'frozen', ySplit: 3 }]

  items.forEach((rec, idx) => {
    const p   = rec.profiles || {}
    const bg  = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'
    const vals = [
      p.full_name || '', p.employee_id || '', p.department || '',
      rec.date,
      fmtT(rec.check_in_time), fmtT(rec.check_out_time),
      rec.status, rec.is_late ? '⚑ Yes' : '—',
      calcHours(rec.check_in_time, rec.check_out_time),
    ]
    vals.forEach((v, i) => {
      const c = ws.getCell(idx + 4, i + 1)
      c.value = v
      c.fill  = { type: 'pattern', pattern: 'solid',
                  fgColor: { argb: i === 6 ? (STATUS_FILLS[rec.status] || bg) : bg } }
    })
  })
  ws.columns = [{ width: 24 }, { width: 12 }, { width: 16 }, { width: 12 },
                { width: 11 }, { width: 11 }, { width: 14 }, { width: 8 }, { width: 10 }]
  return wb
}

function ReportCard({ icon, title, description, kind, month, year, onMonthChange, onYearChange }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const showDatePicker  = kind !== 'daily'

  const download = async () => {
    setBusy(true)
    try {
      const wb  = await buildExcel(kind, year, month)
      const buf = await wb.xlsx.writeBuffer()
      const m   = MONTHS.find(x => x.value === month)?.label?.toLowerCase() || month
      await window.api?.saveExcel(buf, `${kind}_report_${year}_${m}.xlsx`)
      toast(`Report saved to Downloads!`, 'success')
    } catch (e) {
      console.error(e)
      toast(e.message, 'error')
    } finally {
      setBusy(false) }
  }

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-semibold text-gray-100">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      {showDatePicker && (
        <div className="flex gap-2">
          <Select
            value={month}
            onChange={(v) => onMonthChange(Number(v))}
            options={MONTHS}
            className="flex-1"
          />
          <Select
            value={year}
            onChange={(v) => onYearChange(Number(v))}
            options={YEARS}
            className="w-28"
          />
        </div>
      )}
      <Button onClick={download} loading={busy} className="w-full gap-2 text-sm">
        <Download size={14} /> Download Excel
      </Button>
    </Card>
  )
}

export default function Reports() {
  const now   = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear ] = useState(now.getFullYear())
  const props = { month, year, onMonthChange: setMonth, onYearChange: setYear }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-xl font-bold text-gray-100 mb-6">Reports</h1>
      <div className="grid grid-cols-2 gap-4">
        <ReportCard icon="📅" title="Daily Report"        description="All check-ins for today."
          kind="daily" {...props} />
        <ReportCard icon="📊" title="Monthly Report"      description="Per-employee sheets + team summary."
          kind="monthly" {...props} />
        <ReportCard icon="⚑"  title="Late Arrivals"       description="Employees who arrived late this month."
          kind="late"    {...props} />
        <ReportCard icon="⌂"  title="WFH Summary"         description="All work-from-home check-ins."
          kind="wfh"     {...props} />
      </div>
    </div>
  )
}
