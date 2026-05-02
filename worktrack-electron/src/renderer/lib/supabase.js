import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lwnuunwxfgvketjtmreo.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3bnV1bnd4Zmd2a2V0anRtcmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNjg5MjQsImV4cCI6MjA5MjY0NDkyNH0.AklxvNAs0a6KwALEgXV-uPHh5SjfF7VF__ptBu83eWc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,   // Keep session in memory — login every session
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

// ── Auth ─────────────────────────────────────────────────────────────────── //

export async function signIn(identifier, password) {
  let email = identifier.trim()

  // Look up email by employee ID if no @ symbol
  if (!email.includes('@')) {
    const { data } = await supabase.rpc('get_email_by_employee_id', {
      p_employee_id: email.toUpperCase(),
    })
    if (!data) throw new Error('No account found with that Employee ID.')
    email = data
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('invalid') || msg.includes('credentials'))
      throw new Error('Incorrect email or password.')
    throw new Error(error.message)
  }

  const profile = await fetchProfile(data.user.id)
  if (!profile.is_active) {
    await supabase.auth.signOut()
    throw new Error('Account deactivated. Contact your administrator.')
  }

  // Update last_login
  supabase.from('profiles').update({ last_login: new Date().toISOString() })
    .eq('id', profile.id).then(() => {})

  return profile
}

export async function signUp(email, password, employee_id, full_name, department, birthday = null) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { employee_id: employee_id.toUpperCase(), full_name, department },
    },
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Registration failed.')
  // Give the trigger a moment to create the profile row
  await new Promise(r => setTimeout(r, 800))
  if (birthday) {
    await supabase.from('profiles').update({ birthday }).eq('id', data.user.id)
  }
  return fetchProfile(data.user.id)
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function sendPasswordOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) throw new Error(error.message)
}

export async function verifyOtpAndReset(email, otp, newPassword) {
  const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
  if (error) throw new Error('Invalid or expired code.')
  const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
  if (pwError) throw new Error(pwError.message)
  await supabase.auth.signOut()
}

export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

// ── Profiles ─────────────────────────────────────────────────────────────── //

export async function fetchProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw new Error(`Could not load profile: ${error.message}`)
  return data
}

export async function getUsers({ search = '', department = '', isActive = null, page = 1, limit = 100 } = {}) {
  let q = supabase.from('profiles').select('*').order('full_name')
  if (isActive !== null) q = q.eq('is_active', isActive)
  if (department)        q = q.eq('department', department)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  let items = data || []
  if (search) {
    const s = search.toLowerCase()
    items = items.filter(u =>
      u.full_name?.toLowerCase().includes(s) ||
      u.employee_id?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s)
    )
  }
  return items
}

export async function updateUser(userId, fields) {
  const allowed = ['full_name', 'email', 'department', 'is_admin', 'is_active', 'birthday']
  const payload = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)))
  const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select().single()
  if (error) throw new Error(error.message)
  return data
}

// ── Settings ─────────────────────────────────────────────────────────────── //

const DEFAULTS = {
  office_latitude:     '18.460204818819722',
  office_longitude:    '73.79893806749008',
  office_radius_m:     '200',
  office_start_time:   '09:30',
  office_wifi_ssid:    '',
  admin_email:         '',
  wfh_notify_emails:   '',
  app_name:            'WorkTrack Pro',
  company_name:        'Your Company',
  smtp_host:           '',
  smtp_port:           '587',
  smtp_username:       '',
  smtp_password:       '',
  smtp_from_name:      'WorkTrack Pro',
  grace_period_minutes:'10',
  reminder_enabled:    'false',
  reminder_time:       '10:30',
  leave_sick_quota:    '10',
  leave_casual_quota:  '12',
  leave_planned_quota: '5',
  company_holidays:    '[]',
}

let settingsCache = null
let settingsCacheTime = 0

export async function getSettings(force = false) {
  if (!force && settingsCache && Date.now() - settingsCacheTime < 300_000) return settingsCache
  const { data } = await supabase.from('app_settings').select('key,value')
  const fetched = Object.fromEntries((data || []).map(r => [r.key, r.value]))
  settingsCache = { ...DEFAULTS, ...fetched }
  settingsCacheTime = Date.now()
  return settingsCache
}

export async function updateSettings(obj) {
  const now = new Date().toISOString()
  const rows = Object.entries(obj).map(([key, value]) => ({ key, value: String(value), updated_at: now }))
  const { error } = await supabase.from('app_settings').upsert(rows)
  if (error) throw new Error(error.message)
  settingsCache = null  // Invalidate cache
  return getSettings(true)
}

// ── Attendance ────────────────────────────────────────────────────────────── //

export async function checkIn(userId, latitude, longitude, accuracy) {
  const settings = await getSettings()
  const today    = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })

  // Check already checked in
  const { data: existing } = await supabase.from('attendance')
    .select('id,check_in_time').eq('user_id', userId).eq('date', today).maybeSingle()
  if (existing?.check_in_time) throw new Error('Already checked in today.')

  // Determine status via GPS + WiFi SSID
  const offLat  = parseFloat(settings.office_latitude)
  const offLon  = parseFloat(settings.office_longitude)
  const radius  = parseFloat(settings.office_radius_m)
  const dist    = haversineM(latitude, longitude, offLat, offLon)
  const gpsHit  = dist <= radius

  // WiFi SSID check via Electron IPC (primary office detection for desktops)
  const wifiSSIDs   = (settings.office_wifi_ssid || '').split('\n').map(s => s.trim()).filter(Boolean)
  let   currentSSID = null
  if (wifiSSIDs.length > 0 && window.api?.getWifiSSID) {
    try { currentSSID = await window.api.getWifiSSID() } catch { /* ignore */ }
  }
  const wifiHit = wifiSSIDs.length > 0 && currentSSID && wifiSSIDs.includes(currentSSID)

  const status = (gpsHit || wifiHit) ? 'in_office' : 'wfh'

  // is_late check — compare as pure integers to avoid all timezone parsing bugs.
  // Intl.DateTimeFormat gives the true IST H and M regardless of system timezone.
  const istParts  = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const nowH      = parseInt(istParts.find(p => p.type === 'hour').value,   10)
  const nowM      = parseInt(istParts.find(p => p.type === 'minute').value, 10)
  const [sh, sm]   = (settings.office_start_time || '09:30').split(':').map(Number)
  const graceMins  = parseInt(settings.grace_period_minutes || '10', 10)
  const is_late    = (nowH * 60 + nowM) > (sh * 60 + sm + graceMins)

  const row = {
    user_id:      userId,
    date:         today,
    check_in_time: new Date().toISOString(),
    status,
    is_late,
    // WiFi office hit → store office coords (person IS at office)
    // WiFi non-office → store their IP coords (city-level, at least shows on map)
    // Normal GPS/IP → store as-is
    latitude:   (wifiHit && accuracy < 0) ? offLat
              : (accuracy < 0 && latitude  === 0) ? null : latitude,
    longitude:  (wifiHit && accuracy < 0) ? offLon
              : (accuracy < 0 && longitude === 0) ? null : longitude,
    accuracy_m: accuracy < 0 ? 200000 : accuracy,
  }

  const { data, error } = await supabase.from('attendance').upsert(row).select().single()
  if (error) throw new Error(error.message)

  // Send WFH notification email asynchronously (non-blocking)
  if (status === 'wfh') {
    _sendWFHEmail(settings, userId).catch(e => console.warn('[WFH Email]', e.message))
  }

  return data
}

async function _sendWFHEmail(settings, userId) {
  const host  = settings.smtp_host?.trim()
  const user  = settings.smtp_username?.trim()
  const pass  = settings.smtp_password?.trim()
  const list  = settings.wfh_notify_emails?.trim()
  if (!host || !user || !pass || !list) return

  const recipients = list.split('\n').map(s => s.trim()).filter(Boolean)
  if (!recipients.length) return

  const { data: profile } = await supabase.from('profiles')
    .select('full_name,employee_id,department').eq('id', userId).single()

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const name  = profile?.full_name || 'An employee'
  const empId = profile?.employee_id || ''
  const dept  = profile?.department  || ''

  await window.api?.sendEmail({
    host, port: settings.smtp_port || '587',
    user, pass,
    fromName: settings.smtp_from_name || 'WorkTrack Pro',
    to:       recipients,
    subject:  `⌂ WFH Alert: ${name} checked in from home — ${today}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;">
      <div style="background:#1e293b;padding:20px 24px;border-radius:10px 10px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:16px;">WorkTrack Pro — WFH Alert</h2>
      </div>
      <div style="background:#f8fafc;padding:20px 24px;border:1px solid #e2e8f0;border-radius:0 0 10px 10px;">
        <p style="color:#334155;margin:0 0 8px;font-size:15px;">
          <strong>${name}</strong>${empId ? ` (${empId})` : ''}${dept ? ` &nbsp;&middot;&nbsp; ${dept}` : ''}
        </p>
        <p style="color:#64748b;margin:0;font-size:14px;">
          Checked in as <strong style="color:#3b82f6;">Work From Home</strong> on ${today}.
        </p>
      </div>
    </div>`,
  })
}

export async function checkOut(userId) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
  const { data: rec } = await supabase.from('attendance')
    .select('*').eq('user_id', userId).eq('date', today).maybeSingle()
  if (!rec?.check_in_time) throw new Error('No check-in found for today.')
  if (rec.check_out_time)  throw new Error('Already checked out today.')
  const { data, error } = await supabase.from('attendance')
    .update({ check_out_time: new Date().toISOString() })
    .eq('user_id', userId).eq('date', today).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function getTodayAttendance(userId) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
  const { data } = await supabase.from('attendance')
    .select('*').eq('user_id', userId).eq('date', today).maybeSingle()
  return data
}

export async function getMonthHistory(userId, year, month) {
  const start = `${year}-${String(month).padStart(2,'0')}-01`
  const end   = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`
  const { data } = await supabase.from('attendance')
    .select('*').eq('user_id', userId).gte('date', start).lte('date', end).order('date')
  return data || []
}

export async function getMonthSummary(userId, year, month) {
  const records = await getMonthHistory(userId, year, month)
  const workdays = countWeekdays(year, month)
  return {
    present:      records.filter(r => r.status === 'in_office' || r.status === 'wfh').length,
    wfh:          records.filter(r => r.status === 'wfh').length,
    absent:       records.filter(r => r.status === 'absent').length,
    late:         records.filter(r => r.is_late).length,
    working_days: workdays,
  }
}

export async function getLiveOverview() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })

  // Fetch non-admin active employees (admins have no check-in screen so exclude from stats)
  const [{ data: att }, { data: allEmployees }] = await Promise.all([
    supabase.from('attendance').select('*,profiles(full_name,employee_id,department,is_admin)')
      .eq('date', today).order('check_in_time'),
    supabase.from('profiles').select('id,full_name,employee_id,department')
      .eq('is_active', true).eq('is_admin', false),
  ])

  const records   = att || []
  const employees = allEmployees || []                     // non-admin employees only
  const empIds    = new Set(employees.map(e => e.id))

  // Only count non-admin check-ins in stats
  const empRecords  = records.filter(r => empIds.has(r.user_id))
  const checkedIn   = empRecords.filter(r => r.check_in_time).length
  const checkedInIds= new Set(empRecords.filter(r => r.check_in_time).map(r => r.user_id))

  const inOfficeRecs = empRecords.filter(r => r.status === 'in_office' && r.check_in_time)
  const wfhRecs      = empRecords.filter(r => r.status === 'wfh'       && r.check_in_time)
  const lateRecs     = empRecords.filter(r => r.is_late && r.check_in_time)
  const absentEmps   = employees.filter(e => !checkedInIds.has(e.id))

  const mkList = (arr) => arr.map(r => ({
    full_name:   r.profiles?.full_name   || r.full_name   || '—',
    employee_id: r.profiles?.employee_id || r.employee_id || '',
  }))

  return {
    date: today,
    stats: {
      total_employees: employees.length,
      checked_in:      checkedIn,
      in_office:       inOfficeRecs.length,
      wfh:             wfhRecs.length,
      absent:          employees.length - checkedIn,
      late:            lateRecs.length,
    },
    // Employee lists per category — used for hover tooltips in Overview
    by_category: {
      in_office: mkList(inOfficeRecs),
      wfh:       mkList(wfhRecs),
      late:      mkList(lateRecs),
      absent:    absentEmps.map(e => ({ full_name: e.full_name, employee_id: e.employee_id })),
    },
    feed: empRecords.filter(r => r.check_in_time).map(r => ({
      user_id:       r.user_id,
      full_name:     r.profiles?.full_name || '—',
      employee_id:   r.profiles?.employee_id || '',
      department:    r.profiles?.department || '',
      check_in_time: r.check_in_time,
      status:        r.status,
      is_late:       r.is_late,
    })),
  }
}

export async function getAllAttendance({ start, end, userId, status, page = 1, limit = 50 } = {}) {
  let q = supabase.from('attendance')
    .select('*,profiles(full_name,employee_id,department)')
    .order('date', { ascending: false })
    .order('check_in_time', { ascending: false })
  if (start)   q = q.gte('date', start)
  if (end)     q = q.lte('date', end)
  if (userId)  q = q.eq('user_id', userId)
  if (status)  q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const items = data || []
  return {
    items: items.slice((page - 1) * limit, page * limit),
    total: items.length,
    pages: Math.ceil(items.length / limit),
  }
}

export async function getWeeklyData() {
  const today = new Date()
  // ISO week: Monday=start. getDay() returns 0=Sun,1=Mon…6=Sat.
  // On Sunday (0) we are at the END of the week → 6 days after Monday.
  const dayIdx        = today.getDay()
  const daysFromMonday = dayIdx === 0 ? 6 : dayIdx - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysFromMonday)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toLocaleDateString('sv-SE')
  })
  const { data } = await supabase.from('attendance')
    .select('date,status').gte('date', days[0]).lte('date', days[6])
  const records = data || []
  return days.map(d => ({
    date:      d,
    day:       new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }),
    in_office: records.filter(r => r.date === d && r.status === 'in_office').length,
    wfh:       records.filter(r => r.date === d && r.status === 'wfh').length,
  }))
}

export async function getTodayMapData() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
  const { data } = await supabase.from('attendance')
    .select('latitude,longitude,status,is_late,check_in_time,profiles(full_name,employee_id)')
    .eq('date', today).not('check_in_time', 'is', null)
  return data || []
}

// ── Helpers ───────────────────────────────────────────────────────────────── //

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6_371_000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function countWeekdays(year, month) {
  const days = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= days; d++) {
    const day = new Date(year, month - 1, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

// Auto-checkout: runs once when the admin app loads after 20:00 IST
export async function runAutoCheckout() {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  if (nowIST.getHours() < 20) return 0
  const today   = nowIST.toLocaleDateString('sv-SE')
  const checkoutTime = new Date()
  checkoutTime.setUTCHours(14, 30, 0, 0) // 20:00 IST = 14:30 UTC
  const { data } = await supabase.from('attendance')
    .select('id').eq('date', today).not('check_in_time', 'is', null).is('check_out_time', null)
  if (!data?.length) return 0
  await supabase.from('attendance')
    .update({ check_out_time: checkoutTime.toISOString(), status: 'auto_checkout' })
    .in('id', data.map(r => r.id))
  return data.length
}

// ── Holidays ─────────────────────────────────────────────────────────────── //

export async function getHolidays() {
  const s = await getSettings()
  try { return JSON.parse(s.company_holidays || '[]') } catch { return [] }
}

export async function saveHolidays(holidays) {
  await updateSettings({ company_holidays: JSON.stringify(holidays) })
}

// ── Delete user ───────────────────────────────────────────────────────────── //

export async function deleteUser(userId, sendNotificationEmail = true) {
  // Fetch user details before deletion
  const { data: profile } = await supabase.from('profiles')
    .select('full_name,email,is_admin').eq('id', userId).single()
  if (!profile) throw new Error('User not found.')

  // Prevent deleting the last admin
  if (profile.is_admin) {
    const { count } = await supabase.from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin', true).eq('is_active', true)
    if ((count || 0) <= 1) throw new Error('Cannot delete the last admin account. Promote another admin first.')
  }

  // Send notification email before deletion
  if (sendNotificationEmail) {
    const settings = await getSettings()
    const host = settings.smtp_host?.trim()
    const user = settings.smtp_username?.trim()
    const pass = settings.smtp_password?.trim()
    if (host && user && pass && profile.email) {
      await window.api?.sendEmail({
        host, port: settings.smtp_port || '587', user, pass,
        fromName: settings.smtp_from_name || 'WorkTrack Pro',
        to: [profile.email],
        subject: 'Your WorkTrack Pro account has been removed',
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#1e293b;">WorkTrack Pro — Account Removed</h2>
          <p style="color:#475569;">Hi ${profile.full_name},</p>
          <p style="color:#475569;">Your WorkTrack Pro account has been removed by the administrator. You will no longer be able to access the system.</p>
          <p style="color:#475569;">If you believe this is a mistake, please contact your administrator.</p>
        </div>`,
      }).catch(e => console.warn('[Delete email] Failed:', e.message))
    }
  }

  // Delete from auth.users completely (cascades to profiles + attendance).
  // This also frees the email so the person can re-register with a clean slate.
  // Requires the delete_user_completely() SQL function in Supabase.
  const { data: result, error } = await supabase.rpc('delete_user_completely', { p_user_id: userId })
  if (error) throw new Error(`Could not delete user: ${error.message}`)
  if (result === 'error:last_admin') throw new Error('Cannot delete the last admin account. Promote another admin first.')
  if (result === 'error:not_admin')  throw new Error('Permission denied.')
  if (result !== 'ok') throw new Error(`Delete failed: ${result}`)
  return true
}

// ── Leave Management ──────────────────────────────────────────────────────── //

export async function applyLeave(userId, { type, startDate, endDate, days, reason }) {
  const { data, error } = await supabase.from('leave_requests').insert({
    user_id: userId, type, start_date: startDate, end_date: endDate, days, reason,
  }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function getMyLeaves(userId, year) {
  const { data, error } = await supabase.from('leave_requests')
    .select('*').eq('user_id', userId)
    .gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function getLeaveBalance(userId, year) {
  const { data } = await supabase.from('leave_requests')
    .select('type,days').eq('user_id', userId).eq('status', 'approved')
    .gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`)
  const used = { sick: 0, casual: 0, planned: 0, emergency: 0 }
  for (const r of (data || [])) used[r.type] = (used[r.type] || 0) + r.days
  return used
}

export async function getAllLeaveRequests(status = null) {
  // Use "!user_id" hint to resolve ambiguity — both user_id and reviewed_by point to profiles
  let q = supabase.from('leave_requests')
    .select('*, profiles:user_id(full_name,employee_id,department,email)')
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

export async function reviewLeave(leaveId, reviewerId, approved, adminNote = '') {
  const { data, error } = await supabase.from('leave_requests').update({
    status:      approved ? 'approved' : 'rejected',
    admin_note:  adminNote,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', leaveId).select().single()
  if (error) throw new Error(error.message)

  // Email the employee about the decision
  if (data?.profiles?.email) {
    const s    = await getSettings()
    const host = s.smtp_host?.trim()
    const user = s.smtp_username?.trim()
    const pass = s.smtp_password?.trim()
    if (host && user && pass) {
      const statusWord = approved ? 'Approved ✓' : 'Rejected ✕'
      const color      = approved ? '#10B981' : '#EF4444'
      window.api?.sendEmail({
        host, port: s.smtp_port || '587', user, pass,
        fromName: s.smtp_from_name || 'WorkTrack Pro',
        to: [data.profiles.email],
        subject: `Leave Request ${statusWord} — WorkTrack Pro`,
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;">
          <div style="background:#1e293b;padding:20px 24px;border-radius:10px 10px 0 0;">
            <h2 style="color:#fff;margin:0;">WorkTrack Pro — Leave ${statusWord}</h2>
          </div>
          <div style="background:#f8fafc;padding:20px 24px;border:1px solid #e2e8f0;border-radius:0 0 10px 10px;">
            <p style="color:#334155;">Your leave request (${data.type} · ${data.days} day${data.days !== 1 ? 's' : ''}) has been <strong style="color:${color}">${approved ? 'approved' : 'rejected'}</strong>.</p>
            ${adminNote ? `<p style="color:#64748b;font-style:italic;">"${adminNote}"</p>` : ''}
          </div>
        </div>`,
      }).catch(() => {})
    }
  }
  return data
}

// ── Correction Requests ───────────────────────────────────────────────────── //

export async function submitCorrection(userId, { date, type, requestedCheckin, requestedCheckout, requestedStatus, reason }) {
  const { data, error } = await supabase.from('correction_requests').insert({
    user_id: userId, date, type,
    requested_checkin:  requestedCheckin  || null,
    requested_checkout: requestedCheckout || null,
    requested_status:   requestedStatus   || null,
    reason,
  }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function getMyCorrections(userId) {
  const { data, error } = await supabase.from('correction_requests')
    .select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function getAllCorrections(status = null) {
  // Use "!user_id" hint — both user_id and reviewed_by reference profiles
  let q = supabase.from('correction_requests')
    .select('*, profiles:user_id(full_name,employee_id,department)')
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

export async function reviewCorrection(corrId, reviewerId, approved, adminNote = '') {
  const { data: corr } = await supabase.from('correction_requests')
    .select('*').eq('id', corrId).single()

  if (approved && corr) {
    const updates = {}
    if (corr.requested_checkin)  updates.check_in_time  = corr.requested_checkin
    if (corr.requested_checkout) updates.check_out_time = corr.requested_checkout
    if (corr.requested_status)   updates.status         = corr.requested_status
    if (Object.keys(updates).length > 0) {
      await supabase.from('attendance').upsert({
        user_id: corr.user_id, date: corr.date, ...updates,
      })
    }
  }

  const { data, error } = await supabase.from('correction_requests').update({
    status:      approved ? 'approved' : 'rejected',
    admin_note:  adminNote,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', corrId).select().single()
  if (error) throw new Error(error.message)
  return data
}

// ── Birthdays ─────────────────────────────────────────────────────────────── //

export async function getTodaysBirthdays() {
  const { data } = await supabase.from('profiles')
    .select('id,full_name,email,birthday,department,employee_id')
    .eq('is_active', true)
  const today = new Date()
  return (data || []).filter(p => {
    if (!p.birthday) return false
    const b = new Date(p.birthday)
    return b.getMonth() === today.getMonth() && b.getDate() === today.getDate()
  })
}

export async function sendBirthdayEmail(person, settings) {
  const host = settings.smtp_host?.trim()
  const user = settings.smtp_username?.trim()
  const pass = settings.smtp_password?.trim()
  if (!host || !user || !pass || !person.email) return

  const firstName = person.full_name?.split(' ')[0] || person.full_name
  const fullName  = person.full_name || firstName
  const company   = settings.company_name || 'Your Team'
  const dept      = person.department ? ` from ${person.department}` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Happy Birthday ${firstName}!</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  @keyframes shimmer { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#03010a;font-family:'Inter',Arial,sans-serif;-webkit-font-smoothing:antialiased;}
</style>
</head>
<body style="background:#03010a;padding:32px 0;">
<div style="max-width:560px;margin:0 auto;padding:0 12px;">

<!-- ══════════ PRE-HEADER CONFETTI ROW ══════════ -->
<div style="text-align:center;padding:0 0 18px;font-size:20px;letter-spacing:8px;">
  🎊&nbsp;🎉&nbsp;🎈&nbsp;🎂&nbsp;🎁&nbsp;🎀&nbsp;✨&nbsp;🌟&nbsp;💫&nbsp;🎊
</div>

<!-- ══════════ HERO ══════════ -->
<div style="position:relative;border-radius:24px 24px 0 0;overflow:hidden;border:1px solid rgba(244,114,182,0.25);border-bottom:none;">

  <!-- Rainbow top line -->
  <div style="height:5px;background:linear-gradient(90deg,#f43f5e,#f472b6,#e879f9,#a78bfa,#818cf8,#4f86f7,#34d399,#fbbf24,#f43f5e);background-size:400% 100%;animation:shimmer 5s linear infinite;"></div>

  <!-- Hero background -->
  <div style="background:linear-gradient(160deg,#1a0535 0%,#260a4a 30%,#16073d 60%,#0d0527 100%);padding:50px 36px 42px;text-align:center;">

    <!-- Stars scatter row 1 -->
    <div style="font-size:14px;letter-spacing:18px;margin-bottom:6px;opacity:0.6;">✦ ✧ ✦ ✧ ✦ ✧ ✦</div>

    <!-- CAKE — big, central, glowing -->
    <div style="font-size:90px;line-height:1;margin:8px 0 16px;display:inline-block;filter:drop-shadow(0 0 30px rgba(251,191,36,0.55)) drop-shadow(0 0 60px rgba(251,191,36,0.2));">🎂</div>

    <!-- Stars scatter row 2 -->
    <div style="font-size:18px;letter-spacing:12px;margin-bottom:24px;opacity:0.85;">🎊&nbsp;🌟&nbsp;🎉&nbsp;💫&nbsp;🎈</div>

    <!-- HAPPY BIRTHDAY — massive gradient text -->
    <h1 style="font-size:48px;font-weight:900;line-height:1;letter-spacing:-2px;margin-bottom:8px;background:linear-gradient(135deg,#fda4d4 0%,#f472b6 25%,#e879f9 50%,#c084fc 70%,#818cf8 90%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
      Happy Birthday
    </h1>
    <h1 style="font-size:48px;font-weight:900;line-height:1;letter-spacing:-2px;margin-bottom:20px;background:linear-gradient(135deg,#fda4d4 0%,#f472b6 25%,#e879f9 50%,#c084fc 70%,#818cf8 90%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
      ${firstName}! 🥳
    </h1>

    <!-- Name in gold plate -->
    <div style="display:inline-block;background:linear-gradient(135deg,rgba(251,191,36,0.15) 0%,rgba(251,191,36,0.08) 100%);border:1px solid rgba(251,191,36,0.35);border-radius:14px;padding:10px 28px;">
      <p style="font-size:15px;font-weight:700;color:#fde68a;letter-spacing:2px;text-transform:uppercase;margin:0;">
        ⭐ &nbsp;${fullName}${dept} &nbsp;⭐
      </p>
    </div>
  </div>
</div>

<!-- ══════════ MAIN BODY ══════════ -->
<div style="background:linear-gradient(180deg,#0e0726 0%,#07041a 100%);border:1px solid rgba(167,139,250,0.12);border-top:none;padding:36px 32px 28px;">

  <!-- Personal message — the core of the email -->
  <div style="background:linear-gradient(135deg,rgba(244,114,182,0.06) 0%,rgba(99,102,241,0.06) 100%);border:1px solid rgba(244,114,182,0.18);border-radius:20px;padding:28px;margin-bottom:28px;">
    <p style="color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;text-align:center;">A Message From Your Team</p>
    <p style="color:#e2e8f0;font-size:16px;line-height:1.85;text-align:center;">
      Hey <strong style="color:#f9a8d4;font-size:18px;">${firstName}</strong> —
    </p>
    <p style="color:#cbd5e1;font-size:15px;line-height:1.85;margin-top:14px;">
      Today the universe made one of its best decisions. It brought <strong style="color:#f472b6;">${fullName}</strong>
      into the world — and eventually, into this team. And honestly? We got the better end of that deal. 🌙
    </p>
    <p style="color:#cbd5e1;font-size:15px;line-height:1.85;margin-top:14px;">
      You show up. You push through. You make hard things look easy and boring things look interesting.
      The whole <strong style="color:#a78bfa;">${company}</strong> team stops today — just for a moment —
      to say: <em style="color:#fbbf24;">you are seen, you are valued, and you are absolutely irreplaceable.</em> 🚀
    </p>
    <p style="color:#cbd5e1;font-size:15px;line-height:1.85;margin-top:14px;">
      So take today. Own it. You deserve every second of it.
    </p>
  </div>

  <!-- 3 wish tiles -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border-collapse:separate;border-spacing:8px;">
    <tr>
      <td style="width:33%;vertical-align:top;">
        <div style="background:rgba(244,114,182,0.07);border:1px solid rgba(244,114,182,0.22);border-radius:18px;padding:22px 14px;text-align:center;height:100%;">
          <div style="font-size:36px;margin-bottom:12px;">🎯</div>
          <p style="color:#f472b6;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Crushed It</p>
          <p style="color:#94a3b8;font-size:12px;line-height:1.6;">Another year of doing amazing things. Keep going.</p>
        </div>
      </td>
      <td style="width:34%;vertical-align:top;">
        <div style="background:rgba(167,139,250,0.07);border:1px solid rgba(167,139,250,0.22);border-radius:18px;padding:22px 14px;text-align:center;height:100%;">
          <div style="font-size:36px;margin-bottom:12px;">🌟</div>
          <p style="color:#a78bfa;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Unstoppable</p>
          <p style="color:#94a3b8;font-size:12px;line-height:1.6;">${firstName}, the best version of you starts today.</p>
        </div>
      </td>
      <td style="width:33%;vertical-align:top;">
        <div style="background:rgba(79,134,247,0.07);border:1px solid rgba(79,134,247,0.22);border-radius:18px;padding:22px 14px;text-align:center;height:100%;">
          <div style="font-size:36px;margin-bottom:12px;">🎁</div>
          <p style="color:#60a5fa;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">New Chapter</p>
          <p style="color:#94a3b8;font-size:12px;line-height:1.6;">A fresh year. Endless possibilities. All yours.</p>
        </div>
      </td>
    </tr>
  </table>

  <!-- Divider -->
  <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(167,139,250,0.3),transparent);margin:0 0 28px;"></div>

  <!-- Pull quote -->
  <div style="background:rgba(167,139,250,0.05);border-radius:0 18px 18px 0;border-left:4px solid #a78bfa;padding:20px 24px;margin-bottom:28px;">
    <p style="color:#c4b5fd;font-size:15px;font-style:italic;line-height:1.8;margin:0 0 10px;">
      "The secret of a great life is not doing what you love every day — it's becoming someone
      others are genuinely glad to know. You've already done that, ${firstName}."
    </p>
    <p style="color:#6d28d9;font-size:12px;font-weight:700;margin:0;letter-spacing:0.5px;">
      — With love, from everyone at ${company}
    </p>
  </div>

  <!-- Wishes list -->
  <div style="margin-bottom:32px;">
    <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;text-align:center;">Wishes From The Team</p>
    ${['🥂 &nbsp;May every goal you set this year fall perfectly into place.',
       '🌈 &nbsp;May the good days outnumber the hard ones, ten to one.',
       '💪 &nbsp;May you surprise even yourself with what you accomplish.',
       '🎵 &nbsp;May today be the kind of day songs are written about.',
       '✨ &nbsp;May this year be your most extraordinary one yet.']
      .map(w => `<div style="display:flex;align-items:flex-start;gap:12px;padding:11px 14px;margin-bottom:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:12px;">
        <p style="color:#cbd5e1;font-size:14px;line-height:1.5;margin:0;">${w}</p>
      </div>`).join('')}
  </div>

  <!-- CTA button -->
  <div style="text-align:center;">
    <div style="display:inline-block;background:linear-gradient(135deg,#f43f5e 0%,#f472b6 30%,#a78bfa 65%,#4f86f7 100%);border-radius:18px;padding:16px 44px;box-shadow:0 8px 32px rgba(244,114,182,0.4),0 2px 8px rgba(0,0,0,0.5);">
      <p style="color:#fff;font-size:17px;font-weight:900;margin:0;letter-spacing:0.3px;">
        🎊 &nbsp;Here's To You, ${firstName}! &nbsp;🎊
      </p>
    </div>
  </div>
</div>

<!-- ══════════ FOOTER ══════════ -->
<div style="background:#020108;border:1px solid rgba(255,255,255,0.04);border-top:none;border-radius:0 0 24px 24px;padding:24px 32px;text-align:center;">
  <div style="font-size:18px;letter-spacing:8px;margin-bottom:14px;opacity:0.7;">🎂 🎉 🌟 🎊 ✨ 🎈 🎀 💫 🥳</div>
  <p style="color:#334155;font-size:13px;line-height:1.7;margin:0 0 6px;">
    Sent with 💜 from your team at <strong style="color:#6d28d9;">${company}</strong>
  </p>
  <p style="color:#1e293b;font-size:11px;margin:0;">Powered by WorkTrack Pro — your attendance, your team, your story.</p>
</div>

<!-- POST-FOOTER CONFETTI ROW -->
<div style="text-align:center;padding:18px 0 0;font-size:18px;letter-spacing:8px;opacity:0.5;">
  ✨&nbsp;🌟&nbsp;💫&nbsp;⭐&nbsp;🌟&nbsp;✨
</div>

</div>
</body>
</html>`

  window.api?.sendEmail({
    host, port: settings.smtp_port || '587', user, pass,
    fromName: settings.smtp_from_name || company,
    to: [person.email],
    subject: `🎂 Happy Birthday ${firstName}! Your whole team is celebrating YOU today 🎉✨`,
    html,
  }).catch(() => {})
}

// ── Badge counts ─────────────────────────────────────────────────────────── //

// Admin: how many pending leave + correction requests are waiting for review
export async function getAdminBadgeCounts() {
  const [lRes, cRes] = await Promise.all([
    supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('correction_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  return { leaves: lRes.count || 0, corrections: cRes.count || 0 }
}

// Employee: how many of their leaves/corrections were reviewed since they last opened those pages
export async function getEmployeeBadgeCounts(userId) {
  const leavesSeen = localStorage.getItem(`wt-leaves-seen-${userId}`) || '1970-01-01T00:00:00Z'
  const corrSeen   = localStorage.getItem(`wt-corrections-seen-${userId}`) || '1970-01-01T00:00:00Z'
  const [lRes, cRes] = await Promise.all([
    supabase.from('leave_requests').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).neq('status', 'pending').gt('reviewed_at', leavesSeen),
    supabase.from('correction_requests').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).neq('status', 'pending').gt('reviewed_at', corrSeen),
  ])
  return { leaves: lRes.count || 0, corrections: cRes.count || 0 }
}

// ── Reminder emails ───────────────────────────────────────────────────────── //

export async function sendCheckInReminders() {
  const today    = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
  const settings = await getSettings()
  const host     = settings.smtp_host?.trim()
  const user     = settings.smtp_username?.trim()
  const pass     = settings.smtp_password?.trim()
  if (!host || !user || !pass) return 0

  const { data: allEmps } = await supabase.from('profiles')
    .select('id,full_name,email').eq('is_active', true).eq('is_admin', false)
  const { data: checkins } = await supabase.from('attendance')
    .select('user_id').eq('date', today).not('check_in_time', 'is', null)

  const checkedIds = new Set((checkins || []).map(r => r.user_id))
  const missing    = (allEmps || []).filter(e => !checkedIds.has(e.id) && e.email)
  if (!missing.length) return 0

  await Promise.allSettled(missing.map(emp =>
    window.api?.sendEmail({
      host, port: settings.smtp_port || '587', user, pass,
      fromName: settings.smtp_from_name || 'WorkTrack Pro',
      to: [emp.email],
      subject: `Reminder: Don't forget to check in — WorkTrack Pro`,
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#1e293b;padding:20px 24px;border-radius:10px 10px 0 0;">
          <h2 style="color:#fff;margin:0;">WorkTrack Pro — Check-in Reminder</h2>
        </div>
        <div style="background:#f8fafc;padding:20px 24px;border:1px solid #e2e8f0;border-radius:0 0 10px 10px;">
          <p style="color:#334155;">Hi <strong>${emp.full_name}</strong>,</p>
          <p style="color:#475569;">It looks like you haven't checked in yet today. Open WorkTrack Pro and mark your attendance!</p>
          <p style="color:#94a3b8;font-size:12px;">If you are on leave today, please ignore this message.</p>
        </div>
      </div>`,
    })
  ))
  return missing.length
}
