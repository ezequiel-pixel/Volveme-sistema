import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, FileText } from 'lucide-react'

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Cotizaciones</p>
          <h1 className="font-display text-2xl">Presupuestos</h1>
        </div>
        <Link
          to="/cotizaciones/nueva"
          className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors"
        >
          <Plus size={15} /> Nueva cotización
        </Link>
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
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/cotizaciones/${cot.id}/presupuesto`}
                      target="_blank"
                      className="flex items-center gap-1 text-xs text-ink-mid hover:text-wine"
                    >
                      <FileText size={13} /> PDF
                    </Link>
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
