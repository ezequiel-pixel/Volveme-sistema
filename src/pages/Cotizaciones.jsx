import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcularCotizacion, configArrayToObject, amortizacionesArrayToObject } from '../lib/pricingEngine'
import { Plus, X } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const estadoStyles = {
  borrador: 'bg-paper-warm text-ink-mid',
  enviada: 'bg-peach text-orange',
  aceptada: 'bg-blue-light text-blue-dark',
  rechazada: 'bg-coral-light text-coral',
}

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('cotizaciones')
      .select('*, clientes(nombre)')
      .order('created_at', { ascending: false })
    setCotizaciones(data || [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function cambiarEstado(cotizacion, nuevoEstado) {
    if (nuevoEstado === 'aceptada' && !cotizacion.evento_id) {
      const { data: nuevoEvento, error: errEvento } = await supabase
        .from('eventos')
        .insert({
          cliente_id: cotizacion.cliente_id,
          cotizacion_id: cotizacion.id,
          nombre: cotizacion.nombre_evento,
          fecha: cotizacion.fecha_evento,
          hora_inicio: cotizacion.hora_inicio,
          lugar: cotizacion.lugar,
          cantidad_personas: cotizacion.cantidad_pax,
          estado: 'confirmado',
        })
        .select('id')
        .single()

      if (errEvento) {
        alert('No se pudo crear el evento automáticamente.')
        return
      }

      await supabase
        .from('cotizaciones')
        .update({ estado: nuevoEstado, evento_id: nuevoEvento.id })
        .eq('id', cotizacion.id)
    } else {
      await supabase.from('cotizaciones').update({ estado: nuevoEstado }).eq('id', cotizacion.id)
    }
    cargar()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Cotizaciones</p>
          <h1 className="font-display text-2xl">Presupuestos</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors"
        >
          <Plus size={15} /> Nueva cotización
        </button>
      </div>

      <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-ink-light">
              <th className="px-4 py-3 font-medium">Fecha evento</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Pax</th>
              <th className="px-4 py-3 font-medium">Precio final</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-light">Cargando…</td></tr>
            )}
            {!loading && cotizaciones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-light">
                  No hay cotizaciones cargadas todavía.
                </td>
              </tr>
            )}
            {cotizaciones.map((cot) => (
              <tr key={cot.id} className="border-b border-rule last:border-0 hover:bg-paper-warm/40">
                <td className="px-4 py-3">
                  {cot.fecha_evento
                    ? new Date(cot.fecha_evento + 'T00:00:00').toLocaleDateString('es-AR')
                    : '—'}
                </td>
                <td className="px-4 py-3 font-medium text-ink">{cot.clientes?.nombre || '—'}</td>
                <td className="px-4 py-3 text-ink-mid">{cot.cantidad_pax || '—'}</td>
                <td className="px-4 py-3 text-ink-mid">{money(cot.precio_final)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${estadoStyles[cot.estado]}`}>
                    {cot.estado}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {cot.estado === 'borrador' && (
                    <button onClick={() => cambiarEstado(cot, 'enviada')} className="text-xs text-blue-dark hover:underline">
                      Marcar enviada
                    </button>
                  )}
                  {cot.estado === 'enviada' && (
                    <div className="flex gap-3">
                      <button onClick={() => cambiarEstado(cot, 'aceptada')} className="text-xs text-blue-dark hover:underline">
                        Confirmar → crea evento
                      </button>
                      <button onClick={() => cambiarEstado(cot, 'rechazada')} className="text-xs text-coral hover:underline">
                        Rechazar
                      </button>
                    </div>
                  )}
                  {cot.estado === 'aceptada' && <span className="text-xs text-ink-light">Evento creado ✓</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <NuevaCotizacionModal
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); cargar() }}
        />
      )}
    </div>
  )
}

const defaultInputs = {
  nombre_cliente: '', nombre_evento: '', fecha_evento: '', hora_inicio: '', lugar: '',
  cantidad_pax: 25, duracion_horas: 3, cantidad_dias: 1, nivel: 'Esencial', tamano_vaso: '6oz',
  cantidad_cafes_override: '', cantidad_baristas: 1, tipo_barra: 'Barra chica 1 grupo',
  amortizacion_override: '', alquiler_maquina_extra: false, alquiler_molino_extra: false,
  calcos: false, logo_3d: false, costo_flete: 0, art: false, art_monto: 0,
  clausula_rc_monto: 0, multiplicador: '', iva_pct: '',
}

function NuevaCotizacionModal({ onClose, onCreated }) {
  const [config, setConfig] = useState(null)
  const [amortizaciones, setAmortizaciones] = useState(null)
  const [tiposBarra, setTiposBarra] = useState([])
  const [inputs, setInputs] = useState(defaultInputs)
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

  function update(field, value) {
    setInputs((f) => ({ ...f, [field]: value }))
  }

  const resultado = config && amortizaciones
    ? calcularCotizacion(
        {
          ...inputs,
          cantidad_pax: Number(inputs.cantidad_pax) || 0,
          duracion_horas: Number(inputs.duracion_horas) || 0,
          cantidad_dias: Number(inputs.cantidad_dias) || 1,
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

    let clienteId = null
    if (inputs.nombre_cliente.trim()) {
      const { data: existente } = await supabase
        .from('clientes').select('id').ilike('nombre', inputs.nombre_cliente.trim()).maybeSingle()
      if (existente) {
        clienteId = existente.id
      } else {
        const { data: nuevo, error: errCliente } = await supabase
          .from('clientes').insert({ nombre: inputs.nombre_cliente.trim() }).select('id').single()
        if (errCliente) { setError('No se pudo crear el cliente.'); setSaving(false); return }
        clienteId = nuevo.id
      }
    }

    const { error: errCot } = await supabase.from('cotizaciones').insert({
      cliente_id: clienteId,
      nombre_evento: inputs.nombre_evento || `Evento — ${inputs.nombre_cliente}`,
      fecha_evento: inputs.fecha_evento || null,
      hora_inicio: inputs.hora_inicio || null,
      lugar: inputs.lugar || null,
      cantidad_pax: Number(inputs.cantidad_pax) || null,
      duracion_horas: Number(inputs.duracion_horas) || null,
      cantidad_dias: Number(inputs.cantidad_dias) || 1,
      nivel: inputs.nivel,
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
      estado: 'borrador',
      costo_total: resultado.costoTotal,
      precio_neto: resultado.precioNeto,
      iva_monto: resultado.ivaMonto,
      precio_final: resultado.precioFinal,
      margen_pct: resultado.margenPct,
    })

    setSaving(false)
    if (errCot) { setError('No se pudo guardar la cotización.'); return }
    onCreated()
  }

  if (!config) {
    return (
      <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
        <div className="bg-paper rounded-lg px-6 py-4 text-sm text-ink-light">Cargando configuración…</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <div className="bg-paper w-full max-w-3xl rounded-lg border border-rule max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <h2 className="font-display text-lg">Nueva cotización</h2>
          <button onClick={onClose} className="text-ink-light hover:text-ink"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 overflow-hidden flex-1">
          <form onSubmit={handleSubmit} id="cot-form" className="p-5 space-y-4 overflow-y-auto border-r border-rule">
            <Section title="Datos del evento">
              <Row>
                <Field label="Cliente" required>
                  <input required value={inputs.nombre_cliente} onChange={(e) => update('nombre_cliente', e.target.value)} className="input" />
                </Field>
                <Field label="Nombre del evento">
                  <input value={inputs.nombre_evento} onChange={(e) => update('nombre_evento', e.target.value)} className="input" />
                </Field>
              </Row>
              <Row>
                <Field label="Fecha" required>
                  <input type="date" required value={inputs.fecha_evento} onChange={(e) => update('fecha_evento', e.target.value)} className="input" />
                </Field>
                <Field label="Hora">
                  <input type="time" value={inputs.hora_inicio} onChange={(e) => update('hora_inicio', e.target.value)} className="input" />
                </Field>
              </Row>
              <Row>
                <Field label="Lugar">
                  <input value={inputs.lugar} onChange={(e) => update('lugar', e.target.value)} className="input" />
                </Field>
                <Field label="Pax">
                  <input type="number" min="0" value={inputs.cantidad_pax} onChange={(e) => update('cantidad_pax', e.target.value)} className="input" />
                </Field>
              </Row>
            </Section>

            <Section title="Servicio">
              <Row>
                <Field label="Duración (hs/día)">
                  <input type="number" min="0" value={inputs.duracion_horas} onChange={(e) => update('duracion_horas', e.target.value)} className="input" />
                </Field>
                <Field label="Cantidad de días">
                  <input type="number" min="1" value={inputs.cantidad_dias} onChange={(e) => update('cantidad_dias', e.target.value)} className="input" />
                </Field>
              </Row>
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
            </Section>

            <Section title="Equipo humano y barra">
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
              <div className="flex gap-4">
                <Checkbox label="Alquiler máquina extra" checked={inputs.alquiler_maquina_extra} onChange={(v) => update('alquiler_maquina_extra', v)} />
                <Checkbox label="Alquiler molino extra" checked={inputs.alquiler_molino_extra} onChange={(v) => update('alquiler_molino_extra', v)} />
              </div>
            </Section>

            <Section title="Extras">
              <div className="flex gap-4">
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
            </Section>

            {error && <p className="text-coral text-sm">{error}</p>}
          </form>

          <div className="p-5 overflow-y-auto bg-paper-card">
            <p className="text-xs uppercase tracking-wide text-ink-light mb-3">Cálculo en vivo</p>
            {resultado && (
              <div className="space-y-3 text-sm">
                <LineaResumen label="Bebidas a preparar" valor={resultado.bebidasReales.toFixed(1)} />
                <LineaResumen label="Total insumos" valor={money(resultado.totalInsumos)} />
                <LineaResumen label="Mano de obra" valor={money(resultado.totalManoDeObra)} />
                <LineaResumen label="Amortización equipo" valor={money(resultado.amortizacionTotal)} />
                <LineaResumen label="Operativos (flete/ART)" valor={money(resultado.flete + resultado.art + resultado.clausulaRc)} />
                <div className="border-t border-rule pt-3 mt-3">
                  <LineaResumen label="Costo total" valor={money(resultado.costoTotal)} bold />
                </div>
                <div className="border-t border-rule pt-3">
                  <LineaResumen label="Precio neto" valor={money(resultado.precioNeto)} />
                  <LineaResumen label={`IVA (${((inputs.iva_pct !== '' ? inputs.iva_pct : config.iva_pct) * 100).toFixed(0)}%)`} valor={money(resultado.ivaMonto)} />
                </div>
                <div className="border-t border-rule pt-3">
                  <LineaResumen label="PRECIO FINAL" valor={money(resultado.precioFinal)} bold size="lg" />
                </div>
                <p className="text-xs text-ink-light pt-2">
                  Margen: {(resultado.margenPct * 100).toFixed(1)}% · Consumo x persona: {money(resultado.consumoPromedioPorPersona)}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-rule">
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 text-ink-light hover:text-ink">Cancelar</button>
          <button type="submit" form="cot-form" disabled={saving} className="bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar cotización'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return <div><p className="text-xs uppercase tracking-wide text-ink-light mb-2">{title}</p><div className="space-y-3">{children}</div></div>
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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-orange" />
      {label}
    </label>
  )
}
function LineaResumen({ label, valor, bold, size }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-ink-mid ${bold ? 'font-medium text-ink' : ''}`}>{label}</span>
      <span className={`${bold ? 'font-medium text-ink' : 'text-ink-mid'} ${size === 'lg' ? 'text-lg font-display' : ''}`}>{valor}</span>
    </div>
  )
}
