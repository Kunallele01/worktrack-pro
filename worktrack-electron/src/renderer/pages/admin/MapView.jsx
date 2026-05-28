import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import { getTodayMapData, getSettings } from '../../lib/supabase'
import { Button, Avatar } from '../../components/ui'
import { useToast } from '../../components/ui'
import { format } from 'date-fns'

delete L.Icon.Default.prototype._getIconUrl

// ── Custom circular avatar marker (WFH only) ─────────────────────────────── //
function createAvatarIcon(name, isLate) {
  const initials = (name || '?').split(' ').slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'
  const ring     = isLate ? '#F59E0B' : 'rgba(255,255,255,0.85)'
  const lateDot  = isLate
    ? `<div style="position:absolute;top:-3px;right:-3px;width:11px;height:11px;border-radius:50%;background:#F59E0B;border:1.5px solid #0A0E1A;"></div>`
    : ''
  return L.divIcon({
    className: '',
    html: `<div style="
      position:relative;width:38px;height:38px;border-radius:50%;
      background:#3B82F6;border:2.5px solid ${ring};
      display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:700;color:#fff;font-family:Inter,Arial,sans-serif;
      box-shadow:0 3px 10px rgba(0,0,0,0.45),0 0 0 1px rgba(0,0,0,0.2);
      cursor:pointer;
    ">${initials}${lateDot}</div>`,
    iconSize:    [38, 38],
    iconAnchor:  [19, 19],
    popupAnchor: [0, -22],
  })
}

// Office building marker — pulsing ring + live count badge
function createOfficeIcon(inOfficeCount) {
  const badge = inOfficeCount > 0
    ? `<div style="position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;border-radius:10px;
        background:#10B981;border:2px solid #0A0E1A;
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:800;color:#fff;font-family:Inter,Arial,sans-serif;padding:0 4px;">
        ${inOfficeCount}
      </div>`
    : ''
  return L.divIcon({
    className: '',
    html: `
      <style>
        @keyframes officePulse {
          0%,100% { opacity:.45; transform:scale(1); }
          50%      { opacity:.12; transform:scale(1.65); }
        }
      </style>
      <div style="position:relative;width:46px;height:46px;">
        <div style="position:absolute;inset:-10px;border-radius:17px;
          border:2.5px solid rgba(79,134,247,0.5);
          animation:officePulse 2.4s ease-in-out infinite;
          pointer-events:none;"></div>
        <div style="
          width:46px;height:46px;border-radius:13px;
          background:#1E3A5F;border:2px solid rgba(79,134,247,0.7);
          display:flex;align-items:center;justify-content:center;
          font-size:22px;
          box-shadow:0 3px 12px rgba(0,0,0,0.5),0 0 0 4px rgba(79,134,247,0.12);
          position:relative;z-index:1;
        ">🏢</div>
        ${badge}
      </div>`,
    iconSize:    [46, 46],
    iconAnchor:  [23, 23],
    popupAnchor: [0, -28],
  })
}

// ── Employee row in sidebar ────────────────────────────────────────────────── //
function EmployeeRow({ r }) {
  const fmt = iso => { try { return format(new Date(iso), 'hh:mm a') } catch { return '—' } }
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
      <Avatar name={r.profiles?.full_name || ''} size={8} textSize="text-xs" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-200 truncate">{r.profiles?.full_name}</p>
        <p className="text-[10px] text-gray-500 font-mono">{r.profiles?.employee_id}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] font-mono text-gray-400">{fmt(r.check_in_time)}</p>
        <div className="flex items-center gap-1 justify-end mt-0.5">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
            ${r.status === 'in_office' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
            {r.status === 'in_office' ? 'Office' : 'WFH'}
          </span>
          {r.is_late && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Late</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MapView() {
  const toast = useToast()
  const [checkins, setCheckins] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading,  setLoading ] = useState(true)
  const [tab,      setTab     ] = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const [data, cfg] = await Promise.all([getTodayMapData(), getSettings()])
      setCheckins(data); setSettings(cfg)
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (!settings) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <p className="text-3xl mb-3">🗺️</p>
        <p className="text-sm text-gray-400">Loading map…</p>
      </div>
    </div>
  )

  const olat      = parseFloat(settings.office_latitude)
  const olon      = parseFloat(settings.office_longitude)
  const radius    = parseFloat(settings.office_radius_m)
  const company   = settings.company_name || 'Office'
  const mapCenter = (olat && olon) ? [olat, olon] : [20.5937, 78.9629]

  const inOffice  = checkins.filter(r => r.status === 'in_office')
  const wfh       = checkins.filter(r => r.status === 'wfh')
  const late      = checkins.filter(r => r.is_late)

  // Only WFH employees get individual pins (they're at distinct locations)
  const wfhOnMap  = wfh.filter(r => r.latitude && r.longitude)

  const tabList = tab === 'office' ? inOffice : tab === 'wfh' ? wfh : checkins

  const STATS = [
    { label: 'In Office', value: inOffice.length, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: 'WFH',       value: wfh.length,      color: 'text-blue-400',    bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
    { label: 'Late',      value: late.length,     color: 'text-amber-400',   bg: 'bg-amber-500/10',  border: 'border-amber-500/20'  },
    { label: 'On Map',    value: wfhOnMap.length, color: 'text-gray-300',    bg: 'bg-white/[0.05]',  border: 'border-white/[0.08]'  },
  ]

  return (
    <div className="h-full flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Live Map</h1>
          <p className="text-xs text-gray-500 mt-0.5">Real-time employee locations · today</p>
        </div>
        <div className="flex items-center gap-2">
          {STATS.map(s => (
            <div key={s.label}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${s.bg} ${s.border} ${s.color}`}>
              <span className="font-bold font-mono tabular-nums">{s.value}</span>
              <span className="opacity-75">{s.label}</span>
            </div>
          ))}
          <Button variant="secondary" onClick={load} loading={loading} className="text-sm ml-1">Refresh</Button>
        </div>
      </div>

      {/* ── Map + sidebar ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer center={mapCenter} zoom={13} className="h-full w-full" style={{ background: '#0A0E1A' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {/* Office geofence circle + pulsing marker with live count */}
            {olat && olon && (
              <>
                <Circle center={[olat, olon]} radius={radius}
                  pathOptions={{ color: '#4F86F7', fillColor: '#4F86F7', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }} />
                <Marker position={[olat, olon]} icon={createOfficeIcon(inOffice.length)}>
                  <Popup className="map-popup">
                    <div style={{ fontFamily: 'Inter, Arial, sans-serif', padding: '2px 4px' }}>
                      <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 2px' }}>🏢 {company}</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px' }}>Office · {radius}m geofence</p>
                      {inOffice.length > 0 && (
                        <p style={{ fontSize: 11, color: '#10B981', margin: 0, fontWeight: 600 }}>
                          {inOffice.length} employee{inOffice.length !== 1 ? 's' : ''} currently in office
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* WFH employee markers — each at their own location */}
            {wfhOnMap.map((r, i) => (
              <Marker
                key={i}
                position={[r.latitude, r.longitude]}
                icon={createAvatarIcon(r.profiles?.full_name || '', r.is_late)}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, Arial, sans-serif', padding: '4px 6px', minWidth: 150 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: '#3B82F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {(r.profiles?.full_name || '?').split(' ').slice(0,2).map(p => p[0]?.toUpperCase()).join('')}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 12, margin: 0 }}>{r.profiles?.full_name}</p>
                        <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, fontFamily: 'monospace' }}>{r.profiles?.employee_id}</p>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <p style={{ fontSize: 11, margin: 0 }}>
                        <span style={{ color: '#3B82F6', fontWeight: 600 }}>⌂ WFH</span>
                        {r.is_late && <span style={{ color: '#F59E0B', fontWeight: 600, marginLeft: 6 }}>⚑ Late</span>}
                      </p>
                      {r.check_in_time && (
                        <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>
                          Check-in: {format(new Date(r.check_in_time), 'hh:mm a')}
                        </p>
                      )}
                      {r.profiles?.department && (
                        <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>{r.profiles.department}</p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* ── Employee sidebar ── */}
        <div className="w-64 shrink-0 flex flex-col border-l border-white/[0.06] bg-surface-900 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] shrink-0">
            {[
              { id: 'all',    label: 'All',    count: checkins.length },
              { id: 'office', label: 'Office', count: inOffice.length },
              { id: 'wfh',   label: 'WFH',    count: wfh.length      },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors
                  ${tab === t.id
                    ? 'border-accent-500 text-accent-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                {t.label}
                <span className={`font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-full
                  ${tab === t.id ? 'bg-accent-500/20 text-accent-400' : 'bg-white/[0.06] text-gray-500'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {tabList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                <p className="text-2xl mb-2">📍</p>
                <p className="text-xs text-gray-500">No active check-ins</p>
              </div>
            ) : (
              tabList
                .sort((a, b) => new Date(a.check_in_time) - new Date(b.check_in_time))
                .map(r => <EmployeeRow key={r.user_id} r={r} />)
            )}
          </div>

          {/* Footer */}
          {checkins.length > 0 && (
            <div className="px-4 py-2 border-t border-white/[0.06] shrink-0">
              <p className="text-[10px] text-gray-600 text-center">
                {wfhOnMap.length} WFH pin{wfhOnMap.length !== 1 ? 's' : ''} · {inOffice.length} at office
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
