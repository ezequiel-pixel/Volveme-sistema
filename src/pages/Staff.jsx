import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { armarLinkWhatsapp } from '../lib/generarPdf'
import { Plus, Pencil, Trash2, MessageCircle, X, Search } from 'lucide-react'

const TIPO_LABEL = {
  barista: 'Barista',
  logistica: 'Logística',
  proveedor: 'Proveedor',
  otro: 'Otro',
}

const TIPO_STYLES = {
  barista: 'bg-wine text-paper',
  logistica: 'bg-blue-light text-blue-dark',
  proveedor: 'bg-peach text-orange',
  otro: 'bg-paper-warm text-ink-light',
}

const VACIO = {
  id: null,
  nombre: '',
  telefono: '',
  email: '',
  tipo: 'barista',
  nivel: '',
  categoria_proveedor: '',
  notas: '',
  activo: true,
}

export default function Staff() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [form, setForm] = useState(null) // null = modal cerrado

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('staff').select('*').order('nombre')
    setStaff(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function guardar() {
    const payload = {
      nombre: form.nombre,
      telefono: form.telefono || null,
      email: form.email || null,
      tipo: form.tipo,
      nivel: form.nivel || null,
      categoria_proveedor: form.tipo === 'proveedor' ? (form.categoria_proveedor || null) : null,
      notas: form.notas || null,
      activo: form.activo,
    }
    if (form.id) {
      await supabase.from('staff').update(payload).eq('id', form.id)
    } else {
      await supabase.from('staff').insert(payload)
    }
    setForm(null)
    cargar()
  }

  async function eliminar(persona) {
    if (!confirm(`¿Eliminar a ${persona.nombre}? Si tiene eventos asignados, mejor desactivarlo en vez de eliminarlo.`)) return
    await supabase.from('staff').delete().eq('id', persona.id)
    cargar()
  }

  async function toggleActivo(persona) {
    await supabase.from('staff').update({ activo: !persona.activo }).eq('id', persona.id)
    cargar()
  }

  const filtrado = staff.filter((p) => {
    if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false
    if (!mostrarInactivos && !p.activo) return false
    if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Staff</p>
          <h1 className="font-display text-2xl">Equipo y proveedores</h1>
        </div>
        <button
          onClick={() => setForm({ ...VACIO })}
          className="flex items-center justify-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors flex-shrink-0"
        >
          <Plus size={15} /> Agregar persona
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-2 overflow-x-auto pb-1 flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['todos', 'barista', 'logistica', 'proveedor', 'otro'].map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`flex-shrink-0 whitespace-nowrap text-xs uppercase tracking-wide px-3 py-1.5 rounded-full border transition-colors ${
                filtroTipo === t ? 'border-wine bg-wine text-paper' : 'border-rule text-ink-light hover:text-ink'
              }`}
            >
              {t === 'todos' ? 'Todos' : TIPO_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="relative flex-shrink-0 w-full sm:w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="input pl-8 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-mid flex-shrink-0 whitespace-nowrap">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
          Ver inactivos
        </label>
      </div>

      {loading && <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>}

      {!loading && filtrado.length === 0 && (
        <p className="text-sm text-ink-light py-8 text-center border border-rule rounded-lg bg-paper-card">
          No hay nadie que coincida con este filtro.
        </p>
      )}

      {!loading && filtrado.length > 0 && (
        <div className="space-y-2">
          {filtrado.map((persona) => (
            <div
              key={persona.id}
              className={`border border-rule rounded-lg bg-paper-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${!persona.activo ? 'opacity-50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-medium text-ink">{persona.nombre}</p>
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${TIPO_STYLES[persona.tipo]}`}>
                    {TIPO_LABEL[persona.tipo]}
                  </span>
                  {persona.nivel && <span className="text-[10px] text-ink-light border border-rule rounded-full px-2 py-0.5">{persona.nivel}</span>}
                  {persona.categoria_proveedor && <span className="text-[10px] text-ink-light border border-rule rounded-full px-2 py-0.5">{persona.categoria_proveedor}</span>}
                  {!persona.activo && <span className="text-[10px] text-coral">Inactivo</span>}
                </div>
                <p className="text-xs text-ink-light">
                  {persona.telefono || 'Sin teléfono'}{persona.email ? ` · ${persona.email}` : ''}
                </p>
                {persona.notas && <p className="text-xs text-ink-mid mt-1">{persona.notas}</p>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {persona.telefono && (
                  <a
                    href={armarLinkWhatsapp(persona.telefono, `¡Hola ${persona.nombre.split(' ')[0]}!`)}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-ink-mid hover:text-wine"
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
                <button onClick={() => setForm({ ...VACIO, ...persona })} className="text-ink-light hover:text-ink">
                  <Pencil size={14} />
                </button>
                <button onClick={() => toggleActivo(persona)} className="text-xs text-ink-light hover:text-ink">
                  {persona.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => eliminar(persona)} className="text-ink-light hover:text-coral">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && <FormModal form={form} setForm={setForm} onGuardar={guardar} onCerrar={() => setForm(null)} />}
    </div>
  )
}

function FormModal({ form, setForm, onGuardar, onCerrar }) {
  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div className="bg-paper rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">{form.id ? 'Editar' : 'Agregar'} persona</h2>
          <button onClick={onCerrar} className="text-ink-light hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-ink-mid mb-1">Nombre *</label>
            <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Teléfono</label>
              <input className="input" placeholder="11 5555-5555" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Email</label>
              <input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-ink-mid mb-1">Tipo</label>
            <select className="input" value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              <option value="barista">Barista</option>
              <option value="logistica">Logística</option>
              <option value="proveedor">Proveedor</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {form.tipo === 'barista' && (
            <div>
              <label className="block text-xs text-ink-mid mb-1">Nivel</label>
              <input className="input" placeholder="Senior, Junior…" value={form.nivel} onChange={(e) => set('nivel', e.target.value)} />
            </div>
          )}

          {form.tipo === 'proveedor' && (
            <div>
              <label className="block text-xs text-ink-mid mb-1">Categoría del proveedor</label>
              <input className="input" placeholder="Flete, Pastelería, Sonido…" value={form.categoria_proveedor} onChange={(e) => set('categoria_proveedor', e.target.value)} />
            </div>
          )}

          <div>
            <label className="block text-xs text-ink-mid mb-1">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-mid">
            <input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} />
            Activo
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onGuardar}
            disabled={!form.nombre}
            className="flex-1 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50"
          >
            Guardar
          </button>
          <button onClick={onCerrar} className="border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
