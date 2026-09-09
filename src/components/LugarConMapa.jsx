import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

// Coordenadas aproximadas de La Lucila, Vicente López — punto de partida fijo
// para estimar distancia (en línea recta) hasta el lugar del evento.
export const LA_LUCILA = { lat: -34.4956, lng: -58.4854 }

export function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Carga el script de Google Maps (Places) una sola vez, sólo si hay API key
// configurada. Si no hay key, el campo de Lugar sigue funcionando como
// texto plano — no rompe nada.
export function useGoogleMapsLoaded() {
  const [loaded, setLoaded] = useState(!!window.google?.maps?.places)
  useEffect(() => {
    if (window.google?.maps?.places) { setLoaded(true); return }
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!key) return
    const existing = document.querySelector('script[data-google-maps]')
    if (existing) {
      existing.addEventListener('load', () => setLoaded(true))
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true
    script.dataset.googleMaps = 'true'
    script.onload = () => setLoaded(true)
    document.head.appendChild(script)
  }, [])
  return loaded
}

// Campo de "Lugar" con autocompletado de Google Places (si hay API key) y
// cálculo de distancia en línea recta desde La Lucila. Usado tanto en
// NuevaCotizacion.jsx (al cotizar) como en EventoDetalle.jsx (al editar
// un evento ya confirmado) — mismo componente, así el lugar_lat/lugar_lng/
// distancia_km se captura igual en los dos lados y no queda desactualizado
// en uno de los dos.
export function LugarConMapa({ value, lat, lng, distKm, onChange }) {
  const inputRef = useRef(null)
  const mapsLoaded = useGoogleMapsLoaded()

  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || !window.google?.maps?.places) return
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode'],
      componentRestrictions: { country: 'ar' },
      fields: ['formatted_address', 'geometry', 'name'],
    })
    autocomplete.setBounds(
      new window.google.maps.LatLngBounds({ lat: -35.5, lng: -59.5 }, { lat: -33.5, lng: -57.5 })
    )
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry) return
      const placeLat = place.geometry.location.lat()
      const placeLng = place.geometry.location.lng()
      const dist = distanciaKm(LA_LUCILA.lat, LA_LUCILA.lng, placeLat, placeLng)
      onChange({
        lugar: place.formatted_address || place.name,
        lugar_lat: placeLat,
        lugar_lng: placeLng,
        distancia_km: Math.round(dist * 10) / 10,
      })
    })
    return () => window.google.maps.event.removeListener(listener)
  }, [mapsLoaded])

  return (
    <div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange({ lugar: e.target.value, lugar_lat: null, lugar_lng: null, distancia_km: null })}
        className="input"
        placeholder={mapsLoaded ? 'Buscá la localidad o zona…' : 'Ej: Cardales, La Rural…'}
      />
      {distKm != null && (
        <p className="text-xs text-ink-light mt-1 flex items-center gap-1.5">
          <MapPin size={12} /> ~{distKm} km desde La Lucila
          {lat && lng && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${LA_LUCILA.lat},${LA_LUCILA.lng}&destination=${lat},${lng}`}
              target="_blank" rel="noreferrer"
              className="underline hover:text-ink"
            >
              Ver ruta en Google Maps ↗
            </a>
          )}
        </p>
      )}
    </div>
  )
}
