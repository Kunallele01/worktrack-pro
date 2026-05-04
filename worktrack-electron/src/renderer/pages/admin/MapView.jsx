import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import { getTodayMapData, getSettings } from '../../lib/supabase'
import { Badge, Button, Avatar } from '../../components/ui'
import { useToast } from '../../components/ui'
import { format } from 'date-fns'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const greenIcon = new L.Icon({
  iconUrl:   'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})
const orangeIcon = new L.Icon({
  iconUrl:   'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

function EmployeeRow({ r }) {
  const fmt = iso => { try { return format(new Date(iso), 'hh:mm a') } catch { return '—' } }
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors">
      <Avatar name={r.profiles?.full_name || ''} size={9} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-100 truncate">{r.profiles?.full_name}</p>
        <p className="text-xs text-gray-500 font-mono truncate">{r.profiles?.employee_id}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-mono text-gray-300">{r.check_in_time ? fmt(r.check_in_time) : '—'}</p>
        <div className="flex items-center gap-1 justify-end mt-0.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            r.status === 'in_office' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'
          }`}>
            {r.status === 'in_office' ? 'Office' : 'WFH'}
          </span>
          {r.is_late && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Late</span>}
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
    <div className="h-full flex items-center justify-center text-gray-400">Loading map…</div>
  )

  const olat    = parseFloat(settings.office_latitude)
  const olon    = parseFloat(settings.office_longitude)
  const radius  = parseFloat(settings.office_radius_m)
  const company = settings.company_name || 'Office'

  const inOffice     = checkins.filter(r => r.status === 'in_office')
  const wfh          = checkins.filter(r => r.status === 'wfh')
  const validOnMap   = checkins.filter(r => r.latitude && r.longitude)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Live Map</h1>
          <p className="text-sm text-gray-400">
            {inOffice.length} in office · {wfh.length} WFH · {checkins.length} total checked in today
          </p>
        </div>
        <Button variant="secondary" onClick={load} loading={loading} className="text-sm">Refresh</Button>
      </div>

      {/* Map + sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer center={[olat, olon]} zoom={14} className="h-full w-full" style={{ background: '#0A0E1A' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <Circle center={[olat, olon]} radius={radius}
              pathOptions={{ color: '#4F86F7', fillColor: '#4F86F7', fillOpacity: 0.1, weight: 2, dashArray: '6 4' }} />
            <Marker position={[olat, olon]}>
              <Popup>
                <div className="text-xs">
                  <p className="font-bold">🏢 {company}</p>
                  <p className="text-gray-500">Office · {radius}m radius</p>
                </div>
              </Popup>
            </Marker>
            {validOnMap.map((r, i) => (
              <Marker key={i} position={[r.latitude, r.longitude]}
                icon={r.status === 'in_office' ? greenIcon : orangeIcon}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold">{r.profiles?.full_name}</p>
                    <p className="text-gray-500">{r.profiles?.employee_id} · {r.status === 'in_office' ? '● In Office' : '⌂ WFH'}</p>
                    {r.check_in_time && <p className="text-gray-500">In: {format(new Date(r.check_in_time), 'hh:mm a')}</p>}
                    {r.is_late && <p className="text-amber-600 font-medium">⚑ Late</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Scrollable employee list */}
        <div className="w-64 shrink-0 flex flex-col border-l border-white/[0.06] bg-surface-900 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.06]">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Today's Check-ins</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {checkins.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                <p className="text-2xl mb-2">📍</p>
                <p className="text-xs text-gray-500">No check-ins yet today</p>
              </div>
            ) : (
              checkins
                .sort((a, b) => new Date(a.check_in_time) - new Date(b.check_in_time))
                .map(r => <EmployeeRow key={r.id || r.user_id} r={r} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
