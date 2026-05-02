import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Auth
  user:        null,
  isAdmin:     false,
  setUser:     (user) => set({ user, isAdmin: user?.is_admin || false }),
  clearUser:   ()     => set({ user: null, isAdmin: false }),

  // Settings cache (from Supabase)
  settings:    null,
  setSettings: (s)   => set({ settings: s }),

  // Theme
  theme: localStorage.getItem('wt-theme') || 'dark',
  setTheme: (t) => {
    localStorage.setItem('wt-theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
    set({ theme: t })
  },

  // GPS state
  gpsLocation: null,       // { lat, lon, accuracy }
  gpsStatus:   'idle',     // 'idle' | 'acquiring' | 'active' | 'error'
  gpsError:    null,
  setGps: (loc) => set({ gpsLocation: loc, gpsStatus: 'active', gpsError: null }),
  setGpsError: (msg) => set({ gpsLocation: null, gpsStatus: 'error', gpsError: msg }),
  setGpsAcquiring: () => set({ gpsStatus: 'acquiring' }),

  // Today's attendance
  todayRecord: null,
  setTodayRecord: (r) => set({ todayRecord: r }),

  // Nav badge counts — pending requests (admin) or unread reviews (employee)
  badges:    { leaves: 0, corrections: 0 },
  setBadges: (b) => set(s => ({ badges: { ...s.badges, ...b } })),

  // Notification feed
  notifications:    [],
  setNotifications: (n) => set({ notifications: n }),

  // Company name (from settings)
  companyName: () => get().settings?.company_name || 'Your Company',
}))
