import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, UserPlus, X } from 'lucide-react'

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
  const [formInvitar, setFormInvitar] = useState(null)
  const [invitando, setInvitando] = useState(false)
  const [errorInvitar, setErrorInvitar] = useState(null)

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

  /** Llama a la Edge Function "invitar-usuario" — el email de
   * invitación real de Supabase, y de una le asigna el rol elegido.
   * No usa ninguna clave sensible acá: el navegador solo manda el
   * token de la sesión ya logueada (la de quien está usando Usuarios),
   * la Edge Function del otro lado verifica que sea Superadmin. */
  async function enviarInvitacion() {
    setInvitando(true)
    setErrorInvitar(null)
    const { data: sesion } = await supabase.auth.getSession()
    const { data, error: err } = await supabase.functions.invoke('invitar-usuario', {
      body: {
        email: formInvitar.email,
        rol: formInvitar.rol,
        nombre: formInvitar.nombre || null,
        staff_id: formInvitar.rol === 'barista' ? (formInvitar.staff_id || null) : null,
      },
      headers: { Authorization: `Bearer ${sesion?.session?.access_token}` },
    })
    setInvitando(false)
    if (err || data?.error) {
      setErrorInvitar(data?.error || err.message)
      return
    }
    setFormInvitar(null)
    cargar()
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
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-wine" strokeWidth={1.75} />
          <h1 className="font-display text-2xl">Usuarios y roles</h1>
        </div>
        <button
          onClick={() => setFormInvitar({ email: '', rol: 'operacion', nombre: '', staff_id: '' })}
          className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors flex-shrink-0"
        >
          <UserPlus size={15} /> Invitar usuario
        </button>
      </div>
      <p className="text-sm text-ink-mid mb-6">
        Invitá gente nueva directo desde acá, o ajustá el rol de quien ya tiene acceso.
      </p>

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

      {formInvitar && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={() => !invitando && setFormInvitar(null)}>
          <div className="bg-paper-card border border-rule rounded-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl">Invitar usuario</h2>
              <button onClick={() => setFormInvitar(null)} className="text-ink-light hover:text-ink"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-ink-mid mb-1">Email *</label>
                <input
                  type="email" className="input" placeholder="persona@ejemplo.com"
                  value={formInvitar.email}
                  onChange={(e) => setFormInvitar((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-ink-mid mb-1">Nombre</label>
                <input
                  className="input" placeholder="Opcional — para identificarlo en la lista"
                  value={formInvitar.nombre}
                  onChange={(e) => setFormInvitar((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-ink-mid mb-1">Rol</label>
                <select
                  className="input"
                  value={formInvitar.rol}
                  onChange={(e) => setFormInvitar((f) => ({ ...f, rol: e.target.value }))}
                >
                  <option value="superadmin">Superadmin</option>
                  <option value="operacion">Operación</option>
                  <option value="barista">Barista</option>
                  <option value="logistica">Logística</option>
                </select>
              </div>
              {formInvitar.rol === 'barista' && (
                <div>
                  <label className="block text-xs text-ink-mid mb-1">Vincular a qué barista</label>
                  <select
                    className="input"
                    value={formInvitar.staff_id}
                    onChange={(e) => setFormInvitar((f) => ({ ...f, staff_id: e.target.value }))}
                  >
                    <option value="">Sin vincular (lo hacés después)</option>
                    {staffDisponible.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>

            {errorInvitar && (
              <p className="text-xs text-coral bg-coral-light rounded p-2 mt-4">{errorInvitar}</p>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={enviarInvitacion}
                disabled={!formInvitar.email || invitando}
                className="flex-1 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50"
              >
                {invitando ? 'Enviando…' : 'Enviar invitación'}
              </button>
              <button onClick={() => setFormInvitar(null)} className="border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
