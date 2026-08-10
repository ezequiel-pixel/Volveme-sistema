import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X } from 'lucide-react'

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
      .select('id, nombre, fecha, hora_inicio, lugar, estado, cantidad_personas, clientes(nombre)')
      .order('fecha', { ascending: true })

    if (!error) setEventos(data)
    setLoading(false)
  }

  useEffect(() => {
    cargarEventos()
  }, [])

  const eventosFiltrados =
    filtro === 'todos' ? eventos : eventos.filter((e) => e.estado === filtro)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Eventos</p>
          <h1 className="font-display text-2xl">Agenda</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors"
        >
          <Plus size={15} /> Nuevo evento
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {['todos', 'lead', 'cotizado', 'confirmado', 'realizado', 'cancelado'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`text-xs uppercase tracking-wide px-3 py-1.5 rounded-full border transition-colors ${
              filtro === f
                ? 'border-ink bg-wine text-paper'
                : 'border-rule text-ink-light hover:text-ink'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-ink-light">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Evento</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Lugar</th>
              <th className="px-4 py-3 font-medium">Pax</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-light">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && eventosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-light">
                  No hay eventos {filtro !== 'todos' ? `en estado "${filtro}"` : 'cargados todavía'}.
                </td>
              </tr>
            )}
            {eventosFiltrados.map((ev) => (
              <tr key={ev.id} className="border-b border-rule last:border-0 hover:bg-paper-warm/40">
                <td className="px-4 py-3">
                  {new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                  {ev.hora_inicio && <span className="text-ink-light ml-1.5">{ev.hora_inicio.slice(0, 5)}</span>}
                </td>
                <td className="px-4 py-3 font-medium text-ink">{ev.nombre}</td>
                <td className="px-4 py-3 text-ink-mid">{ev.clientes?.nombre || '—'}</td>
                <td className="px-4 py-3 text-ink-mid">{ev.lugar || '—'}</td>
                <td className="px-4 py-3 text-ink-mid">{ev.cantidad_personas || '—'}</td>
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
          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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
