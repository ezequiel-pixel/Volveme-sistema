import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { armarLinkWhatsapp } from '../lib/generarPdf'
import { Plus, Pencil, Trash2, MessageCircle, X, Search, Copy, Check } from 'lucide-react'

const TIPO_LABEL = {
  barista: 'Barista',
  logistica: 'Logística',
  proveedor: 'Proveedor',
  otro: 'Otro',
}

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const VACIO = {
  id: null,
  nombre: '',
  telefono: '',
  email: '',
  tipo: 'barista',
  nivel: '',
  categoria_proveedor: '',
  alias_mercado_pago: '',
  tarifa_hora: '',
  notas: '',
  activo: true,
}

export default function Staff() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [form, setForm] = useState(null)

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
      alias_mercado_pago: form.alias_mercado_pago || null,
      tarifa_hora: form.tarifa_hora ? Number(form.tarifa_hora) : null,
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

      {/* Filtros — simples, sin adorno */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1 overflow-x-auto flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['todos', 'barista', 'logistica', 'proveedor', 'otro'].map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`flex-shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded border transition-colors ${
                filtroTipo === t ? 'border-ink bg-ink text-paper' : 'border-rule text-ink-mid hover:border-ink hover:text-ink'
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
        <label className="flex items-center gap-2 text-xs text-ink-mid flex-shrink-0 whitespace-nowrap px-1">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
          Ver inactivos
        </label>
      </div>

      <p className="text-xs text-ink-light mb-3">{filtrado.length} persona{filtrado.length !== 1 ? 's' : ''}</p>

      {loading && <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>}

      {!loading && filtrado.length === 0 && (
        <p className="text-sm text-ink-light py-10 text-center border border-rule rounded-lg">
          No hay nadie que coincida con este filtro.
        </p>
      )}

      {!loading && filtrado.length > 0 && (
        <>
          {/* ===== Desktop: tabla, columnas alineadas, estilo lista de Mac ===== */}
          <div className="hidden md:block border border-rule rounded-lg overflow-hidden bg-paper-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
                  <th className="px-4 py-2.5 font-medium">Nombre</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Teléfono</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Alias MP</th>
                  <th className="px-4 py-2.5 font-medium text-right">Tarifa/hora</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map((p) => (
                  <FilaStaff
                    key={p.id}
                    persona={p}
                    onEditar={() => setForm({ ...VACIO, ...p })}
                    onToggleActivo={() => toggleActivo(p)}
                    onEliminar={() => eliminar(p)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* ===== Mobile: filas apiladas, mismos datos, sin tabla ===== */}
          <div className="md:hidden space-y-2">
            {filtrado.map((p) => (
              <FilaStaffMobile
                key={p.id}
                persona={p}
                onEditar={() => setForm({ ...VACIO, ...p })}
                onToggleActivo={() => toggleActivo(p)}
                onEliminar={() => eliminar(p)}
              />
            ))}
          </div>
        </>
      )}

      {form && <FormModal form={form} setForm={setForm} onGuardar={guardar} onCerrar={() => setForm(null)} />}
    </div>
  )
}

function BotonCopiar({ valor }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1200)
    } catch {}
  }
  return (
    <button onClick={copiar} className="text-ink-light hover:text-ink flex-shrink-0" title="Copiar">
      {copiado ? <Check size={12} className="text-wine" /> : <Copy size={12} />}
    </button>
  )
}

function FilaStaff({ persona: p, onEditar, onToggleActivo, onEliminar }) {
  return (
    <tr className={`border-b border-rule last:border-0 hover:bg-paper/60 ${!p.activo ? 'opacity-40' : ''}`}>
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{p.nombre}</p>
        {p.nivel && <p className="text-xs text-ink-light">{p.nivel}</p>}
      </td>
      <td className="px-4 py-3 text-ink-mid">
        {TIPO_LABEL[p.tipo]}
        {p.categoria_proveedor && <span className="text-ink-light"> · {p.categoria_proveedor}</span>}
      </td>
      <td className="px-4 py-3">
        {p.telefono ? (
          <a href={`tel:${p.telefono}`} className="text-ink-mid hover:text-wine hover:underline">{p.telefono}</a>
        ) : <span className="text-ink-light">—</span>}
      </td>
      <td className="px-4 py-3">
        {p.email ? (
          <a href={`mailto:${p.email}`} className="text-ink-mid hover:text-wine hover:underline">{p.email}</a>
        ) : <span className="text-ink-light">—</span>}
      </td>
      <td className="px-4 py-3">
        {p.alias_mercado_pago ? (
          <span className="flex items-center gap-1.5 text-ink-mid">
            {p.alias_mercado_pago}
            <BotonCopiar valor={p.alias_mercado_pago} />
          </span>
        ) : <span className="text-ink-light">—</span>}
      </td>
      <td className="px-4 py-3 text-right text-ink-mid">
        {p.tarifa_hora ? money(p.tarifa_hora) : <span className="text-ink-light">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          {p.telefono && (
            <a
              href={armarLinkWhatsapp(p.telefono, `¡Hola ${p.nombre.split(' ')[0]}!`)}
              target="_blank" rel="noreferrer"
              className="text-ink-light hover:text-wine" title="WhatsApp"
            >
              <MessageCircle size={15} />
            </a>
          )}
          <button onClick={onEditar} className="text-ink-light hover:text-ink" title="Editar">
            <Pencil size={14} />
          </button>
          <button onClick={onToggleActivo} className="text-[11px] text-ink-light hover:text-ink whitespace-nowrap">
            {p.activo ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={onEliminar} className="text-ink-light hover:text-coral" title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function FilaStaffMobile({ persona: p, onEditar, onToggleActivo, onEliminar }) {
  return (
    <div className={`border border-rule rounded-lg p-4 bg-paper-card ${!p.activo ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-medium text-ink">{p.nombre}</p>
          <p className="text-xs text-ink-light">{TIPO_LABEL[p.tipo]}{p.nivel ? ` · ${p.nivel}` : ''}</p>
        </div>
        {p.telefono && (
          <a
            href={armarLinkWhatsapp(p.telefono, `¡Hola ${p.nombre.split(' ')[0]}!`)}
            target="_blank" rel="noreferrer"
            className="flex-shrink-0 text-wine"
          >
            <MessageCircle size={18} />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-y-2 text-sm mb-2">
        <a href={p.telefono ? `tel:${p.telefono}` : undefined} className="text-ink-mid">{p.telefono || '—'}</a>
        <span className="text-ink-mid text-right">{p.tarifa_hora ? money(p.tarifa_hora) : '—'}</span>
        <a href={p.email ? `mailto:${p.email}` : undefined} className="text-ink-mid truncate">{p.email || '—'}</a>
        <span className="text-ink-mid text-right flex items-center justify-end gap-1.5">
          {p.alias_mercado_pago || '—'}
          {p.alias_mercado_pago && <BotonCopiar valor={p.alias_mercado_pago} />}
        </span>
      </div>

      <div className="flex items-center gap-4 pt-2 border-t border-rule">
        <button onClick={onEditar} className="text-xs text-ink-mid hover:text-ink">Editar</button>
        <button onClick={onToggleActivo} className="text-xs text-ink-mid hover:text-ink">{p.activo ? 'Desactivar' : 'Activar'}</button>
        <button onClick={onEliminar} className="text-xs text-ink-mid hover:text-coral">Eliminar</button>
      </div>
    </div>
  )
}

function FormModal({ form, setForm, onGuardar, onCerrar }) {
  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div className="bg-paper-card border border-rule rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Alias Mercado Pago</label>
              <input className="input" placeholder="alias.mp" value={form.alias_mercado_pago} onChange={(e) => set('alias_mercado_pago', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Tarifa por hora</label>
              <input className="input" type="number" min="0" placeholder="8000" value={form.tarifa_hora} onChange={(e) => set('tarifa_hora', e.target.value)} />
            </div>
          </div>

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
