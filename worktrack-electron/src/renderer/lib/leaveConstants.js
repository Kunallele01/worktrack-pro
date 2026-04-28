// Shared leave type definitions used by both employee Leave page and admin LeaveRequests

export const LEAVE_TYPES = [
  { value: 'sick',      label: 'Sick Leave',      icon: '🤒', color: 'rose',   quotaKey: 'leave_sick_quota'    },
  { value: 'casual',    label: 'Casual Leave',    icon: '☀️', color: 'amber',  quotaKey: 'leave_casual_quota'  },
  { value: 'planned',   label: 'Planned Leave',   icon: '✈️', color: 'teal',   quotaKey: 'leave_planned_quota' },
  { value: 'emergency', label: 'Emergency Leave', icon: '⚡', color: 'orange', quotaKey: null                  },
]

export const LEAVE_COLORS = {
  sick:      { cell: 'bg-rose-500/80 text-white',   badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',    ring: 'ring-rose-500/40',   text: 'text-rose-400',   bg: 'bg-rose-500/15',   border: 'border-rose-500/30'  },
  casual:    { cell: 'bg-amber-500/80 text-white',  badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', ring: 'ring-amber-500/40',  text: 'text-amber-400',  bg: 'bg-amber-500/15',  border: 'border-amber-500/30' },
  planned:   { cell: 'bg-teal-500/80 text-white',   badge: 'bg-teal-500/15 text-teal-400 border-teal-500/30',    ring: 'ring-teal-500/40',   text: 'text-teal-400',   bg: 'bg-teal-500/15',   border: 'border-teal-500/30'  },
  emergency: { cell: 'bg-orange-500/80 text-white', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', ring: 'ring-orange-500/40', text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
}
