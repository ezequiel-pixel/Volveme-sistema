import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcularCotizacion, configArrayToObject, amortizacionesArrayToObject } from '../lib/pricingEngine'
import { Plus, X, ArrowLeft, Coffee, CalendarDays, Users, Sparkles } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const defaultInputs = {
  nombre_cliente: '', nombre_evento: '', lugar: '',
  cantidad_pax: 25, nivel: 'Esencial', tamano_vaso: '6oz',
  cantidad_cafes_override: '', cantidad_baristas: 1, tipo_barra: 'Barra chica 1 grupo',
  amortizacion_override: '', alquiler_maquina_extra: false, alquiler_molino_extra: false,
  calcos: false, logo_3d: false, costo_flete: 0, art: false, art_monto: 0,
  clausula_rc_monto: 0, multiplicador: '', iva_pct: '',
}

const defaultDia = () => ({ fecha: '', horaInicio: '08:00', horaFin: '18:00' })

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
          multiplicador: '',
          iva_pct: '',
        })
      }
      if (diasCot && diasCot.length) {
        setDias(diasCot.map((d) => ({ fecha: d.fecha, horaInicio: d.hora_inicio?.slice(0, 5), horaFin: d.hora_fin?.slice(0, 5) })))
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
      return [...prev, { fecha: fechaSugerida, horaInicio: ultimo?.horaInicio || '08:00', horaFin: ultimo?.horaFin || '18:00' }]
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
      hora_inicio: primerDia.horaInicio,
      lugar: inputs.lugar || null,
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
      multiplicador: inputs.multiplicador ? Number(inputs.multiplicador) : config.multiplicador_precio,
      iva_pct: inputs.iva_pct !== '' ? Number(inputs.iva_pct) : config.iva_pct,
      estado: 'enviada',
      recotizada_desde_id: recotizarDesdeId || null,
      costo_total: resultado.costoTotal,
      precio_neto: resultado.precioNeto,
      iva_monto: resultado.ivaMonto,
      precio_final: resultado.precioFinal,
      margen_pct: resultado.margenPct,
    }).select('id').single()

    if (errCot) { setSaving(false); setError(`No se pudo guardar la cotización: ${errCot.message}`); console.error(errCot); return }

    const { error: errDias } = await supabase.from('cotizacion_dias').insert(
      diasOrdenados.map((d, i) => ({
        cotizacion_id: nuevaCot.id,
        fecha: d.fecha,
        hora_inicio: d.horaInicio,
        hora_fin: d.horaFin,
        orden: i,
      }))
    )

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
                  <input value={inputs.lugar} onChange={(e) => update('lugar', e.target.value)} className="input" placeholder="Ej: Cardales, La Rural…" />
                </Field>
                <Field label="Cantidad de invitados (Pax)">
                  <input type="number" min="0" value={inputs.cantidad_pax} onChange={(e) => update('cantidad_pax', e.target.value)} className="input" />
                </Field>
              </Row>
            </SectionCard>

            <SectionCard icon={CalendarDays} title={`Días del evento`} badge={dias.length} color="orange">
              <div className="space-y-2">
                {dias.map((dia, i) => (
                  <div key={i} className="flex items-end gap-2 bg-paper-card border border-rule rounded p-3">
                    <Field label={`Día ${i + 1}`}>
                      <input type="date" required value={dia.fecha} onChange={(e) => updateDia(i, 'fecha', e.target.value)} className="input" />
                    </Field>
                    <Field label="Desde">
                      <input type="time" required value={dia.horaInicio} onChange={(e) => updateDia(i, 'horaInicio', e.target.value)} className="input" />
                    </Field>
                    <Field label="Hasta">
                      <input type="time" required value={dia.horaFin} onChange={(e) => updateDia(i, 'horaFin', e.target.value)} className="input" />
                    </Field>
                    {dias.length > 1 && (
                      <button type="button" onClick={() => quitarDia(i)} className="text-ink-light hover:text-coral pb-2.5">
                        <X size={16} />
                      </button>
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
              <div className="flex gap-5 pt-1">
                <Checkbox label="Alquiler máquina extra" checked={inputs.alquiler_maquina_extra} onChange={(v) => update('alquiler_maquina_extra', v)} />
                <Checkbox label="Alquiler molino extra" checked={inputs.alquiler_molino_extra} onChange={(v) => update('alquiler_molino_extra', v)} />
              </div>
            </SectionCard>

            <SectionCard icon={Sparkles} title="Extras y operativos" color="coral">
              <div className="flex gap-5">
                <Checkbox label="Calcos" checked={inputs.calcos} onChange={(v) => update('calcos', v)} />
                <Checkbox label="Logo 3D" checked={inputs.logo_3d} onChange={(v) => update('logo_3d', v)} />
                <Checkbox label="ART" checked={inputs.art} onChange={(v) => update('art', v)} />
              </div>
              <Row>
                <Field label="Flete ($)">
                  <input type="number" min="0" value={inputs.costo_flete} onChange={(e) => update('costo_flete', e.target.value)} className="input" />
                </Field>
                {inputs.art && (
                  <Field label="Monto ART ($)">
                    <input type="number" min="0" value={inputs.art_monto} onChange={(e) => update('art_monto', e.target.value)} className="input" />
                  </Field>
                )}
              </Row>
            </SectionCard>

            {error && <p className="text-coral text-sm">{error}</p>}
          </div>

          {/* Panel de cálculo — fijo al costado */}
          <div className="lg:sticky lg:top-8 space-y-4">
            <div className="bg-wine text-paper rounded-lg p-6">
              <p className="text-xs uppercase tracking-wide text-peach/80 mb-1">Precio final</p>
              <p className="font-display text-4xl mb-1">{resultado ? money(resultado.precioFinal) : '—'}</p>
              <p className="text-xs text-peach/70">IVA incluido</p>
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
                    <LineaResumen label="Operativos" valor={money(resultado.flete + resultado.art + resultado.clausulaRc)} />
                  </div>
                  <div className="border-t border-rule pt-3">
                    <LineaResumen label="Costo total" valor={money(resultado.costoTotal)} bold />
                  </div>
                  <div className="border-t border-rule pt-3">
                    <LineaResumen label="Margen" valor={`${(resultado.margenPct * 100).toFixed(1)}%`} />
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
