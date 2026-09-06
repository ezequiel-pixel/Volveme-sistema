import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Pencil, Trash2, X, Search, AlertTriangle, ImagePlus, Coffee, Wrench, Box, Save } from 'lucide-react'

const CATEGORIA_LABEL = {
  maquina: 'Máquina',
  molino: 'Molino',
  barra: 'Barra',
  accesorio: 'Accesorio',
}

const CATEGORIA_COLOR = {
  maquina: 'bg-wine text-paper',
  molino: 'bg-terracota text-paper',
  barra: 'bg-blue-light text-blue-dark',
  accesorio: 'bg-peach text-orange',
}

const CATEGORIA_ICONO = {
  maquina: Coffee,
  molino: Coffee,
  barra: Box,
  accesorio: Wrench,
}

const VACIO = {
  id: null, nombre: '', categoria: 'accesorio', cantidad_total: 1,
  foto_url: '', notas: '', activo: true,
}

export default function Equipamiento() {
  const [tab, setTab] = useState('inventario')
  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Equipamiento</p>
        <h1 className="font-display text-2xl">Máquinas, barras y accesorios</h1>
      </div>

      <div className="flex gap-1 mb-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          ['inventario', 'Inventario físico'],
          ['tarifas', 'Tarifas de cotización'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-shrink-0 whitespace-nowrap text-xs px-3.5 py-1.5 rounded border transition-colors ${
              tab === key ? 'border-ink bg-ink text-paper' : 'border-rule text-ink-mid hover:border-ink hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'inventario' && <InventarioFisico />}
      {tab === 'tarifas' && <TarifasCotizacion />}
    </div>
  )
}

// ============================================================================
// TAB 1 — Inventario físico (lo que ya existía, sin cambios de lógica)
// ============================================================================
function InventarioFisico() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.from('equipamiento').select('*').order('categoria').order('nombre')
      if (err) throw err
      setItems(data || [])
    } catch (err) {
      console.error('Error cargando Equipamiento:', err)
      setError(err.message || 'No se pudo cargar la información.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  /** Sube la foto al bucket "equipamiento" de Supabase Storage y
   * devuelve el link público — así queda guardada la imagen real,
   * no un link externo que se puede caer. */
  async function subirFoto(file) {
    setSubiendoFoto(true)
    try {
      const nombreArchivo = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
      const { error: errUpload } = await supabase.storage.from('equipamiento').upload(nombreArchivo, file)
      if (errUpload) throw errUpload
      const { data } = supabase.storage.from('equipamiento').getPublicUrl(nombreArchivo)
      setForm((f) => ({ ...f, foto_url: data.publicUrl }))
    } catch (err) {
      console.error('Error subiendo foto:', err)
      alert('No se pudo subir la foto: ' + (err.message || 'error desconocido'))
    } finally {
      setSubiendoFoto(false)
    }
  }

  async function guardar() {
    const payload = {
      nombre: form.nombre,
      categoria: form.categoria,
      cantidad_total: Number(form.cantidad_total) || 1,
      foto_url: form.foto_url || null,
      notas: form.notas || null,
      activo: form.activo,
    }
    if (form.id) {
      await supabase.from('equipamiento').update(payload).eq('id', form.id)
    } else {
      await supabase.from('equipamiento').insert(payload)
    }
    setForm(null)
    cargar()
  }

  async function eliminar(item) {
    if (!confirm(`¿Dar de baja "${item.nombre}"? Si tenía checklists de eventos con este ítem, quedan sin el vínculo (no se borran).`)) return
    await supabase.from('equipamiento').delete().eq('id', item.id)
    cargar()
  }

  async function toggleActivo(item) {
    await supabase.from('equipamiento').update({ activo: !item.activo }).eq('id', item.id)
    cargar()
  }

  const filtrado = items.filter((i) => {
    if (filtroCategoria !== 'todos' && i.categoria !== filtroCategoria) return false
    if (busqueda && !i.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setForm({ ...VACIO })}
          className="flex items-center justify-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors flex-shrink-0"
        >
          <Plus size={15} /> Dar de alta
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm bg-coral-light text-coral rounded-lg px-4 py-2.5 mb-4">
          <AlertTriangle size={15} className="flex-shrink-0" />
          No se pudo cargar: {error} — probá recargar la página.
        </div>
      )}

      {/* Filtros — mobile-first */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 overflow-x-auto flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['todos', 'maquina', 'molino', 'barra', 'accesorio'].map((c) => (
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
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="input pl-8 text-sm" />
        </div>
      </div>

      <p className="text-xs text-ink-light mb-3">{filtrado.length} ítem{filtrado.length !== 1 ? 's' : ''}</p>

      {loading && <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>}

      {!loading && filtrado.length === 0 && (
        <p className="text-sm text-ink-light py-10 text-center border border-rule rounded-lg">
          No hay equipamiento que coincida con este filtro.
        </p>
      )}

      {/* Grilla de tarjetas con foto — mobile-first: 1 columna en
          celular, 2 en tablet, 3-4 en desktop grande */}
      {!loading && filtrado.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtrado.map((item) => (
            <TarjetaEquipo
              key={item.id}
              item={item}
              onEditar={() => setForm({ ...VACIO, ...item })}
              onToggleActivo={() => toggleActivo(item)}
              onEliminar={() => eliminar(item)}
            />
          ))}
        </div>
      )}

      {form && (
        <FormModal
          form={form}
          setForm={setForm}
          onGuardar={guardar}
          onCerrar={() => setForm(null)}
          onSubirFoto={subirFoto}
          subiendoFoto={subiendoFoto}
        />
      )}
    </div>
  )
}

function TarjetaEquipo({ item, onEditar, onToggleActivo, onEliminar }) {
  const Icono = CATEGORIA_ICONO[item.categoria] || Box
  return (
    <div className={`border border-rule rounded-lg bg-paper-card overflow-hidden flex flex-col ${!item.activo ? 'opacity-40' : ''}`}>
      {/* Foto — así de un vistazo sabés exactamente qué producto es,
          sin tener que adivinar por el nombre */}
      <div className="aspect-square bg-paper-warm flex items-center justify-center overflow-hidden">
        {item.foto_url ? (
          <img src={item.foto_url} alt={item.nombre} className="w-full h-full object-cover" />
        ) : (
          <Icono size={32} className="text-ink-light" />
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="font-medium text-ink text-sm leading-tight">{item.nombre}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${CATEGORIA_COLOR[item.categoria]}`}>
            {CATEGORIA_LABEL[item.categoria]}
          </span>
        </div>
        <p className="text-xs text-ink-light mb-2">Cantidad: <strong className="text-ink-mid">{item.cantidad_total}</strong></p>
        {item.notas && <p className="text-xs text-ink-mid mb-2 flex-1">{item.notas}</p>}
        {!item.activo && <p className="text-[10px] text-coral mb-2">Inactivo</p>}
        <div className="flex items-center gap-3 pt-2 border-t border-rule mt-auto">
          <button onClick={onEditar} className="text-xs text-ink-mid hover:text-ink flex items-center gap-1"><Pencil size={12} /> Editar</button>
          <button onClick={onToggleActivo} className="text-xs text-ink-mid hover:text-ink">{item.activo ? 'Baja' : 'Alta'}</button>
          <button onClick={onEliminar} className="text-xs text-ink-mid hover:text-coral ml-auto"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  )
}

function FormModal({ form, setForm, onGuardar, onCerrar, onSubirFoto, subiendoFoto }) {
  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div className="bg-paper-card border border-rule rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">{form.id ? 'Editar' : 'Dar de alta'} equipamiento</h2>
          <button onClick={onCerrar} className="text-ink-light hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {/* Foto — arriba de todo, es lo primero que ayuda a identificar */}
          <div>
            <label className="block text-xs text-ink-mid mb-1">Foto</label>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-lg bg-paper-warm flex items-center justify-center overflow-hidden flex-shrink-0 border border-rule">
                {form.foto_url ? (
                  <img src={form.foto_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={22} className="text-ink-light" />
                )}
              </div>
              <label className="flex items-center gap-1.5 border border-rule text-ink-mid text-xs rounded px-3 py-2 hover:border-ink hover:text-ink transition-colors cursor-pointer">
                {subiendoFoto ? 'Subiendo…' : (form.foto_url ? 'Cambiar foto' : 'Subir foto')}
                <input
                  type="file" accept="image/*" className="hidden" disabled={subiendoFoto}
                  onChange={(e) => e.target.files[0] && onSubirFoto(e.target.files[0])}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs text-ink-mid mb-1">Nombre *</label>
            <input className="input" placeholder="ej: Pitcher 600ml" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Categoría</label>
              <select className="input" value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
                <option value="maquina">Máquina</option>
                <option value="molino">Molino</option>
                <option value="barra">Barra</option>
                <option value="accesorio">Accesorio</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Cantidad que tenés</label>
              <input type="number" min="0" className="input" value={form.cantidad_total} onChange={(e) => set('cantidad_total', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-ink-mid mb-1">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-mid">
            <input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} />
            Activo (en uso)
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onGuardar}
            disabled={!form.nombre || subiendoFoto}
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

// ============================================================================
// TAB 2 — Tarifas de cotización (equipos_catalogo). Esto es lo que usa el
// motor de pricing para armar barras chica/grande y sumar equipo de Facu
// o Peipe. Los valores por default son los que confirmaste; acá se pueden
// ajustar sin tocar la base de datos a mano.
// ============================================================================
const TIPO_EQUIPO_LABEL = {
  maquina_1grupo: 'Máquina 1 grupo',
  maquina_2grupos: 'Máquina 2 grupos',
  molino: 'Molino',
  mobiliario_chico: 'Mobiliario — barra chica',
  mobiliario_grande: 'Mobiliario — barra grande',
}

function TarifasCotizacion() {
  const [equipos, setEquipos] = useState([])
  const [proveedores, setProveedores] = useState({})
  const [loading, setLoading] = useState(true)
  const [guardandoId, setGuardandoId] = useState(null)
  const [form, setForm] = useState(null) // nuevo ítem de catálogo

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('equipos_catalogo')
      .select('*, proveedores(nombre_fantasia)')
      .order('proveedor_id', { nullsFirst: true })
      .order('tipo_equipo')
    setEquipos(data || [])

    const { data: prov } = await supabase
      .from('proveedores')
      .select('id, nombre_fantasia')
      .eq('tipo_proveedor', 'equipamiento_eventos')
    setProveedores(Object.fromEntries((prov || []).map((p) => [p.id, p.nombre_fantasia])))

    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function actualizarCampo(id, campo, valor) {
    setGuardandoId(id)
    await supabase.from('equipos_catalogo').update({ [campo]: valor }).eq('id', id)
    setEquipos((prev) => prev.map((e) => (e.id === id ? { ...e, [campo]: valor } : e)))
    setGuardandoId(null)
  }

  async function toggleActivo(item) {
    await actualizarCampo(item.id, 'activo', !item.activo)
  }

  async function crearNuevo() {
    if (!form.nombre || !form.tipo_equipo) return
    const payload = {
      proveedor_id: form.proveedor_id || null,
      tipo_equipo: form.tipo_equipo,
      nombre: form.nombre,
      tarifa_dia: Number(form.tarifa_dia) || 0,
      margen_pct: Number(form.margen_pct) || 0,
      multi_unidad: !!form.multi_unidad,
      cantidad_disponible: Number(form.cantidad_disponible) || 1,
      notas: form.notas || null,
      activo: true,
    }
    await supabase.from('equipos_catalogo').insert(payload)
    setForm(null)
    cargar()
  }

  async function eliminar(item) {
    if (!confirm(`¿Eliminar "${item.nombre}" del catálogo de tarifas? Si ya tiene reservas cargadas, esto puede fallar — desactivalo en vez de borrarlo si ya tiene historial.`)) return
    await supabase.from('equipos_catalogo').delete().eq('id', item.id)
    cargar()
  }

  const propios = equipos.filter((e) => !e.proveedor_id)
  const porProveedor = {}
  for (const e of equipos.filter((e) => e.proveedor_id)) {
    const nombre = proveedores[e.proveedor_id] || 'Proveedor'
    if (!porProveedor[nombre]) porProveedor[nombre] = []
    porProveedor[nombre].push(e)
  }

  if (loading) return <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-ink-light">Los valores se guardan solos al salir de cada campo. Esto es lo que usa el cotizador para calcular — no hace falta tocar la base de datos.</p>
        <button
          onClick={() => setForm({ nombre: '', tipo_equipo: 'maquina_2grupos', proveedor_id: '', tarifa_dia: 0, margen_pct: 0.5, multi_unidad: false, cantidad_disponible: 1, notas: '' })}
          className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-3 py-2 hover:bg-wine-mid transition-colors flex-shrink-0 whitespace-nowrap ml-4"
        >
          <Plus size={14} /> Nuevo proveedor de equipo
        </button>
      </div>

      <TablaTarifas
        titulo="Volveme (propio)"
        subtitulo="Costo del alquiler es $0 — el costo real es la amortización, no un alquiler"
        items={propios}
        onCampo={actualizarCampo}
        onToggleActivo={toggleActivo}
        onEliminar={eliminar}
        guardandoId={guardandoId}
        ocultarMargen
      />

      {Object.entries(porProveedor).map(([nombre, items]) => (
        <TablaTarifas
          key={nombre}
          titulo={nombre}
          items={items}
          onCampo={actualizarCampo}
          onToggleActivo={toggleActivo}
          onEliminar={eliminar}
          guardandoId={guardandoId}
        />
      ))}

      {form && (
        <FormNuevoEquipo
          form={form}
          setForm={setForm}
          onGuardar={crearNuevo}
          onCerrar={() => setForm(null)}
        />
      )}
    </div>
  )
}

function TablaTarifas({ titulo, subtitulo, items, onCampo, onToggleActivo, onEliminar, guardandoId, ocultarMargen }) {
  if (items.length === 0) return null
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-wide text-ink-light mb-1">{titulo}</p>
      {subtitulo && <p className="text-[11px] text-ink-light mb-2">{subtitulo}</p>}
      <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
              <th className="px-4 py-2.5 font-medium">Equipo</th>
              <th className="px-4 py-2.5 font-medium">Tipo</th>
              <th className="px-4 py-2.5 font-medium text-right">Tarifa/día</th>
              {!ocultarMargen && <th className="px-4 py-2.5 font-medium text-right">Margen</th>}
              <th className="px-4 py-2.5 font-medium text-right">Disponibles</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={`border-b border-rule last:border-0 hover:bg-paper/60 ${!item.activo ? 'opacity-40' : ''}`}>
                <td className="px-4 py-3 font-medium text-ink">{item.nombre}</td>
                <td className="px-4 py-3 text-ink-mid">{TIPO_EQUIPO_LABEL[item.tipo_equipo] || item.tipo_equipo}</td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    defaultValue={item.tarifa_dia}
                    onBlur={(e) => { if (Number(e.target.value) !== item.tarifa_dia) onCampo(item.id, 'tarifa_dia', Number(e.target.value)) }}
                    className="input text-sm text-right py-1 w-28 ml-auto"
                  />
                </td>
                {!ocultarMargen && (
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number" step="0.01"
                      defaultValue={item.margen_pct}
                      onBlur={(e) => { if (Number(e.target.value) !== item.margen_pct) onCampo(item.id, 'margen_pct', Number(e.target.value)) }}
                      className="input text-sm text-right py-1 w-20 ml-auto"
                      title="0.5 = 50% de margen"
                    />
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    defaultValue={item.cantidad_disponible}
                    onBlur={(e) => { if (Number(e.target.value) !== item.cantidad_disponible) onCampo(item.id, 'cantidad_disponible', Number(e.target.value)) }}
                    className="input text-sm text-right py-1 w-16 ml-auto"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    {guardandoId === item.id && <Save size={12} className="text-ink-light animate-pulse" />}
                    <button onClick={() => onToggleActivo(item)} className="text-xs text-ink-mid hover:text-ink whitespace-nowrap">{item.activo ? 'Baja' : 'Alta'}</button>
                    <button onClick={() => onEliminar(item)} className="text-ink-light hover:text-coral"><Trash2 size={13} /></button>
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

function FormNuevoEquipo({ form, setForm, onGuardar, onCerrar }) {
  const [proveedores, setProveedores] = useState([])
  function set(campo, valor) { setForm((f) => ({ ...f, [campo]: valor })) }

  useEffect(() => {
    supabase.from('proveedores').select('id, nombre_fantasia').eq('tipo_proveedor', 'equipamiento_eventos')
      .then(({ data }) => setProveedores(data || []))
  }, [])

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div className="bg-paper-card border border-rule rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">Nuevo equipo cotizable</h2>
          <button onClick={onCerrar} className="text-ink-light hover:text-ink"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-ink-mid mb-1">Nombre *</label>
            <input className="input" placeholder="ej: Nuova Simonelli 2 grupos — Facu" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Tipo</label>
              <select className="input" value={form.tipo_equipo} onChange={(e) => set('tipo_equipo', e.target.value)}>
                {Object.entries(TIPO_EQUIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Proveedor</label>
              <select className="input" value={form.proveedor_id} onChange={(e) => set('proveedor_id', e.target.value)}>
                <option value="">Propio de Volveme</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre_fantasia}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Tarifa/día</label>
              <input className="input" type="number" value={form.tarifa_dia} onChange={(e) => set('tarifa_dia', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Margen (0.5 = 50%)</label>
              <input className="input" type="number" step="0.01" value={form.margen_pct} onChange={(e) => set('margen_pct', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Cantidad disponible</label>
              <input className="input" type="number" value={form.cantidad_disponible} onChange={(e) => set('cantidad_disponible', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-mid mt-6">
              <input type="checkbox" checked={form.multi_unidad} onChange={(e) => set('multi_unidad', e.target.checked)} />
              Admite varias unidades
            </label>
          </div>
          <div>
            <label className="block text-xs text-ink-mid mb-1">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onGuardar} disabled={!form.nombre} className="flex-1 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors disabled:opacity-50">Guardar</button>
          <button onClick={onCerrar} className="border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
