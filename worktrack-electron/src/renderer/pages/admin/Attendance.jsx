import React, { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { Download } from 'lucide-react'
import { getAllAttendance } from '../../lib/supabase'
import { Badge, Button, DataTable, Avatar, Card, Select } from '../../components/ui'
import { useToast } from '../../components/ui'

const STATUS_OPTIONS = [
  { value: '',             label: 'All Statuses' },
  { value: 'in_office',   label: '● In Office' },
  { value: 'wfh',         label: '⌂ WFH' },
  { value: 'absent',      label: '✕ Absent' },
  { value: 'auto_checkout',label: '↺ Auto-out' },
]

function fmtTime(iso) {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'hh:mm a') } catch { return '—' }
}
function fmtHours(ci, co) {
  if (!ci || !co) return '—'
  try {
    const diff = (new Date(co) - new Date(ci)) / 3600000
    return `${Math.floor(diff)}h ${Math.round((diff % 1) * 60)}m`
  } catch { return '—' }
}

export default function Attendance() {
  const toast   = useToast()
  const today   = new Date().toLocaleDateString('sv-SE')
  const [start, setStart]   = useState(today)
  const [end,   setEnd  ]   = useState(today)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [rows,  setRows ]   = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { items } = await getAllAttendance({ start, end, status: status || undefined, limit: 2000 })
      let filtered = items
      if (search) {
        const s = search.toLowerCase()
        filtered = items.filter(r =>
          r.profiles?.full_name?.toLowerCase().includes(s) ||
          r.profiles?.employee_id?.toLowerCase().includes(s)
        )
      }
      // Build rows with keys matching DataTable column keys so sorting works
      setRows(filtered.map(r => ({
        // Sortable / displayable values — keys MUST match column key props below
        name:       r.profiles?.full_name || '—',
        emp_id:     r.profiles?.employee_id || '—',
        department: r.profiles?.department || '—',
        date:       r.date,
        checkin:    fmtTime(r.check_in_time),
        checkout:   fmtTime(r.check_out_time),
        status:     r.status,
        late:       r.is_late ? 'Yes' : 'No',
        hours:      fmtHours(r.check_in_time, r.check_out_time),
        // Raw refs for custom renders
        _profiles:  r.profiles,
        _is_late:   r.is_late,
        _status:    r.status,
      })))
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [start, end, status])

  async function exportExcel() {
    toast('Generating Excel report…', 'info')
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Attendance')
      ws.columns = [
        { header: 'Employee',   key: 'name',       width: 25 },
        { header: 'ID',         key: 'emp_id',     width: 12 },
        { header: 'Dept',       key: 'department', width: 18 },
        { header: 'Date',       key: 'date',       width: 14 },
        { header: 'Check-in',   key: 'checkin',    width: 12 },
        { header: 'Check-out',  key: 'checkout',   width: 12 },
        { header: 'Status',     key: 'status',     width: 14 },
        { header: 'Hours',      key: 'hours',      width: 10 },
      ]
      ws.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      })
      rows.forEach((r, i) => {
        ws.addRow(r).eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } }
        })
      })
      const buffer = await wb.xlsx.writeBuffer()
      await window.api?.saveExcel(buffer, `attendance_${start}_to_${end}.xlsx`)
      toast(`Saved to Downloads!`, 'success')
    } catch (e) { toast(e.message, 'error') }
  }

  const columns = [
    { key: 'name', label: 'Employee', width: 220,
      render: (_, r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r._profiles?.full_name || ''} size={7} textSize="text-xs" />
          <div>
            <p className="text-sm text-gray-200">{r._profiles?.full_name || '—'}</p>
            <p className="text-xs text-gray-500 font-mono">{r._profiles?.employee_id}</p>
          </div>
        </div>
      )
    },
    { key: 'department', label: 'Dept', width: 100 },
    { key: 'date',       label: 'Date', width: 110 },
    { key: 'checkin',    label: 'Check-in',  width: 100,
      render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'checkout',   label: 'Check-out', width: 100,
      render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'status', label: 'Status', width: 120,
      render: (_, r) => r._status ? <Badge status={r._status} /> : '—' },
    { key: 'late', label: 'Late', width: 60,
      render: (_, r) => r._is_late ? <span className="text-amber-400 text-xs font-bold">⚑</span> : <span className="text-gray-600">—</span> },
    { key: 'hours', label: 'Hours', width: 80,
      render: (v) => <span className="font-mono text-xs">{v}</span> },
  ]

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Attendance</h1>
        <Button variant="secondary" onClick={exportExcel} className="gap-2 text-sm">
          <Download size={14} /> Export Excel
        </Button>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Start</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)}
            className="input-base py-2 text-sm w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide">End</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)}
            className="input-base py-2 text-sm w-40" />
        </div>
        <div className="flex flex-col gap-1 w-44">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Status</label>
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>
        <input placeholder="Search employee…" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          className="input-base py-2 text-sm w-56" />
        <Button onClick={load} loading={loading} className="text-sm">Apply</Button>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <DataTable columns={columns} data={rows} pageSize={50} />
      </Card>
    </div>
  )
}
