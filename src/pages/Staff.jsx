import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { armarLinkWhatsapp } from '../lib/generarPdf'
import { Plus, Pencil, Trash2, MessageCircle, Mail, X, Search, Wallet, Users, Copy, Check, Clock } from 'lucide-react'

const TIPO_LABEL = {
  barista: 'Barista',
  logistica: 'Logística',
  proveedor: 'Proveedor',
  otro: 'Otro',
}

// Cada tipo tiene un color de acento consistente — se usa en el avatar,
// el badge y el punto de la stat card, para que de un vistazo se
// identifique el tipo de persona sin tener que leer el texto.
const TIPO_ACCENT = {
  barista: { bg: 'bg-wine', text: 'text-wine', badge: 'bg-wine text-paper', dot: 'bg-wine' },
  logistica: { bg: 'bg-blue', text: 'text-blue-dark', badge: 'bg-blue-light text-blue-dark', dot: 'bg-blue' },
  proveedor: { bg: 'bg-orange', text: 'text-orange', badge: 'bg-peach text-orange', dot: 'bg-orange' },
  otro: { bg: 'bg-ink-light', text: 'text-ink-mid', badge: 'bg-paper text-ink-mid', dot: 'bg-ink-light' },
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

function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
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

  const activos = staff.filter((p) => p.activo)
  const stats = {
    total: activos.length,
    barista: activos.filter((p) => p.tipo === 'barista').length,
    logistica: activos.filter((p) => p.tipo === 'logistica').length,
    proveedor: activos.filter((p) => p.tipo === 'proveedor').length,
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
          className="flex items-center justify-center gap-1.5 bg-wine text-paper text-sm rounded-full px-4 py-2.5 shadow-soft hover:bg-wine-mid transition-colors flex-shrink-0"
        >
          <Plus size={15} /> Agregar persona
        </button>
      </div>

      {/* Stats — mismo lenguaje visual que el bloque "Invitados / Precio"
          del PDF: fondo peach, número grande en wine, ícono con su
          círculo de color detrás (como en "Café de especialidad"). */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Activos en total" valor={stats.total} icon={Users} iconColor="#3d2a2e" />
        <StatCard label="Baristas" valor={stats.barista} iconColor="#3d2a2e" />
        <StatCard label="Logística" valor={stats.logistica} iconColor="#3f6bff" />
        <StatCard label="Proveedores" valor={stats.proveedor} iconColor="#ff6a1a" />
      </div>

      {/* Filtros — control segmentado, no botones sueltos */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="inline-flex items-center gap-0.5 bg-peach/50 rounded-full p-1 overflow-x-auto flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['todos', 'barista', 'logistica', 'proveedor', 'otro'].map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`flex-shrink-0 whitespace-nowrap text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors ${
                filtroTipo === t ? 'bg-paper-card text-ink shadow-soft' : 'text-ink-mid hover:text-ink'
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
            className="input pl-8 text-sm !rounded-full"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-mid flex-shrink-0 whitespace-nowrap px-1">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
          Ver inactivos
        </label>
      </div>

      {loading && <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>}

      {!loading && filtrado.length === 0 && (
        <p className="text-sm text-ink-light py-10 text-center card">
          No hay nadie que coincida con este filtro.
        </p>
      )}

      {!loading && filtrado.length > 0 && (
        <div className="space-y-2.5">
          {filtrado.map((persona) => {
            const accent = TIPO_ACCENT[persona.tipo] || TIPO_ACCENT.otro
            return (
              <div
                key={persona.id}
                className={`card p-4 transition-shadow hover:shadow-soft-lg ${!persona.activo ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Avatar con iniciales — color según el tipo */}
                  <div className={`w-11 h-11 rounded-full ${accent.bg} text-paper flex items-center justify-center font-display text-sm flex-shrink-0`}>
                    {iniciales(persona.nombre)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <p className="font-display text-lg text-ink leading-none">{persona.nombre}</p>
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${accent.badge}`}>
                        {TIPO_LABEL[persona.tipo]}
                      </span>
                      {persona.nivel && <span className="text-[10px] text-ink-light border border-rule rounded-full px-2 py-0.5">{persona.nivel}</span>}
                      {persona.categoria_proveedor && <span className="text-[10px] text-ink-light border border-rule rounded-full px-2 py-0.5">{persona.categoria_proveedor}</span>}
                      {!persona.activo && <span className="text-[10px] text-coral font-medium">Inactivo</span>}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                      <CampoInfo label="Teléfono" valor={persona.telefono} href={persona.telefono ? `tel:${persona.telefono}` : null} />
                      <CampoInfo label="Email" valor={persona.email} href={persona.email ? `mailto:${persona.email}` : null} />
                      <CampoInfoCopiable label="Alias MP" valor={persona.alias_mercado_pago} icon={Wallet} />
                      <CampoInfo label="Tarifa/hora" valor={persona.tarifa_hora ? money(persona.tarifa_hora) : null} icon={Clock} />
                    </div>

                    {persona.notas && <p className="text-xs text-ink-mid mt-3 pt-3 border-t border-rule">{persona.notas}</p>}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end gap-3 flex-shrink-0">
                    {persona.telefono && (
                      <a
                        href={armarLinkWhatsapp(persona.telefono, `¡Hola ${persona.nombre.split(' ')[0]}!`)}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 bg-wine text-paper text-xs rounded-full px-3 py-1.5 hover:bg-wine-mid transition-colors flex-shrink-0"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    )}
                    <div className="flex items-center gap-3">
                      <button onClick={() => setForm({ ...VACIO, ...persona })} className="text-ink-light hover:text-ink" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => toggleActivo(persona)} className="text-[11px] text-ink-light hover:text-ink whitespace-nowrap">
                        {persona.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => eliminar(persona)} className="text-ink-light hover:text-coral" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {form && <FormModal form={form} setForm={setForm} onGuardar={guardar} onCerrar={() => setForm(null)} />}
    </div>
  )
}

function StatCard({ label, valor, icon: Icon, iconColor }) {
  return (
    <div className="bg-peach rounded-lg p-4">
      <div className="relative w-7 h-7 mb-2 flex items-center justify-center">
        <span className="absolute w-5 h-5 rounded-full" style={{ backgroundColor: iconColor, opacity: 0.55 }} />
        {Icon ? (
          <Icon size={14} className="relative text-ink" />
        ) : (
          <Users size={14} className="relative text-ink" />
        )}
      </div>
      <p className="text-[11px] uppercase tracking-wide text-ink-mid mb-0.5">{label}</p>
      <p className="font-display text-2xl text-wine">{valor}</p>
    </div>
  )
}

/** Igual que CampoInfo, pero con un botón de copiar al lado — para el
 * alias de Mercado Pago, que se necesita pegar en la app de MP, no
 * llamar ni mandar mail. Muestra un tilde 1.5s después de copiar, para
 * confirmar sin necesitar un toast aparte. */
function CampoInfoCopiable({ label, valor, icon: Icon }) {
  const [copiado, setCopiado] = useState(false)

  if (!valor) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-wide text-ink-light mb-0.5">{label}</p>
        <p className="text-sm text-ink-light/60">—</p>
      </div>
    )
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // si el navegador bloquea el clipboard (poco común), no rompe nada
    }
  }

  return (
    <button onClick={copiar} className="text-left hover:opacity-70 transition-opacity min-w-0" title="Copiar alias">
      <p className="text-[10px] uppercase tracking-wide text-ink-light mb-0.5">{label}</p>
      <p className="text-sm font-medium text-ink flex items-center gap-1">
        {Icon && <Icon size={12} className="text-ink-light flex-shrink-0" />}
        <span className="truncate">{valor}</span>
        {copiado
          ? <Check size={12} className="text-wine flex-shrink-0" />
          : <Copy size={11} className="text-ink-light flex-shrink-0" />}
      </p>
    </button>
  )
}

function CampoInfo({ label, valor, href, icon: Icon }) {
  if (!valor) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-wide text-ink-light mb-0.5">{label}</p>
        <p className="text-sm text-ink-light/60">—</p>
      </div>
    )
  }
  const contenido = (
    <>
      <p className="text-[10px] uppercase tracking-wide text-ink-light mb-0.5">{label}</p>
      <p className="text-sm font-medium text-ink flex items-center gap-1">
        {Icon && <Icon size={12} className="text-ink-light flex-shrink-0" />}
        <span className="truncate">{valor}</span>
      </p>
    </>
  )
  if (href) {
    return (
      <a href={href} className="block hover:opacity-70 transition-opacity min-w-0">
        {contenido}
      </a>
    )
  }
  return <div className="min-w-0">{contenido}</div>
}

function FormModal({ form, setForm, onGuardar, onCerrar }) {
  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div className="card p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
            <label className="block text-xs text-ink-mid mb-1">Alias de Mercado Pago</label>
            <input className="input" placeholder="ej: francisco.barista.mp" value={form.alias_mercado_pago} onChange={(e) => set('alias_mercado_pago', e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-ink-mid mb-1">Tarifa por hora (lo que le pagás)</label>
            <input className="input" type="number" min="0" placeholder="8000" value={form.tarifa_hora} onChange={(e) => set('tarifa_hora', e.target.value)} />
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
            className="flex-1 bg-wine text-paper text-sm rounded-full px-4 py-2.5 hover:bg-wine-mid transition-colors disabled:opacity-50"
          >
            Guardar
          </button>
          <button onClick={onCerrar} className="border border-rule text-ink-mid text-sm rounded-full px-4 py-2.5 hover:border-ink hover:text-ink transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
