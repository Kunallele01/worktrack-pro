import React, { useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Settings, BarChart3, Users, Calendar, Map, LogOut, Zap, Sun, Moon, CalendarCheck, ClipboardList, UserCircle } from 'lucide-react'
import { signOut, getAdminBadgeCounts, getEmployeeBadgeCounts } from '../lib/supabase'
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
  const badges     = useStore(s => s.badges)
  const setBadges  = useStore(s => s.setBadges)
  const timerRef   = useRef(null)

  const companyName = settings?.company_name || 'Your Company'
  const navItems    = isAdmin ? ADMIN_NAV : EMP_NAV

  const loadBadges = async () => {
    if (!user?.id) return
    try {
      const counts = isAdmin
        ? await getAdminBadgeCounts()
        : await getEmployeeBadgeCounts(user.id)
      setBadges(counts)
    } catch { /* silent — badges are non-critical */ }
  }

  useEffect(() => {
    loadBadges()
    timerRef.current = setInterval(loadBadges, 60_000)
    return () => clearInterval(timerRef.current)
  }, [user?.id, isAdmin])

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
