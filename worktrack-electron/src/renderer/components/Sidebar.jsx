import React, { useEffect, useRef, useState, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, Settings, BarChart3, Users, Calendar, Map, LogOut, Zap, Sun, Moon, CalendarCheck, ClipboardList, UserCircle, Bell } from 'lucide-react'
import { signOut, getAdminBadgeCounts, getEmployeeBadgeCounts, getNotifications } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Avatar } from './ui'

const EMP_NAV  = [
  { to: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/profile',     label: 'Profile',     icon: UserCircle },
  { to: '/leaves',      label: 'My Leaves',   icon: CalendarCheck },
  { to: '/corrections', label: 'Corrections', icon: ClipboardList },
  { to: '/settings',    label: 'Settings',    icon: Settings },
]
const ADMIN_NAV = [
  { to: '/admin',              label: 'Overview',     icon: LayoutDashboard },
  { to: '/admin/attendance',   label: 'Attendance',   icon: Calendar },
  { to: '/admin/employees',    label: 'Employees',    icon: Users },
  { to: '/admin/leaves',       label: 'Leave Requests', icon: CalendarCheck },
  { to: '/admin/corrections',  label: 'Corrections',  icon: ClipboardList },
  { to: '/admin/reports',      label: 'Reports',      icon: BarChart3 },
  { to: '/admin/map',          label: 'Map',          icon: Map },
  { to: '/admin/settings',     label: 'Settings',     icon: Settings },
]

export default function Sidebar() {
  const navigate   = useNavigate()
  const user       = useStore(s => s.user)
  const isAdmin    = useStore(s => s.isAdmin)
  const clearUser  = useStore(s => s.clearUser)
  const settings   = useStore(s => s.settings)
  const theme      = useStore(s => s.theme)
  const setTheme   = useStore(s => s.setTheme)
  const badges          = useStore(s => s.badges)
  const setBadges       = useStore(s => s.setBadges)
  const notifications   = useStore(s => s.notifications)
  const setNotifications= useStore(s => s.setNotifications)
  const timerRef        = useRef(null)
  const [notifOpen,  setNotifOpen ] = useState(false)
  const [lastSeen,   setLastSeen  ] = useState(() => localStorage.getItem('wt-notif-seen') || '1970-01-01T00:00:00Z')
  const notifRef = useRef(null)

  const companyName = settings?.company_name || 'Your Company'
  const navItems    = isAdmin ? ADMIN_NAV : EMP_NAV

  const loadBadges = async () => {
    if (!user?.id) return
    try {
      const counts = isAdmin
        ? await getAdminBadgeCounts()
        : await getEmployeeBadgeCounts(user.id)
      setBadges(counts)
    } catch { /* silent */ }
  }

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return
    try { setNotifications(await getNotifications(user.id, isAdmin)) }
    catch { /* silent */ }
  }, [user?.id, isAdmin])

  useEffect(() => {
    loadBadges()
    loadNotifications()
    timerRef.current = setInterval(() => { loadBadges(); loadNotifications() }, 60_000)
    return () => clearInterval(timerRef.current)
  }, [user?.id, isAdmin])

  // Close notification panel on outside click
  useEffect(() => {
    if (!notifOpen) return
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  const unreadCount = notifications.filter(n => new Date(n.time) > new Date(lastSeen)).length

  function openNotifications() {
    setNotifOpen(o => !o)
    const now = new Date().toISOString()
    setLastSeen(now)
    localStorage.setItem('wt-notif-seen', now)
  }

  function relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  async function handleLogout() {
    window.api?.destroyTray()
    await signOut()
    clearUser()
    navigate('/', { replace: true })
  }

  function badgeFor(to) {
    if (isAdmin) {
      if (to === '/admin/leaves')      return badges.leaves
      if (to === '/admin/corrections') return badges.corrections
    } else {
      if (to === '/leaves')      return badges.leaves
      if (to === '/corrections') return badges.corrections
    }
    return 0
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-surface-900 border-r border-white/[0.06] h-screen">
      {/* Logo */}
      <div className="px-4 pt-6 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent-500 flex items-center justify-center shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-100 truncate">WorkTrack Pro</p>
            <p className="text-xs text-gray-500 truncate">{companyName}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => {
          const count = badgeFor(to)
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                isActive
                  ? 'nav-item-active flex items-center gap-3'
                  : 'nav-item flex items-center gap-3'
              }
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {count > 0 && (
                <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent-500 text-white text-[10px] font-bold px-1 leading-none">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Notification bell */}
      <div className="px-3 pb-1 pt-2 border-t border-white/[0.06]" ref={notifRef}>
        <button onClick={openNotifications}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all relative">
          <Bell size={15} />
          <span className="flex-1 text-left">Notifications</span>
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown panel — slides out to the right of the sidebar */}
        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.97 }}
              animate={{ opacity: 1, x: 0,  scale: 1 }}
              exit={{   opacity: 0, x: -8, scale: 0.97 }}
              transition={{ type: 'spring', damping: 24, stiffness: 260 }}
              style={{ position: 'fixed', left: 224, bottom: 120, width: 340, zIndex: 500 }}
              className="bg-surface-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <p className="text-sm font-bold text-gray-100">Notifications</p>
                <span className="text-xs text-gray-500">{notifications.length} recent</span>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-10 px-4 text-center">
                    <span className="text-4xl mb-3">🔔</span>
                    <p className="text-sm font-medium text-gray-300">You're all caught up</p>
                    <p className="text-xs text-gray-500 mt-1">No new notifications in the last 7 days.</p>
                  </div>
                ) : (
                  notifications.map(n => {
                    const isNew = new Date(n.time) > new Date(lastSeen)
                    return (
                      <div key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${isNew ? 'bg-accent-500/[0.04]' : ''}`}>
                        <span className="text-xl shrink-0 mt-0.5">{n.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold leading-snug ${isNew ? 'text-gray-100' : 'text-gray-300'}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.subtitle}</p>
                        </div>
                        <span className="text-[10px] text-gray-600 shrink-0 mt-0.5 whitespace-nowrap">{relTime(n.time)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User */}
      <div className="px-3 pb-4 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-1 mb-2">
          <Avatar name={user?.full_name || ''} size={8} textSize="text-xs" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{isAdmin ? 'Admin' : 'Employee'}</p>
          </div>
        </div>
        {/* Theme toggle — accessible to everyone, admin and employee */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all mb-1"
        >
          <span className="flex items-center gap-2">
            {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
            <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          </span>
          {/* Pill toggle — right = dark (on), left = light (off) */}
          <div className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-accent-500' : 'bg-gray-600'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
