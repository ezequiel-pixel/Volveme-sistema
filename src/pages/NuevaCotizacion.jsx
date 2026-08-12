import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcularCotizacion, configArrayToObject, amortizacionesArrayToObject } from '../lib/pricingEngine'
import { Plus, X, ArrowLeft, Coffee, CalendarDays, Users, Sparkles, MapPin, Cookie, Clock } from 'lucide-react'

// Coordenadas aproximadas de La Lucila, Vicente López — punto de partida fijo
// para estimar distancia (en línea recta) hasta el lugar del evento.
const LA_LUCILA = { lat: -34.4956, lng: -58.4854 }

function distanciaKm(lat1, lng1, lat2, lng2) {
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
function useGoogleMapsLoaded() {
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
// cálculo de distancia en línea recta desde La Lucila. El flete se sigue
// cargando a mano — esto es solo para tener una referencia de distancia.
function LugarConMapa({ value, lat, lng, distKm, onChange }) {
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

// Redondeo hacia arriba a la centena más cercana — se usa tanto para
// mostrar como para lo que se guarda en la base, así el número que ve
// Eze es siempre el mismo que queda grabado en la cotización.
const redondearArriba = (n) => Math.ceil((n || 0) / 100) * 100

const money = (n) =>
  // redondeo siempre hacia arriba, a la centena más cercana — nunca
  // centavos ni números "raros" en la cotización o el PDF
  (Math.ceil((n || 0) / 100) * 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const defaultInputs = {
  nombre_cliente: '', nombre_evento: '', lugar: '', lugar_lat: null, lugar_lng: null, distancia_km: null,
  cantidad_pax: 25, nivel: 'Esencial', tamano_vaso: '6oz',
  cantidad_cafes_override: '', cantidad_baristas: 1, tipo_barra: 'Barra chica 1 grupo',
  amortizacion_override: '', alquiler_maquina_extra: false, alquiler_molino_extra: false,
  calcos: false, logo_3d: false, costo_flete: 0, art: false, art_monto: '',
  clausula_rc_monto: 0, multiplicador: '', iva_pct: '', extra_barista_monto: '',
  extra_distancia: 0,
}

const defaultDia = () => ({ modo: 'horario', fecha: '', horaInicio: '08:00', horaFin: '18:00', duracionHoras: '' })

export default function NuevaCotizacion() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recotizarDesdeId = searchParams.get('desde')
  const [config, setConfig] = useState(null)
  const [amortizaciones, setAmortizaciones] = useState(null)
  const [tiposBarra, setTiposBarra] = useState([])
  const [inputs, setInputs] = useState(defaultInputs)
  const [dias, setDias] = useState([defaultDia()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ---- Pastelería (opcional) ----
  const [productosPasteleria, setProductosPasteleria] = useState([])
  const [llevaPasteleria, setLlevaPasteleria] = useState(false)
  const [pasteleriaMarkup, setPasteleriaMarkup] = useState(65) // %
  const [pasteleriaItems, setPasteleriaItems] = useState([]) // [{producto_id, nombre, precio_proveedor, cantidad}]

  useEffect(() => {
    async function cargarPasteleria() {
      const { data } = await supabase
        .from('pasteleria_productos')
        .select('*')
        .eq('activo', true)
        .order('orden')
      setProductosPasteleria(data || [])
    }
    cargarPasteleria()
  }, [])

  function agregarItemPasteleria() {
    const primero = productosPasteleria[0]
    if (!primero) return
    setPasteleriaItems((prev) => [
      ...prev,
      { producto_id: primero.id, nombre: primero.nombre, precio_proveedor: primero.precio_proveedor, cantidad: 1 },
    ])
  }

  function actualizarItemPasteleria(idx, campo, valor) {
    setPasteleriaItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it
      if (campo === 'producto_id') {
        const prod = productosPasteleria.find((p) => p.id === valor)
        return { ...it, producto_id: valor, nombre: prod?.nombre || '', precio_proveedor: prod?.precio_proveedor || 0 }
      }
      return { ...it, [campo]: valor }
    }))
  }

  function quitarItemPasteleria(idx) {
    setPasteleriaItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const pasteleriaSubtotal = pasteleriaItems.reduce(
    (sum, it) => sum + (Number(it.cantidad) || 0) * (it.precio_proveedor || 0) * (1 + pasteleriaMarkup / 100),
    0
  )
  const pasteleriaPiezasTotales = pasteleriaItems.reduce((sum, it) => sum + (Number(it.cantidad) || 0), 0)

  useEffect(() => {
    async function cargarConfig() {
      const { data: configRows } = await supabase.from('config_pricing').select('*')
      const { data: amortRows } = await supabase.from('amortizacion_tipo_barra').select('*')
      setConfig(configArrayToObject(configRows || []))
      setAmortizaciones(amortizacionesArrayToObject(amortRows || []))
      setTiposBarra((amortRows || []).map((r) => r.tipo))
    }
    cargarConfig()
  }, [])

  // Si viene de "Re-cotizar", precarga todos los datos de la cotización anterior
  useEffect(() => {
    async function precargar() {
      if (!recotizarDesdeId) return
      const { data: cot } = await supabase
        .from('cotizaciones')
        .select('*, clientes(nombre)')
        .eq('id', recotizarDesdeId)
        .single()
      const { data: diasCot } = await supabase
        .from('cotizacion_dias')
        .select('*')
        .eq('cotizacion_id', recotizarDesdeId)
        .order('orden')

      if (cot) {
        setInputs({
          nombre_cliente: cot.clientes?.nombre || '',
          nombre_evento: cot.nombre_evento || '',
          lugar: cot.lugar || '',
          lugar_lat: cot.lugar_lat || null,
          lugar_lng: cot.lugar_lng || null,
          distancia_km: cot.distancia_km || null,
          cantidad_pax: cot.cantidad_pax || 25,
          nivel: cot.nivel === 'premium' || cot.nivel === 'Premium' ? 'Premium' : 'Esencial',
          tamano_vaso: cot.tamano_vaso || '6oz',
          cantidad_cafes_override: cot.cantidad_cafes_override || '',
          cantidad_baristas: cot.cantidad_baristas || 1,
          tipo_barra: cot.tipo_barra || 'Barra chica 1 grupo',
          amortizacion_override: cot.amortizacion_override || '',
          alquiler_maquina_extra: cot.alquiler_maquina_extra || false,
          alquiler_molino_extra: cot.alquiler_molino_extra || false,
          calcos: cot.calcos || false,
          logo_3d: cot.logo_3d || false,
          costo_flete: cot.costo_flete || 0,
          art: cot.art || false,
          art_monto: cot.art_monto || 0,
          clausula_rc_monto: cot.clausula_rc_monto || 0,
          extra_barista_monto: cot.extra_barista_monto || '',
          extra_distancia: cot.extra_distancia ?? 0,
          multiplicador: '',
          iva_pct: '',
        })
        setLlevaPasteleria(cot.lleva_pasteleria || false)
        setPasteleriaMarkup(cot.pasteleria_markup_pct != null ? cot.pasteleria_markup_pct * 100 : 65)
      }
      if (diasCot && diasCot.length) {
        setDias(diasCot.map((d) => ({
          modo: d.duracion_horas != null ? 'horas' : 'horario',
          fecha: d.fecha,
          horaInicio: d.hora_inicio?.slice(0, 5) || '08:00',
          horaFin: d.hora_fin?.slice(0, 5) || '18:00',
          duracionHoras: d.duracion_horas != null ? String(d.duracion_horas) : '',
        })))
      }
      const { data: itemsPast } = await supabase
        .from('cotizacion_pasteleria_items')
        .select('*')
        .eq('cotizacion_id', recotizarDesdeId)
        .order('orden')
      if (itemsPast && itemsPast.length) {
        setPasteleriaItems(itemsPast.map((it) => ({
          producto_id: it.producto_id,
          nombre: it.nombre_producto,
          precio_proveedor: it.precio_proveedor,
          cantidad: it.cantidad,
        })))
      }
    }
    precargar()
  }, [recotizarDesdeId])

  function update(field, value) {
    setInputs((f) => ({ ...f, [field]: value }))
  }

  function updateDia(index, field, value) {
    setDias((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)))
  }

  function agregarDia() {
    setDias((prev) => {
      const ultimo = prev[prev.length - 1]
      let fechaSugerida = ''
      if (ultimo?.fecha) {
        const d = new Date(ultimo.fecha + 'T00:00:00')
        d.setDate(d.getDate() + 1)
        fechaSugerida = d.toISOString().slice(0, 10)
      }
      return [...prev, {
        modo: ultimo?.modo || 'horario',
        fecha: fechaSugerida,
        horaInicio: ultimo?.horaInicio || '08:00',
        horaFin: ultimo?.horaFin || '18:00',
        duracionHoras: ultimo?.duracionHoras || '',
      }]
    })
  }

  function quitarDia(index) {
    setDias((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  const resultado = config && amortizaciones
    ? calcularCotizacion(
        {
          ...inputs,
          dias,
          cantidad_pax: Number(inputs.cantidad_pax) || 0,
          cantidad_cafes_override: inputs.cantidad_cafes_override ? Number(inputs.cantidad_cafes_override) : null,
          cantidad_baristas: Number(inputs.cantidad_baristas) || 0,
          amortizacion_override: inputs.amortizacion_override ? Number(inputs.amortizacion_override) : null,
          costo_flete: Number(inputs.costo_flete) || 0,
          art_monto: Number(inputs.art_monto) || 0,
          clausula_rc_monto: Number(inputs.clausula_rc_monto) || 0,
          multiplicador: inputs.multiplicador ? Number(inputs.multiplicador) : null,
          iva_pct: inputs.iva_pct !== '' ? Number(inputs.iva_pct) : null,
          extra_barista_monto: Number(inputs.extra_barista_monto) || 0,
          extra_distancia: Number(inputs.extra_distancia) || 0,
        },
        config, amortizaciones
      )
    : null

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (dias.some((d) => !d.fecha)) {
      setError('Completá la fecha de cada día del evento.')
      setSaving(false)
      return
    }
    if (dias.some((d) => (d.modo || 'horario') === 'horas' && !d.duracionHoras)) {
      setError('Completá la cantidad de horas para cada día que no tenga horario específico.')
      setSaving(false)
      return
    }

    let clienteId = null
    if (inputs.nombre_cliente.trim()) {
      const { data: existente } = await supabase
        .from('clientes').select('id').ilike('nombre', inputs.nombre_cliente.trim()).maybeSingle()
      if (existente) {
        clienteId = existente.id
      } else {
        const { data: nuevo, error: errCliente } = await supabase
          .from('clientes').insert({ nombre: inputs.nombre_cliente.trim() }).select('id').single()
        if (errCliente) { setError(`No se pudo crear el cliente: ${errCliente.message}`); console.error(errCliente); setSaving(false); return }
        clienteId = nuevo.id
      }
    }

    const diasOrdenados = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha))
    const primerDia = diasOrdenados[0]

    const { data: nuevaCot, error: errCot } = await supabase.from('cotizaciones').insert({
      cliente_id: clienteId,
      nombre_evento: inputs.nombre_evento || `Evento — ${inputs.nombre_cliente}`,
      fecha_evento: primerDia.fecha,
      hora_inicio: primerDia.horaInicio || null,
      lugar: inputs.lugar || null,
      lugar_lat: inputs.lugar_lat || null,
      lugar_lng: inputs.lugar_lng || null,
      distancia_km: inputs.distancia_km || null,
      cantidad_pax: Number(inputs.cantidad_pax) || null,
      nivel: inputs.nivel.toLowerCase(),
      tamano_vaso: inputs.tamano_vaso,
      cantidad_cafes_override: inputs.cantidad_cafes_override ? Number(inputs.cantidad_cafes_override) : null,
      cantidad_baristas: Number(inputs.cantidad_baristas) || 1,
      tipo_barra: inputs.tipo_barra,
      amortizacion_override: inputs.amortizacion_override ? Number(inputs.amortizacion_override) : null,
      alquiler_maquina_extra: inputs.alquiler_maquina_extra,
      alquiler_molino_extra: inputs.alquiler_molino_extra,
      calcos: inputs.calcos,
      logo_3d: inputs.logo_3d,
      costo_flete: Number(inputs.costo_flete) || 0,
      art: inputs.art,
      art_monto: Number(inputs.art_monto) || 0,
      clausula_rc_monto: Number(inputs.clausula_rc_monto) || 0,
      extra_barista_monto: Number(inputs.extra_barista_monto) || 0,
      extra_distancia: Number(inputs.extra_distancia) || 0,
      multiplicador: inputs.multiplicador ? Number(inputs.multiplicador) : config.multiplicador_precio,
      iva_pct: inputs.iva_pct !== '' ? Number(inputs.iva_pct) : config.iva_pct,
      estado: 'enviada',
      recotizada_desde_id: recotizarDesdeId || null,
      costo_total: redondearArriba(resultado.costoTotal),
      precio_neto: redondearArriba(resultado.precioNeto),
      iva_monto: redondearArriba(resultado.ivaMonto),
      precio_final: redondearArriba(resultado.precioFinal + (llevaPasteleria ? pasteleriaSubtotal : 0)),
      margen_pct: resultado.margenPct,
      lleva_pasteleria: llevaPasteleria,
      pasteleria_markup_pct: llevaPasteleria ? pasteleriaMarkup / 100 : null,
      pasteleria_subtotal: llevaPasteleria ? redondearArriba(pasteleriaSubtotal) : 0,
    }).select('id').single()

    if (errCot) { setSaving(false); setError(`No se pudo guardar la cotización: ${errCot.message}`); console.error(errCot); return }

    const { error: errDias } = await supabase.from('cotizacion_dias').insert(
      diasOrdenados.map((d, i) => ({
        cotizacion_id: nuevaCot.id,
        fecha: d.fecha,
        hora_inicio: (d.modo || 'horario') === 'horas' ? null : d.horaInicio,
        hora_fin: (d.modo || 'horario') === 'horas' ? null : d.horaFin,
        duracion_horas: (d.modo || 'horario') === 'horas' ? Number(d.duracionHoras) || null : null,
        orden: i,
      }))
    )

    if (llevaPasteleria && pasteleriaItems.length > 0) {
      await supabase.from('cotizacion_pasteleria_items').insert(
        pasteleriaItems.map((it, i) => ({
          cotizacion_id: nuevaCot.id,
          producto_id: it.producto_id,
          nombre_producto: it.nombre,
          precio_proveedor: it.precio_proveedor,
          cantidad: Number(it.cantidad) || 1,
          orden: i,
        }))
      )
    }

    setSaving(false)
    if (errDias) { setError(`La cotización se guardó, pero hubo un error guardando los días: ${errDias.message}`); console.error(errDias); return }
    navigate('/cotizaciones')
  }

  return (
    <div>
      <Link to="/cotizaciones" className="flex items-center gap-1.5 text-sm text-ink-light hover:text-ink mb-4">
        <ArrowLeft size={15} /> Volver a Cotizaciones
      </Link>

      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-orange font-medium mb-1">
          {recotizarDesdeId ? 'Re-cotización' : 'Nueva cotización'}
        </p>
        <h1 className="font-display text-3xl">Armá el presupuesto</h1>
        {recotizarDesdeId && (
          <p className="text-sm text-blue-dark mt-2">
            Precargado con los datos de la propuesta anterior — ajustá lo que haga falta.
          </p>
        )}
      </div>

      {!config ? (
        <p className="text-sm text-ink-light">Cargando configuración…</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
          <div className="space-y-6">
            <SectionCard icon={Users} title="Datos del evento" color="wine">
              <Row>
                <Field label="Cliente" required>
                  <input required value={inputs.nombre_cliente} onChange={(e) => update('nombre_cliente', e.target.value)} className="input" placeholder="Nombre del cliente" />
                </Field>
                <Field label="Nombre del evento">
                  <input value={inputs.nombre_evento} onChange={(e) => update('nombre_evento', e.target.value)} className="input" placeholder="Ej: Corporativo YPF" />
                </Field>
              </Row>
              <Row>
                <Field label="Lugar">
                  <LugarConMapa
                    value={inputs.lugar}
                    lat={inputs.lugar_lat}
                    lng={inputs.lugar_lng}
                    distKm={inputs.distancia_km}
                    onChange={(patch) => setInputs((prev) => ({ ...prev, ...patch }))}
                  />
                </Field>
                <Field label="Cantidad de invitados (Pax)">
                  <input type="number" min="0" value={inputs.cantidad_pax} onChange={(e) => update('cantidad_pax', e.target.value)} className="input" />
                </Field>
              </Row>
            </SectionCard>

            <SectionCard icon={CalendarDays} title={`Días del evento`} badge={dias.length} color="orange">
              <div className="space-y-2">
                {dias.map((dia, i) => (
                  <div key={i} className="bg-paper-card border border-rule rounded p-3 space-y-2">
                    <div className="flex items-end gap-2">
                      <Field label={`Día ${i + 1}`}>
                        <input type="date" required value={dia.fecha} onChange={(e) => updateDia(i, 'fecha', e.target.value)} className="input" />
                      </Field>
                      <Field label="Modo">
                        <select
                          value={dia.modo || 'horario'}
                          onChange={(e) => updateDia(i, 'modo', e.target.value)}
                          className="input"
                        >
                          <option value="horario">Horario específico</option>
                          <option value="horas">Solo cantidad de horas</option>
                        </select>
                      </Field>
                      {dias.length > 1 && (
                        <button type="button" onClick={() => quitarDia(i)} className="text-ink-light hover:text-coral pb-2.5">
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {(dia.modo || 'horario') === 'horario' ? (
                      <div className="flex items-end gap-2">
                        <Field label="Desde">
                          <input type="time" required value={dia.horaInicio} onChange={(e) => updateDia(i, 'horaInicio', e.target.value)} className="input" />
                        </Field>
                        <Field label="Hasta">
                          <input type="time" required value={dia.horaFin} onChange={(e) => updateDia(i, 'horaFin', e.target.value)} className="input" />
                        </Field>
                      </div>
                    ) : (
                      <Field label="Cantidad de horas">
                        <input
                          type="number" min="0" step="0.5" required
                          value={dia.duracionHoras}
                          onChange={(e) => updateDia(i, 'duracionHoras', e.target.value)}
                          className="input"
                          placeholder="Ej: 3"
                        />
                      </Field>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={agregarDia} className="flex items-center gap-1 text-xs text-orange font-medium hover:underline mt-1">
                <Plus size={13} /> Agregar otro día
              </button>
            </SectionCard>

            <SectionCard icon={Coffee} title="Servicio" color="blue">
              <Row>
                <Field label="Nivel">
                  <select value={inputs.nivel} onChange={(e) => update('nivel', e.target.value)} className="input">
                    <option value="Esencial">Esencial</option>
                    <option value="Premium">Premium</option>
                  </select>
                </Field>
                <Field label="Tamaño de vaso">
                  <select value={inputs.tamano_vaso} onChange={(e) => update('tamano_vaso', e.target.value)} className="input">
                    <option value="6oz">6oz</option>
                    <option value="8oz">8oz</option>
                    <option value="12oz">12oz</option>
                  </select>
                </Field>
              </Row>
              <Field label="Cantidad de cafés (dejar vacío = Pax × consumo)">
                <input type="number" min="0" value={inputs.cantidad_cafes_override} onChange={(e) => update('cantidad_cafes_override', e.target.value)} className="input" />
              </Field>
              <Row>
                <Field label="Cantidad de baristas">
                  <input type="number" min="0" value={inputs.cantidad_baristas} onChange={(e) => update('cantidad_baristas', e.target.value)} className="input" />
                </Field>
                <Field label="Tipo de barra">
                  <select value={inputs.tipo_barra} onChange={(e) => update('tipo_barra', e.target.value)} className="input">
                    {tiposBarra.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </Row>
              <Field label="Extra al barista ($, opcional — bono, hora extra puntual, etc.)">
                <input
                  type="number" min="0"
                  value={inputs.extra_barista_monto}
                  onChange={(e) => update('extra_barista_monto', e.target.value)}
                  className="input"
                  placeholder="0"
                />
              </Field>
              <div className="flex gap-5 pt-1">
                <Checkbox label="Alquiler máquina extra" checked={inputs.alquiler_maquina_extra} onChange={(v) => update('alquiler_maquina_extra', v)} />
                <Checkbox label="Alquiler molino extra" checked={inputs.alquiler_molino_extra} onChange={(v) => update('alquiler_molino_extra', v)} />
              </div>
            </SectionCard>

            <SectionCard icon={Sparkles} title="Extras y operativos" color="coral">
              <div className="flex gap-5">
                <Checkbox label="Calcos" checked={inputs.calcos} onChange={(v) => update('calcos', v)} />
                <Checkbox label="Logo 3D" checked={inputs.logo_3d} onChange={(v) => update('logo_3d', v)} />
                <Checkbox
                  label="ART"
                  checked={inputs.art}
                  onChange={(v) => setInputs((prev) => ({
                    ...prev,
                    art: v,
                    art_monto: v && prev.art_monto === '' ? 2000 : prev.art_monto,
                  }))}
                />
              </div>
              <Row>
                <Field label="Flete / Transporte ($)">
                  <input type="number" min="0" value={inputs.costo_flete} onChange={(e) => update('costo_flete', e.target.value)} className="input" placeholder="0" />
                </Field>
                {inputs.art && (
                  <Field label="Monto ART ($)">
                    <input type="number" min="0" value={inputs.art_monto} onChange={(e) => update('art_monto', e.target.value)} className="input" placeholder="2000" />
                  </Field>
                )}
              </Row>
            </SectionCard>

            <SectionCard icon={Sparkles} title="Extra distancia" color="coral">
              <Field label="Extra distancia ($) — cargalo vos según el evento">
                <input type="number" min="0" value={inputs.extra_distancia} onChange={(e) => update('extra_distancia', e.target.value)} className="input" placeholder="0" />
              </Field>
              <p className="text-xs text-ink-light">
                Guía: para un evento de ~2hs con distancia considerable, contá al menos 1 hora extra
                (1 × ${config ? Number(config.sueldo_barista_hora || 0).toLocaleString('es-AR') : '12.500'} por barista) como referencia.
              </p>
            </SectionCard>

            <SectionCard icon={Cookie} title="Pastelería (opcional)" color="orange">
              <Checkbox label="Este evento lleva pastelería" checked={llevaPasteleria} onChange={setLlevaPasteleria} />

              {llevaPasteleria && (
                <div className="space-y-4 mt-3">
                  <Field label="Tu margen sobre el precio de proveedor (%)">
                    <input
                      type="number" min="0" step="1"
                      value={pasteleriaMarkup}
                      onChange={(e) => setPasteleriaMarkup(Number(e.target.value))}
                      className="input"
                    />
                  </Field>

                  <div className="bg-paper-warm/40 border border-rule rounded p-3 text-xs text-ink-mid">
                    <strong className="text-ink">Guía rápida:</strong> calculá ~1 pieza por persona.
                    Para {inputs.cantidad_pax || '—'} pax podés armar, por ejemplo, 1 medialuna + 1 chipa
                    + 1 de otra cosa por invitado, o combinar 2 de una y 1 de otra — vos decidís la mezcla
                    con los renglones de abajo.
                    {inputs.cantidad_pax > 0 && (
                      <span className="block mt-1">
                        Piezas cargadas hasta ahora: <strong>{pasteleriaPiezasTotales}</strong> de{' '}
                        <strong>{inputs.cantidad_pax}</strong> sugeridas (1 x pax).
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {pasteleriaItems.map((it, i) => (
                      <div key={i} className="flex items-end gap-2 bg-paper-card border border-rule rounded p-2.5">
                        <Field label="Producto">
                          <select
                            value={it.producto_id}
                            onChange={(e) => actualizarItemPasteleria(i, 'producto_id', e.target.value)}
                            className="input"
                          >
                            {productosPasteleria.map((p) => (
                              <option key={p.id} value={p.id}>{p.nombre} — ${Number(p.precio_proveedor).toLocaleString('es-AR')}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Cantidad">
                          <input
                            type="number" min="1"
                            value={it.cantidad}
                            onChange={(e) => actualizarItemPasteleria(i, 'cantidad', e.target.value)}
                            className="input w-24"
                          />
                        </Field>
                        <div className="text-xs text-ink-mid pb-2.5 whitespace-nowrap">
                          = ${Math.round((Number(it.cantidad) || 0) * it.precio_proveedor * (1 + pasteleriaMarkup / 100)).toLocaleString('es-AR')}
                        </div>
                        <button type="button" onClick={() => quitarItemPasteleria(i)} className="text-ink-light hover:text-coral pb-2.5">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={agregarItemPasteleria}
                    disabled={productosPasteleria.length === 0}
                    className="flex items-center gap-1.5 text-xs text-wine hover:underline disabled:opacity-40"
                  >
                    <Plus size={13} /> Agregar producto
                  </button>

                  <div className="flex items-center justify-between border-t border-rule pt-3">
                    <span className="text-sm text-ink-mid">Subtotal pastelería (con tu margen)</span>
                    <span className="font-display text-xl text-wine">${Math.round(pasteleriaSubtotal).toLocaleString('es-AR')}</span>
                  </div>
                </div>
              )}
            </SectionCard>

            {error && <p className="text-coral text-sm">{error}</p>}
          </div>

          {/* Panel de cálculo — fijo al costado */}
          <div className="lg:sticky lg:top-8 space-y-4">
            <div className="bg-wine text-paper rounded-lg p-6">
              <p className="text-xs uppercase tracking-wide text-peach/80 mb-1">Precio final</p>
              <p className="font-display text-4xl mb-1">
                {resultado ? money(resultado.precioFinal + (llevaPasteleria ? pasteleriaSubtotal : 0)) : '—'}
              </p>
              <p className="text-xs text-peach/70">Sin IVA</p>
            </div>

            <div className="border border-rule rounded-lg p-5 bg-paper-card space-y-3 text-sm">
              {resultado && (
                <>
                  <LineaResumen label="Días de evento" valor={`${resultado.cantidadDias} · ${resultado.totalHoras.toFixed(1)} hs`} />
                  <LineaResumen label="Bebidas a preparar" valor={resultado.bebidasReales.toFixed(1)} />
                  <div className="border-t border-rule pt-3 space-y-2">
                    <LineaResumen label="Insumos" valor={money(resultado.totalInsumos)} />
                    <LineaResumen label="Mano de obra" valor={money(resultado.totalManoDeObra)} />
                    <LineaResumen label="Amortización equipo" valor={money(resultado.amortizacionTotal)} />
                    <LineaResumen label="Operativos (flete/transporte, ART, RC)" valor={money(resultado.flete + resultado.art + resultado.clausulaRc)} />
                    <LineaResumen label="Extra distancia" valor={money(resultado.extraDistancia)} />
                    <LineaResumen label="Calcos + Logo 3D" valor={money(resultado.costoCalcos + resultado.costoLogo3d)} />
                    <LineaResumen label={`Imprevistos (${(resultado.imprevistosPct * 100).toFixed(0)}%)`} valor={money(resultado.imprevistosMonto)} />
                  </div>
                  <div className="border-t border-rule pt-3">
                    <LineaResumen label="Costo total" valor={money(resultado.costoTotal)} bold />
                  </div>
                  <div className="border-t border-rule pt-3">
                    <LineaResumen label="Margen" valor={`${(resultado.margenPct * 100).toFixed(1)}%`} />
                    <LineaResumen label={`IVA (${((resultado.ivaMonto / (resultado.precioNeto || 1)) * 100).toFixed(0)}%) — no sumado al total`} valor={money(resultado.ivaMonto)} />
                    {llevaPasteleria && (
                      <LineaResumen label="Pastelería (con tu margen)" valor={money(pasteleriaSubtotal)} bold />
                    )}
                    <LineaResumen label="Consumo x persona" valor={money(resultado.consumoPromedioPorPersona)} />
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-orange text-paper font-medium rounded-lg py-3.5 hover:bg-orange/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cotización'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const colorMap = {
  wine: { text: 'text-wine', bg: 'bg-wine', badge: 'bg-wine text-paper' },
  orange: { text: 'text-orange', bg: 'bg-orange', badge: 'bg-orange text-paper' },
  blue: { text: 'text-blue-dark', bg: 'bg-blue-dark', badge: 'bg-blue-dark text-paper' },
  coral: { text: 'text-coral', bg: 'bg-coral', badge: 'bg-coral text-paper' },
}

function SectionCard({ icon: Icon, title, badge, color, children }) {
  const c = colorMap[color] || colorMap.wine
  return (
    <div className="border border-rule rounded-lg overflow-hidden bg-paper">
      <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b border-rule bg-paper-card`}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${c.bg}`}>
          <Icon size={14} className="text-paper" strokeWidth={2} />
        </div>
        <h2 className="font-display text-lg">{title}</h2>
        {badge != null && (
          <span className={`ml-auto text-xs font-medium rounded-full px-2.5 py-1 ${c.badge}`}>{badge}</span>
        )}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Row({ children }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}
function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-ink-light mb-1.5">{label} {required && <span className="text-coral">*</span>}</span>
      {children}
    </label>
  )
}
function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-mid cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-orange w-4 h-4" />
      {label}
    </label>
  )
}
function LineaResumen({ label, valor, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-ink-mid ${bold ? 'font-medium text-ink' : ''}`}>{label}</span>
      <span className={`${bold ? 'font-medium text-ink' : 'text-ink-mid'}`}>{valor}</span>
    </div>
  )
}
