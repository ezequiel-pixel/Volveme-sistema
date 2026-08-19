import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, FileText, Eye } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const estadoStyles = {
  enviada: 'bg-peach text-orange',
  negociacion: 'bg-blue-light text-blue-dark',
  aceptada: 'bg-wine text-paper',
  cancelada: 'bg-coral-light text-coral',
  recotizada: 'bg-paper-warm text-ink-light',
}

const estadoLabel = {
  enviada: 'Enviada',
  negociacion: 'En negociación',
  aceptada: 'Aceptada',
  cancelada: 'Cancelada',
  recotizada: 'Re-cotizada',
}

export default function Cotizaciones() {
  const navigate = useNavigate()
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')

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

      const { data: diasCot } = await supabase
        .from('cotizacion_dias')
        .select('fecha, hora_inicio, hora_fin, orden')
        .eq('cotizacion_id', cotizacion.id)
        .order('orden')

      if (diasCot && diasCot.length) {
        await supabase.from('evento_dias').insert(
          diasCot.map((d) => ({
            evento_id: nuevoEvento.id,
            fecha: d.fecha,
            hora_inicio: d.hora_inicio,
            hora_fin: d.hora_fin,
            orden: d.orden,
          }))
        )
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

  async function recotizar(cotizacion) {
    await supabase.from('cotizaciones').update({ estado: 'recotizada' }).eq('id', cotizacion.id)
    navigate(`/cotizaciones/nueva?desde=${cotizacion.id}`)
  }

  // "Todos" ahora significa "todas las activas" — las re-cotizadas
  // (versiones viejas, reemplazadas por una nueva) quedan afuera del
  // vistazo general. Si necesitás verlas igual, están en su propia
  // pestaña "Re-cotizada".
  const cotizacionesFiltradas =
    filtro === 'todos'
      ? cotizaciones.filter((c) => c.estado !== 'recotizada')
      : cotizaciones.filter((c) => c.estado === filtro)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Cotizaciones</p>
          <h1 className="font-display text-2xl">Presupuestos</h1>
        </div>
        <Link
          to="/cotizaciones/nueva"
          className="flex items-center justify-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors flex-shrink-0"
        >
          <Plus size={15} /> Nueva cotización
        </Link>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {['todos', 'enviada', 'negociacion', 'aceptada', 'cancelada', 'recotizada'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`flex-shrink-0 whitespace-nowrap text-xs uppercase tracking-wide px-3 py-1.5 rounded-full border transition-colors ${
              filtro === f ? 'border-wine bg-wine text-paper' : 'border-rule text-ink-light hover:text-ink'
            }`}
          >
            {f === 'todos' ? 'Todos' : estadoLabel[f]}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>}

      {!loading && cotizacionesFiltradas.length === 0 && (
        <p className="text-sm text-ink-light py-8 text-center border border-rule rounded-lg bg-paper-card">
          No hay cotizaciones {filtro !== 'todos' ? `en estado "${estadoLabel[filtro]}"` : 'cargadas todavía'}.
        </p>
      )}

      {!loading && cotizacionesFiltradas.length > 0 && (
        <>
          {/* ===== Mobile: tarjetas apiladas ===== */}
          <div className="sm:hidden space-y-3">
            {cotizacionesFiltradas.map((cot) => (
              <div key={cot.id} className="border border-rule rounded-lg bg-paper-card p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-medium text-ink">{cot.clientes?.nombre || '—'}</p>
                    <p className="text-xs text-ink-light">
                      {cot.fecha_evento
                        ? new Date(cot.fecha_evento + 'T00:00:00').toLocaleDateString('es-AR')
                        : '—'}
                      {cot.cantidad_pax ? ` · ${cot.cantidad_pax} pax` : ''}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full ${estadoStyles[cot.estado]}`}>
                    {estadoLabel[cot.estado]}
                  </span>
                </div>
                <p className="text-lg font-bold text-wine mb-3">{money(cot.precio_final)}</p>
                <AccionesCotizacion
                  cot={cot}
                  cambiarEstado={cambiarEstado}
                  recotizar={recotizar}
                />
              </div>
            ))}
          </div>

          {/* ===== Desktop: tabla ===== */}
          <div className="hidden sm:block border border-rule rounded-lg overflow-hidden bg-paper-card">
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
                {cotizacionesFiltradas.map((cot) => (
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
                        {estadoLabel[cot.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AccionesCotizacion
                        cot={cot}
                        cambiarEstado={cambiarEstado}
                        recotizar={recotizar}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/** Botones de acción por cotización — se usan tanto en la tarjeta mobile
 * como en la fila de la tabla desktop, para no repetir la lógica dos veces. */
function AccionesCotizacion({ cot, cambiarEstado, recotizar }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Link
        to={`/cotizaciones/${cot.id}`}
        className="flex items-center gap-1 text-xs text-ink-mid hover:text-wine"
      >
        <Eye size={13} /> Detalle
      </Link>
      <Link
        to={`/cotizaciones/${cot.id}/presupuesto`}
        target="_blank"
        className="flex items-center gap-1 text-xs text-ink-mid hover:text-wine"
      >
        <FileText size={13} /> PDF
      </Link>

      {cot.estado === 'enviada' && (
        <>
          <button onClick={() => cambiarEstado(cot, 'negociacion')} className="text-xs text-blue-dark hover:underline">
            Pasar a negociación
          </button>
          <button onClick={() => cambiarEstado(cot, 'aceptada')} className="text-xs text-wine font-medium hover:underline">
            Aceptar → crea evento
          </button>
          <button onClick={() => recotizar(cot)} className="text-xs text-blue-dark hover:underline">
            Re-cotizar
          </button>
          <button onClick={() => cambiarEstado(cot, 'cancelada')} className="text-xs text-coral hover:underline">
            Cancelar
          </button>
        </>
      )}

      {cot.estado === 'negociacion' && (
        <>
          <button onClick={() => cambiarEstado(cot, 'aceptada')} className="text-xs text-wine font-medium hover:underline">
            Aceptar → crea evento
          </button>
          <button onClick={() => recotizar(cot)} className="text-xs text-blue-dark hover:underline">
            Re-cotizar
          </button>
          <button onClick={() => cambiarEstado(cot, 'cancelada')} className="text-xs text-coral hover:underline">
            Cancelar
          </button>
        </>
      )}

      {cot.estado === 'aceptada' && (
        <>
          <span className="text-xs text-ink-light">Evento creado ✓</span>
          <button onClick={() => recotizar(cot)} className="text-xs text-blue-dark hover:underline">
            Re-cotizar
          </button>
        </>
      )}
      {cot.estado === 'cancelada' && (
        <button onClick={() => recotizar(cot)} className="text-xs text-blue-dark hover:underline">
          Re-cotizar
        </button>
      )}
      {cot.estado === 'recotizada' && <span className="text-xs text-ink-light">Reemplazada</span>}
    </div>
  )
}
