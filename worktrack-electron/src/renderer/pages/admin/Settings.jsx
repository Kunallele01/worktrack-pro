import React, { useState, useEffect } from 'react'
import { getSettings, updateSettings, getHolidays, saveHolidays, flushTestData, flushAttendanceByDate } from '../../lib/supabase'
import { Card, Button, Input, PasswordInput } from '../../components/ui'
import { useToast } from '../../components/ui'
import { Trash2, Plus, MapPin, CalendarDays, Bell, Mail, Palmtree, AlertTriangle } from 'lucide-react'

function Section({ icon, title, accent = 'bg-accent-500/15 border-accent-500/30 text-accent-400', children }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/[0.06]">
        {icon && (
          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${accent}`}>
            {icon}
          </div>
        )}
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  )
}

export default function AdminSettings() {
  const toast = useToast()
  const [s, setS] = useState({})
  const [saving, setSaving] = useState({})

  useEffect(() => { getSettings(true).then(setS) }, [])
  const set = (k) => (e) => setS(prev => ({ ...prev, [k]: e.target.value }))

  const save = (keys) => async () => {
    const key = keys[0]
    setSaving(p => ({ ...p, [key]: true }))
    try {
      const payload = Object.fromEntries(keys.map(k => [k, s[k] || '']))
      await updateSettings(payload)
      toast('Settings saved!', 'success')
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(p => ({ ...p, [key]: false })) }
  }

  async function testEmail() {
    setSaving(p => ({ ...p, test: true }))
    try {
      const to = s.admin_email || s.smtp_username
      if (!to) { toast('Set Admin Email first.', 'warning'); return }
      await window.api?.sendEmail({
        host: s.smtp_host, port: s.smtp_port, user: s.smtp_username,
        pass: s.smtp_password, fromName: s.smtp_from_name || 'WorkTrack Pro',
        to, subject: 'WorkTrack Pro — Test Email',
        html: '<p>Your SMTP email configuration is working correctly!</p>',
      })
      toast(`Test email sent to ${to}!`, 'success')
    } catch (e) { toast(`Email failed: ${e.message}`, 'error') }
    finally { setSaving(p => ({ ...p, test: false })) }
  }

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
      <h1 className="text-xl font-bold text-gray-100">Admin Settings</h1>

      <Section icon={<MapPin size={13} />} title="Office Location & Hours"
        accent="bg-emerald-500/15 border-emerald-500/30 text-emerald-400">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Office Latitude"  value={s.office_latitude  || ''} onChange={set('office_latitude')}  placeholder="18.46020…" />
          <Input label="Office Longitude" value={s.office_longitude || ''} onChange={set('office_longitude')} placeholder="73.79893…" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Check-in Radius (metres) — current: {s.office_radius_m || 200}m
            </label>
            <input type="range" min="50" max="500" step="25"
              value={s.office_radius_m || 200}
              onChange={set('office_radius_m')}
              className="w-full accent-accent-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Office Start Time (IST)</label>
              <input type="time" value={s.office_start_time || '09:30'} onChange={set('office_start_time')}
                className="input-base py-2.5 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Auto Checkout Time (IST)</label>
              <input type="time" value={s.auto_checkout_time || '20:00'} onChange={set('auto_checkout_time')}
                className="input-base py-2.5 text-sm" />
            </div>
          </div>
        </div>
        <Input label="Company Name" value={s.company_name || ''} onChange={set('company_name')} placeholder="Your Company" />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Office WiFi Network Name(s) — Primary check-in method for desktops
          </label>
          <p className="text-xs text-gray-500">If an employee is connected to this WiFi, they are marked In Office regardless of GPS accuracy. One SSID per line.</p>
          <textarea rows={3} value={s.office_wifi_ssid || ''} onChange={set('office_wifi_ssid')}
            placeholder="OfficeWiFi&#10;OfficeWiFi_5G"
            className="input-base resize-none font-mono text-xs" />
        </div>
        {/* Grace Period */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Grace Period — {s.grace_period_minutes || 10} minutes after office start before marking Late
          </label>
          <input type="range" min="0" max="30" step="5"
            value={s.grace_period_minutes || 10}
            onChange={set('grace_period_minutes')}
            className="w-full" />
          <p className="text-xs text-gray-500">0 = strict (9:31 is late) · 10 = relaxed (9:40 is fine) · 30 = very relaxed</p>
        </div>

        <Button onClick={save(['office_latitude','office_longitude','office_radius_m','office_start_time','auto_checkout_time','grace_period_minutes','company_name','office_wifi_ssid'])}
          loading={saving.office_latitude} className="w-fit text-sm">
          Save Office Settings
        </Button>
      </Section>

      <Section icon={<CalendarDays size={13} />} title="Leave Quotas (Days per Year)"
        accent="bg-blue-500/15 border-blue-500/30 text-blue-400">
        <div className="grid grid-cols-3 gap-4">
          <Input label="Sick Leave (SL)" type="number" min="0" max="365"
            value={s.leave_sick_quota || '10'} onChange={set('leave_sick_quota')} placeholder="10" />
          <Input label="Casual Leave (CL)" type="number" min="0" max="365"
            value={s.leave_casual_quota || '12'} onChange={set('leave_casual_quota')} placeholder="12" />
          <Input label="Planned Leave (PL)" type="number" min="0" max="365"
            value={s.leave_planned_quota || '5'} onChange={set('leave_planned_quota')} placeholder="5" />
        </div>
        <p className="text-xs text-gray-500">Emergency leave has no fixed limit. These quotas are shown to employees on their My Leaves page.</p>
        <Button onClick={save(['leave_sick_quota','leave_casual_quota','leave_planned_quota'])}
          loading={saving.leave_sick_quota} className="w-fit text-sm">
          Save Leave Quotas
        </Button>
      </Section>

      <Section icon={<Bell size={13} />} title="Check-in Reminders"
        accent="bg-amber-500/15 border-amber-500/30 text-amber-400">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-200">Auto-remind employees who haven't checked in</p>
            <p className="text-xs text-gray-500 mt-0.5">Sends a reminder email at the configured time. Requires SMTP to be set up.</p>
          </div>
          <button
            onClick={() => setS(p => ({ ...p, reminder_enabled: p.reminder_enabled === 'true' ? 'false' : 'true' }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${s.reminder_enabled === 'true' ? 'bg-accent-500' : 'bg-gray-600'}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200
              ${s.reminder_enabled === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {s.reminder_enabled === 'true' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reminder Time (IST)</label>
            <input type="time" value={s.reminder_time || '10:30'} onChange={set('reminder_time')}
              className="input-base py-2.5 text-sm w-40" />
            <p className="text-xs text-gray-500">Reminder fires once per day when the admin app is open past this time.</p>
          </div>
        )}
        <Button onClick={save(['reminder_enabled','reminder_time'])}
          loading={saving.reminder_enabled} className="w-fit text-sm">
          Save Reminder Settings
        </Button>
      </Section>

      <Section icon={<Mail size={13} />} title="Email (SMTP)"
        accent="bg-violet-500/15 border-violet-500/30 text-violet-400">
        <p className="text-xs text-gray-400">
          Gmail: host=smtp.gmail.com port=587 — use an <strong>App Password</strong> (not your Google account password).<br/>
          Outlook: host=smtp-mail.outlook.com port=587
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Input label="SMTP Host" value={s.smtp_host || ''} onChange={set('smtp_host')} placeholder="smtp.gmail.com" />
          </div>
          <Input label="Port" value={s.smtp_port || '587'} onChange={set('smtp_port')} placeholder="587" />
        </div>
        <Input label="Your Email (sender)" value={s.smtp_username || ''} onChange={set('smtp_username')} placeholder="you@gmail.com" type="email" />
        <PasswordInput label="SMTP Password / App Password" value={s.smtp_password || ''} onChange={set('smtp_password')} placeholder="Gmail App Password" />
        <Input label="From Name" value={s.smtp_from_name || ''} onChange={set('smtp_from_name')} placeholder="WorkTrack Pro" />
        <Input label="Admin Notification Email" value={s.admin_email || ''} onChange={set('admin_email')} placeholder="admin@company.com" type="email" />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">WFH Alert Emails (one per line)</label>
          <textarea rows={3} value={s.wfh_notify_emails || ''} onChange={set('wfh_notify_emails')}
            placeholder="manager@company.com&#10;hr@company.com"
            className="input-base resize-none font-mono text-xs" />
        </div>
        <div className="flex gap-3">
          <Button onClick={save(['smtp_host','smtp_port','smtp_username','smtp_password','smtp_from_name','admin_email','wfh_notify_emails'])}
            loading={saving.smtp_host} className="text-sm">Save Email Settings</Button>
          <Button variant="secondary" onClick={testEmail} loading={saving.test} className="text-sm">Send Test Email</Button>
        </div>
      </Section>

      <HolidaySection />
      <FlushByDate />
      <DangerZone />
    </div>
  )
}

// ── Flush by date ─────────────────────────────────────────────────────────── //

function FlushByDate() {
  const toast = useToast()
  const today = new Date().toLocaleDateString('sv-SE')
  const [date,     setDate    ] = useState(today)
  const [open,     setOpen    ] = useState(false)
  const [confirm,  setConfirm ] = useState('')
  const [flushing, setFlushing] = useState(false)

  const ready = confirm.trim().toUpperCase() === 'DELETE'

  async function handleFlush() {
    if (!ready || !date) return
    setFlushing(true)
    try {
      await flushAttendanceByDate(date)
      toast(`All attendance records for ${date} deleted.`, 'success')
      setOpen(false)
      setConfirm('')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setFlushing(false)
    }
  }

  return (
    <Card className="p-5 border border-red-500/20">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-red-500/10">
        <div className="w-7 h-7 rounded-lg border bg-red-500/15 border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
          <AlertTriangle size={13} />
        </div>
        <h3 className="text-sm font-semibold text-red-400">Flush Attendance — Specific Date</h3>
      </div>

      {!open ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-200">Delete all attendance for a date</p>
            <p className="text-xs text-gray-500 mt-0.5">Use this to wipe a day's records if data was corrupted (e.g. wrong auto-checkout).</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 ml-4 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            Flush Date…
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 leading-relaxed">
            ⚠️ This will permanently delete <strong>all attendance records for the selected date</strong>. Cannot be undone.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="input-base py-2 text-sm w-44" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Type <span className="text-red-400 font-mono">DELETE</span> to confirm
            </label>
            <input value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="DELETE" className="input-base py-2 text-sm font-mono tracking-widest" autoFocus />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleFlush}
              disabled={!ready || flushing}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                ready ? 'bg-red-500 text-white hover:bg-red-600 cursor-pointer' : 'bg-red-500/20 text-red-800 cursor-not-allowed'
              }`}
            >
              {flushing ? 'Deleting…' : `Delete ${date}`}
            </button>
            <button onClick={() => { setOpen(false); setConfirm('') }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Danger Zone ───────────────────────────────────────────────────────────── //

function DangerZone() {
  const toast = useToast()
  const [confirm, setConfirm] = useState('')
  const [flushing, setFlushing] = useState(false)
  const [open, setOpen] = useState(false)

  const ready = confirm.trim().toUpperCase() === 'FLUSH'

  async function handleFlush() {
    if (!ready) return
    setFlushing(true)
    try {
      await flushTestData()
      toast('All test data flushed. Attendance, leave requests and corrections cleared.', 'success')
      setOpen(false)
      setConfirm('')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setFlushing(false)
    }
  }

  return (
    <Card className="p-5 border border-red-500/20">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-red-500/10">
        <div className="w-7 h-7 rounded-lg border bg-red-500/15 border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
          <AlertTriangle size={13} />
        </div>
        <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
      </div>

      {!open ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-200">Flush All Test Data</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Wipes attendance, leave requests and correction records. Profiles, settings and holidays stay.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 ml-4 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            Flush Data…
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 leading-relaxed">
            ⚠️ This will permanently delete <strong>all attendance records, leave requests and correction requests</strong>.
            Profiles, settings and holidays will not be affected. This cannot be undone.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Type <span className="text-red-400 font-mono">FLUSH</span> to confirm
            </label>
            <input
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="FLUSH"
              className="input-base py-2 text-sm font-mono tracking-widest"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleFlush}
              disabled={!ready || flushing}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                ready
                  ? 'bg-red-500 text-white hover:bg-red-600 cursor-pointer'
                  : 'bg-red-500/20 text-red-800 cursor-not-allowed'
              }`}
            >
              {flushing ? 'Flushing…' : 'Confirm Flush'}
            </button>
            <button
              onClick={() => { setOpen(false); setConfirm('') }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Holiday Calendar Section ──────────────────────────────────────────────── //

function HolidaySection() {
  const toast = useToast()
  const [holidays, setHolidays] = useState([])
  const [newDate,  setNewDate ] = useState('')
  const [newName,  setNewName ] = useState('')
  const [saving,   setSaving  ] = useState(false)

  useEffect(() => { getHolidays().then(setHolidays) }, [])

  const add = () => {
    if (!newDate || !newName.trim()) { toast('Enter both a date and a holiday name.', 'warning'); return }
    if (holidays.some(h => h.date === newDate)) { toast('That date is already a holiday.', 'warning'); return }
    const sorted = [...holidays, { date: newDate, name: newName.trim() }]
      .sort((a, b) => a.date.localeCompare(b.date))
    setHolidays(sorted)
    setNewDate(''); setNewName('')
  }

  const remove = (date) => setHolidays(h => h.filter(x => x.date !== date))

  const save = async () => {
    setSaving(true)
    try { await saveHolidays(holidays); toast('Holidays saved!', 'success') }
    catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-1 pb-3 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg border bg-rose-500/15 border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
          <Palmtree size={13} />
        </div>
        <h3 className="text-sm font-semibold text-gray-200">Company Holidays</h3>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Holidays are excluded from working day counts. Employees won't be marked absent on these dates.
      </p>

      {/* Add new holiday */}
      <div className="flex gap-2 mb-4">
        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
          className="input-base py-2 text-sm w-44" />
        <input placeholder="Holiday name (e.g. Diwali)" value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          className="input-base py-2 text-sm flex-1" />
        <Button onClick={add} variant="secondary" className="text-sm gap-1.5 shrink-0">
          <Plus size={14} /> Add
        </Button>
      </div>

      {/* List */}
      {holidays.length === 0
        ? <p className="text-sm text-gray-500 text-center py-4">No holidays added yet.</p>
        : (
          <div className="space-y-1.5 mb-4 max-h-64 overflow-y-auto pr-1">
            {holidays.map(h => (
              <div key={h.date} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div>
                  <p className="text-sm text-gray-200 font-medium">{h.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{h.date}</p>
                </div>
                <button onClick={() => remove(h.date)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      }

      <Button onClick={save} loading={saving} className="text-sm">Save Holidays</Button>
    </Card>
  )
}
