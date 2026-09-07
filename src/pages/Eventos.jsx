import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X } from 'lucide-react'

const money = (n) =>
  n == null ? '—' : n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const CONFIRMADOS = ['confirmado', 'realizado']

const estadoStyles = {
  lead: 'bg-paper-warm text-ink-mid',
  cotizado: 'bg-peach text-orange',
  confirmado: 'bg-blue-light text-blue-dark',
  realizado: 'bg-wine text-paper',
  cancelado: 'bg-coral-light text-coral',
}

export default function Eventos() {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filtro, setFiltro] = useState('todos')

  async function cargarEventos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('eventos')
      .select('id, nombre, fecha, hora_inicio, lugar, estado, cantidad_personas, cotizacion_id, forma_pago, precio_original, clientes(nombre), evento_dias(id)')
      .order('fecha', { ascending: true })

    if (!error && data) {
      // Precio total real (original + ajustes) desde la vista — así el
      // listado muestra lo que efectivamente se cobra hoy, no el precio
      // viejo si el evento se editó después de confirmarse.
      const ids = data.map((e) => e.id)
      const { data: precios } = ids.length
        ? await supabase.from('vw_evento_precio_total').select('evento_id, precio_total_actual').in('evento_id', ids)
        : { data: [] }
      const precioPorId = Object.fromEntries((precios || []).map((p) => [p.evento_id, p.precio_total_actual]))

      // Respaldo: eventos sin precio_original cargado (viejos, de antes
      // de que empezáramos a guardarlo) van a buscarlo directo a la
      // cotización aceptada — así no dependen de que alguien haya
      // entrado a esa ficha puntual para que se complete solo.
      const idsCotizacionSinPrecio = data
        .filter((e) => precioPorId[e.id] == null && e.cotizacion_id)
        .map((e) => e.cotizacion_id)
      const { data: cotizacionesRespaldo } = idsCotizacionSinPrecio.length
        ? await supabase.from('cotizaciones').select('id, precio_final').in('id', idsCotizacionSinPrecio)
        : { data: [] }
      const precioCotizacionPorId = Object.fromEntries((cotizacionesRespaldo || []).map((c) => [c.id, c.precio_final]))
      setEventos(data.map((e) => ({
        ...e,
        precio_total_actual: precioPorId[e.id] ?? e.precio_original ?? (e.cotizacion_id ? precioCotizacionPorId[e.cotizacion_id] : null),
      })))
    }
    setLoading(false)
  }

  useEffect(() => {
    cargarEventos()
  }, [])

  const eventosFiltrados =
    filtro === 'todos' ? eventos : eventos.filter((e) => e.estado === filtro)

  // Próximos primero (los que todavía no pasaron), pasados/cancelados
  // después — así lo importante está siempre arriba, sin tener que
  // scrollear entre eventos viejos para encontrar el de mañana.
  const hoy = new Date().toISOString().slice(0, 10)
  const esProximo = (ev) => ev.estado !== 'realizado' && ev.estado !== 'cancelado' && ev.fecha >= hoy

  const proximos = eventosFiltrados.filter(esProximo).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const pasados = eventosFiltrados.filter((e) => !esProximo(e)).sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Eventos</p>
          <h1 className="font-display text-2xl">Agenda</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-1.5 border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors flex-shrink-0"
        >
          <Plus size={15} /> Excepción manual
        </button>
      </div>

      <p className="text-sm text-ink-light mb-5">
        Los eventos se crean solos cuando confirmás una cotización en <strong className="text-ink-mid">Cotizaciones</strong>.
        Usá "Excepción manual" solo si necesitás cargar algo sin pasar antes por una cotización.
      </p>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {['todos', 'lead', 'cotizado', 'confirmado', 'realizado', 'cancelado'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`flex-shrink-0 whitespace-nowrap text-xs uppercase tracking-wide px-3 py-1.5 rounded-full border transition-colors ${
              filtro === f
                ? 'border-ink bg-wine text-paper'
                : 'border-rule text-ink-light hover:text-ink'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>}

      {!loading && eventosFiltrados.length === 0 && (
        <p className="text-sm text-ink-light py-8 text-center border border-rule rounded-lg bg-paper-card">
          No hay eventos {filtro !== 'todos' ? `en estado "${filtro}"` : 'cargados todavía'}.
        </p>
      )}

      {!loading && proximos.length > 0 && (
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-ink-light mb-3">
            Próximos ({proximos.length})
          </p>
          <ListaEventos eventos={proximos} />
        </div>
      )}

      {!loading && pasados.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-3">
            Pasados / cancelados ({pasados.length})
          </p>
          <ListaEventos eventos={pasados} atenuado />
        </div>
      )}

      {showForm && (
        <NuevoEventoModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            cargarEventos()
          }}
        />
      )}
    </div>
  )
}

function ListaEventos({ eventos, atenuado }) {
  return (
    <>
      {/* ===== Mobile: tarjetas apiladas ===== */}
      <div className={`sm:hidden space-y-3 ${atenuado ? 'opacity-60' : ''}`}>
        {eventos.map((ev) => (
          <div
            key={ev.id}
            onClick={() => (window.location.href = `/eventos/${ev.id}`)}
            className="border border-rule rounded-lg bg-paper-card p-4 cursor-pointer hover:bg-paper-warm/40"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-medium text-ink">
                  {ev.nombre}
                  {!ev.cotizacion_id && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-light border border-rule rounded-full px-1.5 py-0.5">
                      Manual
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-light mt-0.5">
                  {new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                  })}
                  {ev.hora_inicio && ` · ${ev.hora_inicio.slice(0, 5)}`}
                  {ev.evento_dias?.length > 1 && ` · ${ev.evento_dias.length} días`}
                </p>
              </div>
              <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full ${estadoStyles[ev.estado]}`}>
                {ev.estado}
              </span>
            </div>
            <p className="text-sm text-ink-mid">{ev.clientes?.nombre || '—'}</p>
            <p className="text-xs text-ink-light mt-0.5">
              {ev.lugar || '—'}{ev.cantidad_personas ? ` · ${ev.cantidad_personas} pax` : ''}
            </p>
            {CONFIRMADOS.includes(ev.estado) && (
              <p className="text-xs text-ink-mid mt-1 flex items-center gap-2">
                <span className="font-medium text-wine">{money(ev.precio_total_actual)}</span>
                <span className="text-ink-light">sin IVA</span>
                {ev.forma_pago && <span className="text-ink-light">· {ev.forma_pago}</span>}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ===== Desktop: tabla ===== */}
      <div className={`hidden sm:block border border-rule rounded-lg overflow-hidden bg-paper-card ${atenuado ? 'opacity-60' : ''}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-ink-light">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Evento</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Lugar</th>
              <th className="px-4 py-3 font-medium">Pax</th>
              <th className="px-4 py-3 font-medium">Precio (sin IVA)</th>
              <th className="px-4 py-3 font-medium">Forma de pago</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((ev) => (
              <tr
                key={ev.id}
                onClick={() => (window.location.href = `/eventos/${ev.id}`)}
                className="border-b border-rule last:border-0 hover:bg-paper-warm/40 cursor-pointer"
              >
                <td className="px-4 py-3">
                  {new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                  {ev.hora_inicio && <span className="text-ink-light ml-1.5">{ev.hora_inicio.slice(0, 5)}</span>}
                  {ev.evento_dias?.length > 1 && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-blue-dark bg-blue-light rounded-full px-1.5 py-0.5">
                      {ev.evento_dias.length} días
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-ink">
                  {ev.nombre}
                  {!ev.cotizacion_id && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-light border border-rule rounded-full px-1.5 py-0.5">
                      Manual
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-mid">{ev.clientes?.nombre || '—'}</td>
                <td className="px-4 py-3 text-ink-mid">{ev.lugar || '—'}</td>
                <td className="px-4 py-3 text-ink-mid">{ev.cantidad_personas || '—'}</td>
                <td className="px-4 py-3 text-ink-mid">
                  {CONFIRMADOS.includes(ev.estado) ? <span className="font-medium text-wine">{money(ev.precio_total_actual)}</span> : '—'}
                </td>
                <td className="px-4 py-3 text-ink-mid">
                  {CONFIRMADOS.includes(ev.estado) ? (ev.forma_pago || '—') : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${estadoStyles[ev.estado]}`}>
                    {ev.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function NuevoEventoModal({ onClose, onCreated }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nombre_cliente: '',
    nombre_evento: '',
    fecha: '',
    hora_inicio: '',
    lugar: '',
    cantidad_personas: '',
    forma_pago: '',
    notas: '',
  })

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    // 1. Buscar o crear cliente por nombre
    let clienteId = null
    if (form.nombre_cliente.trim()) {
      const { data: existente } = await supabase
        .from('clientes')
        .select('id')
        .ilike('nombre', form.nombre_cliente.trim())
        .maybeSingle()

      if (existente) {
        clienteId = existente.id
      } else {
        const { data: nuevoCliente, error: errCliente } = await supabase
          .from('clientes')
          .insert({ nombre: form.nombre_cliente.trim() })
          .select('id')
          .single()
        if (errCliente) {
          setError('No se pudo crear el cliente.')
          setSaving(false)
          return
        }
        clienteId = nuevoCliente.id
      }
    }

    // 2. Crear el evento
    const { error: errEvento } = await supabase.from('eventos').insert({
      cliente_id: clienteId,
      nombre: form.nombre_evento || `Evento — ${form.nombre_cliente}`,
      fecha: form.fecha,
      hora_inicio: form.hora_inicio || null,
      lugar: form.lugar || null,
      cantidad_personas: form.cantidad_personas ? Number(form.cantidad_personas) : null,
      forma_pago: form.forma_pago || null,
      notas: form.notas || null,
      estado: 'lead',
    })

    setSaving(false)
    if (errEvento) {
      setError('No se pudo crear el evento.')
      return
    }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-wine/40 flex items-center justify-center p-4 z-50">
      <div className="bg-paper w-full max-w-lg rounded-lg border border-rule">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <h2 className="font-display text-lg">Nuevo evento</h2>
          <button onClick={onClose} className="text-ink-light hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Cliente" required>
              <input
                required
                value={form.nombre_cliente}
                onChange={(e) => update('nombre_cliente', e.target.value)}
                className="input"
                placeholder="Nombre del cliente"
              />
            </Field>
            <Field label="Nombre del evento">
              <input
                value={form.nombre_evento}
                onChange={(e) => update('nombre_evento', e.target.value)}
                className="input"
                placeholder="Ej: Casamiento, Corporativo YPF…"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Fecha" required>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => update('fecha', e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Hora de inicio">
              <input
                type="time"
                value={form.hora_inicio}
                onChange={(e) => update('hora_inicio', e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Lugar">
              <input
                value={form.lugar}
                onChange={(e) => update('lugar', e.target.value)}
                className="input"
                placeholder="Ej: Ciudadela, La Rural…"
              />
            </Field>
            <Field label="Cantidad de invitados">
              <input
                type="number"
                min="0"
                value={form.cantidad_personas}
                onChange={(e) => update('cantidad_personas', e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <Field label="Forma de pago">
            <input
              value={form.forma_pago}
              onChange={(e) => update('forma_pago', e.target.value)}
              className="input"
              placeholder="Transferencia, efectivo, MP…"
            />
          </Field>

          <Field label="Notas">
            <textarea
              value={form.notas}
              onChange={(e) => update('notas', e.target.value)}
              className="input min-h-[70px] resize-none"
            />
          </Field>

          {error && <p className="text-coral text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 text-ink-light hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Crear evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-ink-light mb-1.5">
        {label} {required && <span className="text-coral">*</span>}
      </span>
      {children}
    </label>
  )
}
