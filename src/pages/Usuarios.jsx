import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, AlertTriangle } from 'lucide-react'

const ROL_LABEL = {
  superadmin: 'Superadmin',
  operacion: 'Operación',
  barista: 'Barista',
  logistica: 'Logística',
}
const ROL_COLOR = {
  superadmin: 'bg-wine text-paper',
  operacion: 'bg-blue-light text-blue-dark',
  barista: 'bg-peach text-orange',
  logistica: 'bg-paper-warm text-ink-mid',
}

export default function Usuarios() {
  const [perfiles, setPerfiles] = useState([])
  const [staffDisponible, setStaffDisponible] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    const [{ data: p, error: err }, { data: s }] = await Promise.all([
      supabase.from('perfiles').select('*').order('creado_en'),
      supabase.from('staff').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    if (err) { setError(err.message); setLoading(false); return }
    setPerfiles(p || [])
    setStaffDisponible(s || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function actualizarRol(perfil, nuevoRol) {
    setPerfiles((prev) => prev.map((x) => (x.id === perfil.id ? { ...x, rol: nuevoRol } : x)))
    const payload = { rol: nuevoRol }
    if (nuevoRol !== 'barista') payload.staff_id = null // si deja de ser barista, se destrabá el vínculo
    const { error: err } = await supabase.from('perfiles').update(payload).eq('id', perfil.id)
    if (err) { alert('No se pudo cambiar el rol: ' + err.message); cargar(); return }
    if (nuevoRol !== 'barista') cargar()
  }

  async function actualizarStaffVinculado(perfil, staffId) {
    setPerfiles((prev) => prev.map((x) => (x.id === perfil.id ? { ...x, staff_id: staffId || null } : x)))
    const { error: err } = await supabase.from('perfiles').update({ staff_id: staffId || null }).eq('id', perfil.id)
    if (err) alert('No se pudo vincular: ' + err.message)
  }

  if (loading) return <p className="text-sm text-ink-light py-12 text-center">Cargando…</p>

  if (error) {
    return (
      <div className="border border-coral rounded-lg p-5 bg-coral-light max-w-xl">
        <p className="text-sm font-medium text-coral mb-2">No se pudo cargar Usuarios</p>
        <p className="text-xs font-mono bg-paper border border-rule rounded p-2 overflow-x-auto">{error}</p>
        <p className="text-xs text-ink-mid mt-2">Esto casi siempre significa que el SQL de roles todavía no se corrió en Supabase.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Shield size={20} className="text-wine" strokeWidth={1.75} />
        <h1 className="font-display text-2xl">Usuarios y roles</h1>
      </div>
      <p className="text-sm text-ink-mid mb-6">
        Cada fila es alguien que ya tiene acceso al sistema (invitado desde Supabase). Acá se define qué puede ver cada uno — no se crean cuentas nuevas desde esta pantalla.
      </p>

      <div className="flex items-start gap-2 text-xs text-ink-mid bg-peach/40 rounded-lg px-4 py-3 mb-6">
        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
        Para invitar a alguien nuevo (un barista, alguien de Logística), primero hay que crearle el acceso desde el dashboard de Supabase (Authentication → Invite user) — recién ahí aparece acá para asignarle el rol.
      </div>

      <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
              <th className="px-4 py-2.5 font-medium">Nombre</th>
              <th className="px-4 py-2.5 font-medium">Rol</th>
              <th className="px-4 py-2.5 font-medium">Barista vinculado</th>
            </tr>
          </thead>
          <tbody>
            {perfiles.map((p) => (
              <tr key={p.id} className="border-b border-rule last:border-0">
                <td className="px-4 py-3 text-ink">{p.nombre || '(sin nombre)'}</td>
                <td className="px-4 py-3">
                  <select
                    value={p.rol}
                    onChange={(e) => actualizarRol(p, e.target.value)}
                    className={`text-xs rounded-full px-3 py-1 border-0 font-medium ${ROL_COLOR[p.rol]}`}
                  >
                    <option value="superadmin">Superadmin</option>
                    <option value="operacion">Operación</option>
                    <option value="barista">Barista</option>
                    <option value="logistica">Logística</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  {p.rol === 'barista' ? (
                    <select
                      value={p.staff_id || ''}
                      onChange={(e) => actualizarStaffVinculado(p, e.target.value)}
                      className="input text-xs py-1"
                    >
                      <option value="">Sin vincular</option>
                      {staffDisponible.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  ) : (
                    <span className="text-ink-light text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
