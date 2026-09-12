import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { CalendarDays, MapPin, Users, ClipboardList, LogOut } from 'lucide-react'

function formatFechaLarga(fechaStr) {
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const d = new Date(fechaStr + 'T00:00:00')
  return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
}

export default function MisEventos() {
  const { perfil } = useAuth()
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function cargar() {
      if (!perfil?.staff_id) { setLoading(false); return }
      setLoading(true)
      setError(null)

      const { data: asignaciones, error: err } = await supabase
        .from('evento_staff')
        .select('estado, eventos(id, nombre, fecha, lugar, cantidad_personas, estado, clientes(nombre))')
        .eq('staff_id', perfil.staff_id)
        .not('estado', 'eq', 'rechazado')

      if (err) { setError(err.message); setLoading(false); return }

      const proximos = (asignaciones || [])
        .map((a) => ({ ...a.eventos, miEstado: a.estado }))
        .filter((ev) => ev && ['confirmado', 'realizado'].includes(ev.estado))
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

      setEventos(proximos)
      setLoading(false)
    }
    cargar()
  }, [perfil?.staff_id])

  if (loading) return <p className="text-sm text-ink-light py-12 text-center">Cargando…</p>

  if (error) {
    return (
      <div className="border border-coral rounded-lg p-5 bg-coral-light max-w-xl mx-auto mt-8">
        <p className="text-sm font-medium text-coral mb-2">No se pudieron cargar tus eventos</p>
        <p className="text-xs font-mono bg-paper border border-rule rounded p-2 overflow-x-auto">{error}</p>
      </div>
    )
  }

  if (!perfil?.staff_id) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <p className="text-sm text-ink-mid">
          Tu usuario todavía no está vinculado a ningún barista. Pedile al dueño que te asigne desde la pantalla de Usuarios.
        </p>
        <button onClick={() => supabase.auth.signOut()} className="mt-6 text-xs text-ink-light hover:text-coral flex items-center gap-1.5 mx-auto">
          <LogOut size={13} /> Salir
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Volveme</p>
          <h1 className="font-display text-2xl text-ink">Mis eventos</h1>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-ink-light hover:text-coral">
          <LogOut size={18} strokeWidth={1.75} />
        </button>
      </div>

      {eventos.length === 0 ? (
        <p className="text-sm text-ink-light text-center py-12 border border-rule rounded-xl">No tenés eventos asignados todavía.</p>
      ) : (
        <div className="space-y-3">
          {eventos.map((ev) => (
            <Link
              key={ev.id}
              to={`/eventos/${ev.id}/ficha`}
              className="block rounded-xl border border-rule bg-paper-card p-5 hover:border-wine/30 hover:shadow-soft transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-display text-lg text-ink">{ev.clientes?.nombre || ev.nombre}</p>
                {ev.miEstado === 'confirmado' && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-light text-teal-dark">Confirmado</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 text-sm text-ink-mid">
                <span className="flex items-center gap-1.5"><CalendarDays size={14} /> {formatFechaLarga(ev.fecha)}</span>
                {ev.lugar && <span className="flex items-center gap-1.5"><MapPin size={14} /> {ev.lugar}</span>}
                {ev.cantidad_personas && <span className="flex items-center gap-1.5"><Users size={14} /> {ev.cantidad_personas} invitados</span>}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-wine mt-3">
                <ClipboardList size={13} /> Ver ficha del evento
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
