import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import { getTodayMapData, getSettings } from '../../lib/supabase'
import { Badge, Button } from '../../components/ui'
import { useToast } from '../../components/ui'
import { format } from 'date-fns'

// Fix Leaflet default icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const greenIcon = new L.Icon({
  iconUrl:      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl:    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:     [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})
const orangeIcon = new L.Icon({
  iconUrl:      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl:    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:     [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

export default function MapView() {
  const toast = useToast()
  const [checkins,  setCheckins ] = useState([])
  const [settings,  setSettings ] = useState(null)
  const [loading,   setLoading  ] = useState(true)

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

  const olat   = parseFloat(settings.office_latitude)
  const olon   = parseFloat(settings.office_longitude)
  const radius = parseFloat(settings.office_radius_m)
  const company = settings.company_name || 'Office'

  const validCheckins = checkins.filter(r => r.latitude && r.longitude)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06] shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Live Map</h1>
          <p className="text-sm text-gray-400">
            {checkins.filter(r => r.status === 'in_office').length} in office ·{' '}
            {checkins.filter(r => r.status === 'wfh').length} WFH today
          </p>
        </div>
        <Button variant="secondary" onClick={load} loading={loading} className="text-sm">Refresh</Button>
      </div>
      <div className="flex-1 relative">
        <MapContainer
          center={[olat, olon]}
          zoom={14}
          className="h-full w-full"
          style={{ background: '#0A0E1A' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Office radius */}
          <Circle center={[olat, olon]} radius={radius}
            pathOptions={{ color: '#4F86F7', fillColor: '#4F86F7', fillOpacity: 0.1, weight: 2, dashArray: '6 4' }} />

          {/* Office marker */}
          <Marker position={[olat, olon]}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold">🏢 {company}</p>
                <p className="text-gray-500">Office Location · {radius}m radius</p>
              </div>
            </Popup>
          </Marker>

          {/* Employee markers */}
          {validCheckins.map((r, i) => (
            <Marker
              key={i}
              position={[r.latitude, r.longitude]}
              icon={r.status === 'in_office' ? greenIcon : orangeIcon}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold">{r.profiles?.full_name}</p>
                  <p className="text-gray-500">{r.profiles?.employee_id} · {r.status === 'in_office' ? '● In Office' : '⌂ WFH'}</p>
                  {r.check_in_time && (
                    <p className="text-gray-500">In: {format(new Date(r.check_in_time), 'hh:mm a')}</p>
                  )}
                  {r.is_late && <p className="text-amber-600 font-medium">⚑ Late</p>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
