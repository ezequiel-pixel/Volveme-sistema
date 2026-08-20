import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { armarLinkWhatsapp } from '../lib/generarPdf'
import { Plus, Pencil, Trash2, X, Search, MessageCircle, Building2, AlertTriangle, Wallet } from 'lucide-react'

const CATEGORIA_LABEL = {
  leche: 'Leche', agua: 'Agua', cafe: 'Café', vasos: 'Vasos',
  calcos: 'Calcos', insumos: 'Insumos', otro: 'Otro',
}

// Un color de marca distinto por categoría — de un vistazo, sin leer
// texto, se sabe qué le compra cada proveedor.
const CATEGORIA_COLOR = {
  leche: 'bg-blue-light text-blue-dark',
  agua: 'bg-terracota text-paper',
  cafe: 'bg-wine text-paper',
  vasos: 'bg-peach text-orange',
  calcos: 'bg-coral-light text-coral',
  insumos: 'bg-paper-warm text-brown',
  otro: 'bg-paper text-ink-light',
}

const VACIO = {
  id: null, nombre_fantasia: '', razon_social: '', cuit: '', alias_pago: '',
  cbu: '', forma_pago: '', telefono: '', email: '', notas: '', activo: true,
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [insumos, setInsumos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const { data: provData, error: errProv } = await supabase.from('proveedores').select('*').order('nombre_fantasia')
      if (errProv) throw errProv
      setProveedores(provData || [])

      const { data: insData, error: errIns } = await supabase.from('insumos').select('id, categoria, proveedor_id').eq('activo', true)
      if (errIns) throw errIns
      setInsumos(insData || [])
    } catch (err) {
      console.error('Error cargando Proveedores:', err)
      setError(err.message || 'No se pudo cargar la información.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function guardar() {
    const payload = {
      nombre_fantasia: form.nombre_fantasia,
      razon_social: form.razon_social || null,
      cuit: form.cuit || null,
      alias_pago: form.alias_pago || null,
      cbu: form.cbu || null,
      forma_pago: form.forma_pago || null,
      telefono: form.telefono || null,
      email: form.email || null,
      notas: form.notas || null,
      activo: form.activo,
    }
    if (form.id) {
      await supabase.from('proveedores').update(payload).eq('id', form.id)
    } else {
      await supabase.from('proveedores').insert(payload)
    }
    setForm(null)
    cargar()
  }

  async function eliminar(p) {
    if (!confirm(`¿Eliminar a ${p.nombre_fantasia}? Los insumos que lo tenían cargado quedan sin proveedor asignado.`)) return
    await supabase.from('proveedores').delete().eq('id', p.id)
    cargar()
  }

  async function toggleActivo(p) {
    await supabase.from('proveedores').update({ activo: !p.activo }).eq('id', p.id)
    cargar()
  }

  // Qué categorías de insumos le compra hoy a cada proveedor — se
  // calcula solo, nunca se carga a mano ni se puede desactualizar.
  const categoriasPorProveedor = {}
  for (const i of insumos) {
    if (!i.proveedor_id) continue
    if (!categoriasPorProveedor[i.proveedor_id]) categoriasPorProveedor[i.proveedor_id] = new Set()
    categoriasPorProveedor[i.proveedor_id].add(i.categoria)
  }

  const activos = proveedores.filter((p) => p.activo)
  const stats = {
    total: activos.length,
    conWhatsapp: activos.filter((p) => p.telefono).length,
    conAliasPago: activos.filter((p) => p.alias_pago).length,
  }

  const filtrado = proveedores.filter((p) => {
    const cats = categoriasPorProveedor[p.id] || new Set()
    if (filtroCategoria !== 'todos' && !cats.has(filtroCategoria)) return false
    if (busqueda) {
      const texto = `${p.nombre_fantasia} ${p.razon_social || ''}`.toLowerCase()
      if (!texto.includes(busqueda.toLowerCase())) return false
    }
    return true
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Proveedores</p>
          <h1 className="font-display text-2xl">Proveedores</h1>
        </div>
        <button
          onClick={() => setForm({ ...VACIO })}
          className="flex items-center justify-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors flex-shrink-0"
        >
          <Plus size={15} /> Nuevo proveedor
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm bg-coral-light text-coral rounded-lg px-4 py-2.5 mb-4">
          <AlertTriangle size={15} className="flex-shrink-0" />
          No se pudo cargar: {error} — probá recargar la página.
        </div>
      )}

      {/* Stats — grid mobile-first: 1 columna en celular, 3 desde tablet */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-peach rounded-lg p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-mid mb-1 flex items-center gap-1.5"><Building2 size={12} /> Proveedores activos</p>
          <p className="font-display text-2xl text-wine">{stats.total}</p>
        </div>
        <div className="bg-peach rounded-lg p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-mid mb-1 flex items-center gap-1.5"><MessageCircle size={12} /> Con WhatsApp cargado</p>
          <p className="font-display text-2xl text-wine">{stats.conWhatsapp}</p>
        </div>
        <div className="bg-peach rounded-lg p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-mid mb-1 flex items-center gap-1.5"><Wallet size={12} /> Con alias de pago</p>
          <p className="font-display text-2xl text-wine">{stats.conAliasPago}</p>
        </div>
      </div>

      {/* Filtros — mobile-first: el buscador ocupa todo el ancho abajo
          de los chips en celular, al lado en pantallas más grandes */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 overflow-x-auto flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['todos', 'leche', 'agua', 'cafe', 'vasos', 'calcos', 'insumos', 'otro'].map((c) => (
            <button
              key={c}
              onClick={() => setFiltroCategoria(c)}
              className={`flex-shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded border transition-colors ${
                filtroCategoria === c ? 'border-ink bg-ink text-paper' : 'border-rule text-ink-mid hover:border-ink hover:text-ink'
              }`}
            >
              {c === 'todos' ? 'Todos' : CATEGORIA_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64 flex-shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre…" className="input pl-8 text-sm" />
        </div>
      </div>

      <p className="text-xs text-ink-light mb-3">{filtrado.length} proveedor{filtrado.length !== 1 ? 'es' : ''}</p>

      {loading && <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>}

      {!loading && filtrado.length === 0 && (
        <p className="text-sm text-ink-light py-10 text-center border border-rule rounded-lg">
          No hay proveedores que coincidan con este filtro.
        </p>
      )}

      {/* Grilla de tarjetas — mobile-first: 1 columna en celular, 2
          desde tablet, 3 en desktop grande. Nunca hay scroll
          horizontal, en ningún tamaño de pantalla. */}
      {!loading && filtrado.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtrado.map((p) => (
            <TarjetaProveedor
              key={p.id}
              p={p}
              categorias={categoriasPorProveedor[p.id]}
              onEditar={() => setForm({ ...VACIO, ...p })}
              onToggleActivo={() => toggleActivo(p)}
              onEliminar={() => eliminar(p)}
            />
          ))}
        </div>
      )}

      {form && <FormModal form={form} setForm={setForm} onGuardar={guardar} onCerrar={() => setForm(null)} />}
    </div>
  )
}

function TarjetaProveedor({ p, categorias, onEditar, onToggleActivo, onEliminar }) {
  return (
    <div className={`border border-rule rounded-lg bg-paper-card p-4 flex flex-col ${!p.activo ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-display text-lg text-ink truncate">{p.nombre_fantasia}</p>
          {p.razon_social && <p className="text-xs text-ink-light truncate">{p.razon_social}</p>}
        </div>
        {p.telefono && (
          <a
            href={armarLinkWhatsapp(p.telefono, '¡Hola! Te quería hacer un pedido.')}
            target="_blank" rel="noreferrer"
            className="flex-shrink-0 bg-wine text-paper rounded-full p-2 hover:bg-wine-mid transition-colors"
            title="WhatsApp"
          >
            <MessageCircle size={15} />
          </a>
        )}
      </div>

      {/* Badges de categoría — el corazón visual, se calculan solos */}
      <div className="flex flex-wrap gap-1 mb-3">
        {categorias && categorias.size > 0 ? (
          Array.from(categorias).map((c) => (
            <span key={c} className={`text-[10px] px-2 py-0.5 rounded-full ${CATEGORIA_COLOR[c] || CATEGORIA_COLOR.otro}`}>
              {CATEGORIA_LABEL[c]}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-ink-light">Sin insumos asociados</span>
        )}
        {!p.activo && <span className="text-[10px] px-2 py-0.5 rounded-full bg-coral-light text-coral">Inactivo</span>}
      </div>

      {/* Datos de contacto y pago — grilla propia, siempre legible */}
      <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs mb-3 flex-1">
        <div>
          <p className="text-ink-light uppercase tracking-wide text-[10px] mb-0.5">Teléfono</p>
          <p className="text-ink-mid">{p.telefono || '—'}</p>
        </div>
        <div>
          <p className="text-ink-light uppercase tracking-wide text-[10px] mb-0.5">Alias de pago</p>
          <p className="text-ink-mid">{p.alias_pago || '—'}</p>
        </div>
        <div>
          <p className="text-ink-light uppercase tracking-wide text-[10px] mb-0.5">Forma de pago</p>
          <p className="text-ink-mid">{p.forma_pago || '—'}</p>
        </div>
        <div>
          <p className="text-ink-light uppercase tracking-wide text-[10px] mb-0.5">CUIT</p>
          <p className="text-ink-mid">{p.cuit || '—'}</p>
        </div>
      </div>

      {p.notas && <p className="text-xs text-ink-mid mb-3 pt-2 border-t border-rule">{p.notas}</p>}

      <div className="flex items-center gap-4 pt-2 border-t border-rule mt-auto">
        <button onClick={onEditar} className="text-xs text-ink-mid hover:text-ink flex items-center gap-1"><Pencil size={12} /> Editar</button>
        <button onClick={onToggleActivo} className="text-xs text-ink-mid hover:text-ink">{p.activo ? 'Desactivar' : 'Activar'}</button>
        <button onClick={onEliminar} className="text-xs text-ink-mid hover:text-coral ml-auto flex items-center gap-1"><Trash2 size={12} /></button>
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
          <h2 className="font-display text-xl">{form.id ? 'Editar' : 'Nuevo'} proveedor</h2>
          <button onClick={onCerrar} className="text-ink-light hover:text-ink"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-ink-mid mb-1">Nombre de fantasía *</label>
            <input className="input" placeholder="ej: Tregar" value={form.nombre_fantasia} onChange={(e) => set('nombre_fantasia', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-ink-mid mb-1">Razón social</label>
            <input className="input" value={form.razon_social} onChange={(e) => set('razon_social', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">CUIT</label>
              <input className="input" value={form.cuit} onChange={(e) => set('cuit', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Teléfono / WhatsApp</label>
              <input className="input" placeholder="11 5555-5555" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Alias de pago</label>
              <input className="input" value={form.alias_pago} onChange={(e) => set('alias_pago', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">CBU</label>
              <input className="input" value={form.cbu} onChange={(e) => set('cbu', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-ink-mid mb-1">Forma de pago</label>
            <input className="input" placeholder="Transferencia, efectivo, cuenta corriente…" value={form.forma_pago} onChange={(e) => set('forma_pago', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-ink-mid mb-1">Email</label>
            <input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
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
            disabled={!form.nombre_fantasia}
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
