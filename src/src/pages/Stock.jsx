import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcularNecesidadesInsumos } from '../lib/necesidadesInsumos'
import { armarLinkWhatsapp } from '../lib/generarPdf'
import PanelNecesidades from '../components/PanelNecesidades'
import { Plus, Pencil, Trash2, X, Search, AlertTriangle, PackagePlus, ClipboardList, Table2, MessageCircle, Users2 } from 'lucide-react'

const CATEGORIA_LABEL = {
  leche: 'Leche',
  agua: 'Agua',
  cafe: 'Café',
  vasos: 'Vasos',
  calcos: 'Calcos',
  insumos: 'Insumos',
  otro: 'Otro',
}

// Un color de marca distinto por categoría — mismo criterio en toda
// la vista de Proveedores, así de un vistazo se sabe qué le compra
// cada uno sin leer el texto.
const CATEGORIA_COLOR = {
  leche: 'bg-blue-light text-blue-dark',
  agua: 'bg-terracota text-paper',
  cafe: 'bg-wine text-paper',
  vasos: 'bg-peach text-orange',
  calcos: 'bg-coral-light text-coral',
  insumos: 'bg-paper-warm text-brown',
  otro: 'bg-paper text-ink-light',
}

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })

const VACIO = {
  id: null,
  nombre: '',
  categoria: 'leche',
  proveedor_id: '',
  tipo_paquete: 'Unidad',
  cantidad_por_paquete: 1,
  unidad_medida: 'unidad',
  precio_paquete: '',
  iva_incluido: true,
  stock_actual: 0,
  stock_minimo: 0,
  notas: '',
  activo: true,
}

const PROVEEDOR_VACIO = {
  id: null,
  nombre_fantasia: '',
  razon_social: '',
  cuit: '',
  alias_pago: '',
  cbu: '',
  forma_pago: '',
  telefono: '',
  email: '',
  notas: '',
  activo: true,
}

export default function Stock() {
  const [insumos, setInsumos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [soloStockBajo, setSoloStockBajo] = useState(false)
  const [form, setForm] = useState(null)
  const [formReponer, setFormReponer] = useState(null)
  const [necesidades, setNecesidades] = useState(null)
  const [cargandoNecesidades, setCargandoNecesidades] = useState(true)
  // 'chequeo' = vista simple tipo planilla (para actualizar el Actual
  // rápido, pensada para que la use cualquiera sin explicación).
  // 'catalogo' = la vista completa con costos y proveedores (para vos).
  const [vista, setVista] = useState('chequeo')
  const [proveedores, setProveedores] = useState([])
  const [formProveedor, setFormProveedor] = useState(null)

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('insumos').select('*, proveedores(nombre_fantasia, telefono, alias_pago)').order('categoria').order('nombre')
    setInsumos(data || [])
    setLoading(false)
  }

  async function cargarProveedores() {
    const { data } = await supabase.from('proveedores').select('*').order('nombre_fantasia')
    setProveedores(data || [])
  }

  async function guardarProveedor() {
    const payload = {
      nombre_fantasia: formProveedor.nombre_fantasia,
      razon_social: formProveedor.razon_social || null,
      cuit: formProveedor.cuit || null,
      alias_pago: formProveedor.alias_pago || null,
      cbu: formProveedor.cbu || null,
      forma_pago: formProveedor.forma_pago || null,
      telefono: formProveedor.telefono || null,
      email: formProveedor.email || null,
      notas: formProveedor.notas || null,
      activo: formProveedor.activo,
    }
    if (formProveedor.id) {
      await supabase.from('proveedores').update(payload).eq('id', formProveedor.id)
    } else {
      await supabase.from('proveedores').insert(payload)
    }
    setFormProveedor(null)
    cargarProveedores()
    cargar()
  }

  async function eliminarProveedor(p) {
    if (!confirm(`¿Eliminar a ${p.nombre_fantasia}? Los insumos que lo tenían cargado quedan sin proveedor asignado.`)) return
    await supabase.from('proveedores').delete().eq('id', p.id)
    cargarProveedores()
    cargar()
  }

  async function cargarNecesidades() {
    setCargandoNecesidades(true)
    const r = await calcularNecesidadesInsumos()
    setNecesidades(r)
    setCargandoNecesidades(false)
  }

  useEffect(() => {
    cargar()
    cargarNecesidades()
    cargarProveedores()
  }, [])

  async function guardar() {
    const payload = {
      nombre: form.nombre,
      categoria: form.categoria,
      proveedor_id: form.proveedor_id || null,
      tipo_paquete: form.tipo_paquete,
      cantidad_por_paquete: Number(form.cantidad_por_paquete) || 1,
      unidad_medida: form.unidad_medida,
      precio_paquete: Number(form.precio_paquete) || 0,
      iva_incluido: form.iva_incluido,
      stock_actual: Number(form.stock_actual) || 0,
      stock_minimo: Number(form.stock_minimo) || 0,
      notas: form.notas || null,
      activo: form.activo,
    }
    if (form.id) {
      await supabase.from('insumos').update(payload).eq('id', form.id)
    } else {
      await supabase.from('insumos').insert(payload)
    }
    setForm(null)
    cargar()
    cargarNecesidades()
  }

  async function eliminar(item) {
    if (!confirm(`¿Eliminar "${item.nombre}"?`)) return
    await supabase.from('insumos').delete().eq('id', item.id)
    cargar()
  }

  async function toggleActivo(item) {
    await supabase.from('insumos').update({ activo: !item.activo }).eq('id', item.id)
    cargar()
  }

  /** Guarda el "Actual" al vuelo, sin modal — para el chequeo rápido
   * tipo planilla. Actualiza el estado local al toque (no espera el
   * refetch) para que se sienta instantáneo al tipear. */
  async function actualizarStockActual(item, nuevoValor) {
    const valor = nuevoValor === '' ? 0 : Number(nuevoValor)
    setInsumos((prev) => prev.map((i) => (i.id === item.id ? { ...i, stock_actual: valor } : i)))
    await supabase.from('insumos').update({ stock_actual: valor }).eq('id', item.id)
    cargarNecesidades()
  }

  /** Reposición rápida — registra la compra en el historial (para que
   * quede en Compras/Facturación también) Y suma el stock al insumo,
   * los dos en un solo paso, sin salir de esta pantalla. Es lo mismo
   * que "Marcar recibido" en Compras, pero arrancando directo desde
   * acá para no tener que ir y volver. */
  async function confirmarReposicion() {
    const cantidad = Number(formReponer.cantidad_paquetes) || 0
    const precio = Number(formReponer.precio_unitario_pagado) || 0
    if (cantidad <= 0) { setFormReponer(null); return }

    await supabase.from('compras').insert({
      insumo_id: formReponer.insumo.id,
      proveedor_id: formReponer.insumo.proveedor_id || null,
      cantidad_paquetes: cantidad,
      precio_unitario_pagado: precio,
      fecha_compra: new Date().toISOString().slice(0, 10),
      estado: 'recibido',
      notas: 'Reposición rápida desde Stock',
    })

    const sumar = cantidad * (Number(formReponer.insumo.cantidad_por_paquete) || 1)
    await supabase.from('insumos').update({
      stock_actual: (Number(formReponer.insumo.stock_actual) || 0) + sumar,
    }).eq('id', formReponer.insumo.id)

    setFormReponer(null)
    cargar()
    cargarNecesidades()
  }

  const esStockBajo = (item) => item.stock_minimo > 0 && item.stock_actual < item.stock_minimo

  const filtrado = insumos.filter((i) => {
    if (filtroCategoria !== 'todos' && i.categoria !== filtroCategoria) return false
    if (soloStockBajo && !esStockBajo(i)) return false
    if (busqueda && !i.nombre.toLowerCase().includes(busqueda.toLowerCase()) && !(i.proveedores?.nombre_fantasia || '').toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const cantidadStockBajo = insumos.filter(esStockBajo).length

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Stock</p>
          <h1 className="font-display text-2xl">Insumos y proveedores</h1>
        </div>
        <button
          onClick={() => setForm({ ...VACIO })}
          className="flex items-center justify-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors flex-shrink-0"
        >
          <Plus size={15} /> Agregar insumo
        </button>
      </div>

      <PanelNecesidades necesidades={necesidades} cargando={cargandoNecesidades} />

      {/* Toggle de vista — "Chequeo rápido" (tipo planilla, para
          cualquiera) vs "Catálogo completo" (costos y proveedores,
          para vos). Las dos leen/escriben el mismo dato real. */}
      <div className="inline-flex items-center gap-0.5 bg-peach/50 rounded-full p-1 mb-4">
        <button
          onClick={() => setVista('chequeo')}
          className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors ${
            vista === 'chequeo' ? 'bg-paper-card text-ink shadow-soft' : 'text-ink-mid hover:text-ink'
          }`}
        >
          <ClipboardList size={13} /> Chequeo rápido
        </button>
        <button
          onClick={() => setVista('catalogo')}
          className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors ${
            vista === 'catalogo' ? 'bg-paper-card text-ink shadow-soft' : 'text-ink-mid hover:text-ink'
          }`}
        >
          <Table2 size={13} /> Catálogo completo
        </button>
        <button
          onClick={() => setVista('proveedores')}
          className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors ${
            vista === 'proveedores' ? 'bg-paper-card text-ink shadow-soft' : 'text-ink-mid hover:text-ink'
          }`}
        >
          <Users2 size={13} /> Proveedores
        </button>
      </div>

      {vista === 'chequeo' && (
        <ChequeoRapido
          insumos={insumos}
          loading={loading}
          onActualizar={actualizarStockActual}
          esStockBajo={esStockBajo}
        />
      )}
      {vista === 'catalogo' && (
        <VistaCatalogo
          insumos={insumos}
          loading={loading}
          filtroCategoria={filtroCategoria}
          setFiltroCategoria={setFiltroCategoria}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          soloStockBajo={soloStockBajo}
          setSoloStockBajo={setSoloStockBajo}
          cantidadStockBajo={cantidadStockBajo}
          esStockBajo={esStockBajo}
          filtrado={filtrado}
          setForm={setForm}
          toggleActivo={toggleActivo}
          eliminar={eliminar}
          setFormReponer={setFormReponer}
        />
      )}
      {vista === 'proveedores' && (
        <VistaProveedores
          proveedores={proveedores}
          insumos={insumos}
          onNuevo={() => setFormProveedor({ ...PROVEEDOR_VACIO })}
          onEditar={(p) => setFormProveedor({ ...PROVEEDOR_VACIO, ...p })}
          onEliminar={eliminarProveedor}
        />
      )}

      {form && (
        <FormModal
          form={form}
          setForm={setForm}
          proveedores={proveedores}
          onAbrirProveedores={() => setFormProveedor({ ...PROVEEDOR_VACIO })}
          onGuardar={guardar}
          onCerrar={() => setForm(null)}
        />
      )}
      {formReponer && (
        <FormReponer
          formReponer={formReponer}
          setFormReponer={setFormReponer}
          onConfirmar={confirmarReposicion}
          onCerrar={() => setFormReponer(null)}
        />
      )}
      {formProveedor && (
        <FormProveedor
          form={formProveedor}
          setForm={setFormProveedor}
          onGuardar={guardarProveedor}
          onCerrar={() => setFormProveedor(null)}
        />
      )}
    </div>
  )
}

function costoUnitario(item) {
  const cantidad = Number(item.cantidad_por_paquete) || 1
  return (Number(item.precio_paquete) || 0) / cantidad
}

function unidadCorta(unidad) {
  return unidad === 'unidad' ? 'u.' : unidad
}

/** ============ VISTA "CHEQUEO RÁPIDO" ============
 * Igual a la planilla que ya usaban — pensada para que cualquiera
 * (tu hermano incluido) la actualice sin tener que aprender nada del
 * sistema. Un solo número editable por fila, todo lo demás calculado
 * solo. Sin modal: escribís el número, se guarda cuando salís del
 * campo (onBlur), no hay botón "Guardar" que apretar. */
function ChequeoRapido({ insumos, loading, onActualizar, esStockBajo }) {
  const activos = insumos.filter((i) => i.activo)

  if (loading) return <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>
  if (activos.length === 0) return <p className="text-sm text-ink-light py-10 text-center border border-rule rounded-lg">No hay insumos activos todavía.</p>

  return (
    <>
      <div className="hidden md:block border border-rule rounded-lg overflow-hidden bg-paper-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
              <th className="px-4 py-2.5 font-medium">Insumo</th>
              <th className="px-4 py-2.5 font-medium text-right">Mínimo</th>
              <th className="px-4 py-2.5 font-medium text-right">Actual</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium">Pedido</th>
            </tr>
          </thead>
          <tbody>
            {activos.map((item) => (
              <FilaChequeo key={item.id} item={item} onActualizar={onActualizar} stockBajo={esStockBajo(item)} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {activos.map((item) => (
          <FilaChequeoMobile key={item.id} item={item} onActualizar={onActualizar} stockBajo={esStockBajo(item)} />
        ))}
      </div>
    </>
  )
}

function FilaChequeo({ item, onActualizar, stockBajo }) {
  return (
    <tr className="border-b border-rule last:border-0 hover:bg-paper/60">
      <td className="px-4 py-3 font-medium text-ink">
        {item.nombre}
        <span className="text-ink-light font-normal"> {unidadCorta(item.unidad_medida) !== 'u.' ? `(${unidadCorta(item.unidad_medida)})` : ''}</span>
      </td>
      <td className="px-4 py-3 text-right text-ink-mid">{item.stock_minimo || '—'}</td>
      <td className="px-4 py-3 text-right">
        <input
          type="number"
          min="0"
          step="0.01"
          defaultValue={item.stock_actual}
          onBlur={(e) => onActualizar(item, e.target.value)}
          className="w-24 text-right border border-rule rounded px-2 py-1 focus:border-orange outline-none"
        />
      </td>
      <td className="px-4 py-3">
        {stockBajo
          ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-coral-light text-coral">Bajo</span>
          : <span className="text-[11px] px-2 py-0.5 rounded-full bg-wine text-paper">Hay stock</span>}
      </td>
      <td className="px-4 py-3">
        {stockBajo
          ? <span className="text-[11px] text-coral font-medium">Realizar pedido</span>
          : <span className="text-[11px] text-ink-light">OK</span>}
      </td>
    </tr>
  )
}

function FilaChequeoMobile({ item, onActualizar, stockBajo }) {
  return (
    <div className="border border-rule rounded-lg p-4 bg-paper-card">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-medium text-ink">{item.nombre}</p>
        {stockBajo
          ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-coral-light text-coral flex-shrink-0">Realizar pedido</span>
          : <span className="text-[10px] px-2 py-0.5 rounded-full bg-wine text-paper flex-shrink-0">Hay stock</span>}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-ink-light">Mínimo: {item.stock_minimo || '—'}</span>
        <label className="flex items-center gap-1.5 ml-auto">
          <span className="text-ink-mid">Actual:</span>
          <input
            type="number"
            min="0"
            step="0.01"
            defaultValue={item.stock_actual}
            onBlur={(e) => onActualizar(item, e.target.value)}
            className="w-20 text-right border border-rule rounded px-2 py-1 focus:border-orange outline-none"
          />
        </label>
      </div>
    </div>
  )
}

/** ============ VISTA "CATÁLOGO COMPLETO" ============
 * La vista de siempre — costos por paquete, proveedores, edición
 * completa. Para vos, no para el chequeo del día a día. */
function VistaCatalogo({
  insumos, loading, filtroCategoria, setFiltroCategoria, busqueda, setBusqueda,
  soloStockBajo, setSoloStockBajo, cantidadStockBajo, esStockBajo, filtrado,
  setForm, toggleActivo, eliminar, setFormReponer,
}) {
  return (
    <div>
      {cantidadStockBajo > 0 && (
        <button
          onClick={() => setSoloStockBajo((v) => !v)}
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 mb-4 w-full sm:w-auto transition-colors ${
            soloStockBajo ? 'bg-coral text-paper' : 'bg-coral-light text-coral hover:bg-coral hover:text-paper'
          }`}
        >
          <AlertTriangle size={15} />
          {cantidadStockBajo} insumo{cantidadStockBajo !== 1 ? 's' : ''} con stock por debajo del mínimo
          {soloStockBajo ? ' — mostrando solo estos' : ' — ver'}
        </button>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
        <div className="relative flex-shrink-0 w-full sm:w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o proveedor…"
            className="input pl-8 text-sm"
          />
        </div>
      </div>

      <p className="text-xs text-ink-light mb-3">{filtrado.length} insumo{filtrado.length !== 1 ? 's' : ''}</p>

      {loading && <p className="text-sm text-ink-light py-8 text-center">Cargando…</p>}

      {!loading && filtrado.length === 0 && (
        <p className="text-sm text-ink-light py-10 text-center border border-rule rounded-lg">
          No hay insumos que coincidan con este filtro.
        </p>
      )}

      {!loading && filtrado.length > 0 && (
        <>
          <div className="hidden md:block border border-rule rounded-lg overflow-hidden bg-paper-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
                  <th className="px-4 py-2.5 font-medium">Insumo</th>
                  <th className="px-4 py-2.5 font-medium">Proveedor</th>
                  <th className="px-4 py-2.5 font-medium">Paquete</th>
                  <th className="px-4 py-2.5 font-medium text-right">Precio paquete</th>
                  <th className="px-4 py-2.5 font-medium text-right">Costo unitario</th>
                  <th className="px-4 py-2.5 font-medium text-right">Stock</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map((item) => (
                  <FilaInsumo
                    key={item.id}
                    item={item}
                    stockBajo={esStockBajo(item)}
                    onEditar={() => setForm({ ...VACIO, ...item })}
                    onToggleActivo={() => toggleActivo(item)}
                    onEliminar={() => eliminar(item)}
                    onReponer={() => setFormReponer({
                      insumo: item, cantidad_paquetes: 1, precio_unitario_pagado: item.precio_paquete,
                    })}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {filtrado.map((item) => (
              <FilaInsumoMobile
                key={item.id}
                item={item}
                stockBajo={esStockBajo(item)}
                onEditar={() => setForm({ ...VACIO, ...item })}
                onToggleActivo={() => toggleActivo(item)}
                onEliminar={() => eliminar(item)}
                onReponer={() => setFormReponer({
                  insumo: item, cantidad_paquetes: 1, precio_unitario_pagado: item.precio_paquete,
                })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FilaInsumo({ item, stockBajo, onEditar, onToggleActivo, onEliminar, onReponer }) {
  return (
    <tr className={`border-b border-rule last:border-0 hover:bg-paper/60 ${!item.activo ? 'opacity-40' : ''}`}>
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{item.nombre}</p>
        <p className="text-xs text-ink-light">{CATEGORIA_LABEL[item.categoria]}{!item.iva_incluido && ' · +IVA'}</p>
      </td>
      <td className="px-4 py-3 text-ink-mid">
        {item.proveedores?.nombre_fantasia
          ? (
            <span className="flex items-center gap-1.5">
              {item.proveedores.nombre_fantasia}
              {item.proveedores.telefono && (
                <a href={armarLinkWhatsapp(item.proveedores.telefono, `¡Hola! Te quería hacer un pedido de ${item.nombre}.`)} target="_blank" rel="noreferrer" className="text-ink-light hover:text-wine" title="WhatsApp al proveedor">
                  <MessageCircle size={13} />
                </a>
              )}
            </span>
          )
          : <span className="text-ink-light">—</span>}
      </td>
      <td className="px-4 py-3 text-ink-mid">{item.tipo_paquete}</td>
      <td className="px-4 py-3 text-right text-ink-mid">{money(item.precio_paquete)}</td>
      <td className="px-4 py-3 text-right text-ink font-medium">
        {money(costoUnitario(item))}<span className="text-ink-light">/{unidadCorta(item.unidad_medida)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={stockBajo ? 'text-coral font-medium' : 'text-ink-mid'}>
          {item.stock_actual} {unidadCorta(item.unidad_medida)}
        </span>
        {stockBajo && <AlertTriangle size={12} className="inline ml-1 text-coral" />}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          <button onClick={onReponer} className="flex items-center gap-1 text-xs text-wine hover:underline" title="Registrar compra y sumar al stock">
            <PackagePlus size={14} /> Reponer
          </button>
          <button onClick={onEditar} className="text-ink-light hover:text-ink" title="Editar"><Pencil size={14} /></button>
          <button onClick={onToggleActivo} className="text-[11px] text-ink-light hover:text-ink whitespace-nowrap">
            {item.activo ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={onEliminar} className="text-ink-light hover:text-coral" title="Eliminar"><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  )
}

function FilaInsumoMobile({ item, stockBajo, onEditar, onToggleActivo, onEliminar, onReponer }) {
  return (
    <div className={`border border-rule rounded-lg p-4 bg-paper-card ${!item.activo ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-medium text-ink">{item.nombre}</p>
          <p className="text-xs text-ink-light">{CATEGORIA_LABEL[item.categoria]}{item.proveedores?.nombre_fantasia ? ` · ${item.proveedores.nombre_fantasia}` : ''}</p>
        </div>
        {stockBajo && (
          <span className="flex-shrink-0 flex items-center gap-1 text-[10px] text-coral bg-coral-light rounded-full px-2 py-0.5">
            <AlertTriangle size={10} /> Bajo
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-y-2 text-sm mb-3">
        <span className="text-ink-mid">{item.tipo_paquete} — {money(item.precio_paquete)}</span>
        <span className="text-ink text-right font-medium">{money(costoUnitario(item))}/{unidadCorta(item.unidad_medida)}</span>
        <span className="text-ink-mid col-span-2">Stock: {item.stock_actual} {unidadCorta(item.unidad_medida)}{item.stock_minimo > 0 ? ` (mín. ${item.stock_minimo})` : ''}</span>
      </div>
      <button onClick={onReponer} className="flex items-center gap-1.5 bg-wine text-paper text-xs rounded px-3 py-1.5 mb-3">
        <PackagePlus size={13} /> Reponer stock
      </button>
      <div className="flex items-center gap-4 pt-2 border-t border-rule">
        <button onClick={onEditar} className="text-xs text-ink-mid hover:text-ink">Editar</button>
        <button onClick={onToggleActivo} className="text-xs text-ink-mid hover:text-ink">{item.activo ? 'Desactivar' : 'Activar'}</button>
        <button onClick={onEliminar} className="text-xs text-ink-mid hover:text-coral">Eliminar</button>
      </div>
    </div>
  )
}

/** Modal chico de reposición rápida — solo pide cantidad y precio,
 * ya viene precargado con el proveedor y precio de referencia del
 * insumo. Un solo paso: queda en el historial de Compras Y suma el
 * stock al mismo tiempo. */
function FormReponer({ formReponer, setFormReponer, onConfirmar, onCerrar }) {
  function set(campo, valor) {
    setFormReponer((f) => ({ ...f, [campo]: valor }))
  }
  const totalPagar = (Number(formReponer.cantidad_paquetes) || 0) * (Number(formReponer.precio_unitario_pagado) || 0)

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div className="bg-paper-card border border-rule rounded-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl flex items-center gap-2"><PackagePlus size={18} /> Reponer stock</h2>
          <button onClick={onCerrar} className="text-ink-light hover:text-ink"><X size={18} /></button>
        </div>
        <p className="text-sm text-ink-mid mb-4">
          {formReponer.insumo.nombre} — {formReponer.insumo.tipo_paquete}
          {formReponer.insumo.proveedores?.nombre_fantasia && ` · ${formReponer.insumo.proveedores.nombre_fantasia}`}
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Cantidad de paquetes</label>
              <input className="input" type="number" min="0" step="0.01" autoFocus value={formReponer.cantidad_paquetes} onChange={(e) => set('cantidad_paquetes', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Precio por paquete</label>
              <input className="input" type="number" min="0" value={formReponer.precio_unitario_pagado} onChange={(e) => set('precio_unitario_pagado', e.target.value)} />
            </div>
          </div>
          <p className="text-sm text-ink-mid">Total a pagar: <strong className="text-ink">{money(totalPagar)}</strong></p>
          <p className="text-xs text-ink-light">
            Suma {(Number(formReponer.cantidad_paquetes) || 0) * (Number(formReponer.insumo.cantidad_por_paquete) || 1)} {unidadCorta(formReponer.insumo.unidad_medida)} al stock actual.
          </p>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onConfirmar} className="flex-1 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors">Confirmar</button>
          <button onClick={onCerrar} className="border border-rule text-ink-mid text-sm rounded px-4 py-2 hover:border-ink hover:text-ink transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function FormModal({ form, setForm, proveedores, onAbrirProveedores, onGuardar, onCerrar }) {
  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  const previewCosto = (Number(form.precio_paquete) || 0) / (Number(form.cantidad_por_paquete) || 1)

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div className="bg-paper-card border border-rule rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">{form.id ? 'Editar' : 'Agregar'} insumo</h2>
          <button onClick={onCerrar} className="text-ink-light hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-ink-mid mb-1">Nombre *</label>
            <input className="input" placeholder="ej: Leche entera" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Categoría</label>
              <select className="input" value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
                <option value="leche">Leche</option>
                <option value="agua">Agua</option>
                <option value="cafe">Café</option>
                <option value="vasos">Vasos</option>
                <option value="calcos">Calcos</option>
                <option value="insumos">Insumos</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1 flex items-center justify-between">
                Proveedor
                <button type="button" onClick={onAbrirProveedores} className="text-wine hover:underline normal-case font-normal">+ Nuevo proveedor</button>
              </label>
              <select className="input" value={form.proveedor_id || ''} onChange={(e) => set('proveedor_id', e.target.value)}>
                <option value="">Sin proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre_fantasia}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-rule pt-4">
            <p className="text-xs uppercase tracking-wide text-ink-light mb-3">Cómo se compra</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-ink-mid mb-1">Tipo de paquete</label>
                <input className="input" placeholder="Caja 12L, Bidón 20L, Paquete x1000…" value={form.tipo_paquete} onChange={(e) => set('tipo_paquete', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-ink-mid mb-1">Unidad de medida</label>
                <select className="input" value={form.unidad_medida} onChange={(e) => set('unidad_medida', e.target.value)}>
                  <option value="unidad">Unidad</option>
                  <option value="L">Litros</option>
                  <option value="kg">Kilos</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-mid mb-1">Cantidad por paquete</label>
                <input className="input" type="number" min="0" step="0.01" value={form.cantidad_por_paquete} onChange={(e) => set('cantidad_por_paquete', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-ink-mid mb-1">Precio del paquete</label>
                <input className="input" type="number" min="0" placeholder="0" value={form.precio_paquete} onChange={(e) => set('precio_paquete', e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-ink-mid mt-2">
              Costo por {unidadCorta(form.unidad_medida)}: <strong className="text-ink">{money(previewCosto)}</strong>
            </p>
            <label className="flex items-center gap-2 text-xs text-ink-mid mt-2">
              <input type="checkbox" checked={form.iva_incluido} onChange={(e) => set('iva_incluido', e.target.checked)} />
              El precio ya incluye IVA
            </label>
          </div>

          <div className="border-t border-rule pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-mid mb-1">Stock actual</label>
              <input className="input" type="number" min="0" step="0.01" value={form.stock_actual} onChange={(e) => set('stock_actual', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ink-mid mb-1">Stock mínimo (alerta)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.stock_minimo} onChange={(e) => set('stock_minimo', e.target.value)} />
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

/** ============ VISTA "PROVEEDORES" ============
 * Listado propio (no un popup) — cada proveedor muestra, con
 * colores, qué categorías de insumos provee de verdad (derivado de
 * los insumos que ya tiene cargados, no un dato suelto que se pueda
 * desactualizar). Mismo criterio visual que Insumos: filtro arriba,
 * tabla en desktop, tarjetas en mobile. */
function VistaProveedores({ proveedores, insumos, onNuevo, onEditar, onEliminar }) {
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  // Para cada proveedor, qué categorías de insumos le compra hoy —
  // se recalcula solo, nunca se desactualiza a mano.
  const categoriasPorProveedor = {}
  for (const i of insumos) {
    if (!i.proveedor_id) continue
    if (!categoriasPorProveedor[i.proveedor_id]) categoriasPorProveedor[i.proveedor_id] = new Set()
    categoriasPorProveedor[i.proveedor_id].add(i.categoria)
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
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
        <div className="flex gap-2 flex-shrink-0">
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="input pl-8 text-sm" />
          </div>
          <button onClick={onNuevo} className="flex items-center gap-1.5 bg-wine text-paper text-sm rounded px-4 py-2 hover:bg-wine-mid transition-colors whitespace-nowrap">
            <Plus size={15} /> Nuevo
          </button>
        </div>
      </div>

      <p className="text-xs text-ink-light mb-3">{filtrado.length} proveedor{filtrado.length !== 1 ? 'es' : ''}</p>

      {filtrado.length === 0 && (
        <p className="text-sm text-ink-light py-10 text-center border border-rule rounded-lg">
          No hay proveedores que coincidan con este filtro.
        </p>
      )}

      {filtrado.length > 0 && (
        <>
          {/* ===== Desktop: tabla ===== */}
          <div className="hidden md:block border border-rule rounded-lg overflow-hidden bg-paper-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
                  <th className="px-4 py-2.5 font-medium">Proveedor</th>
                  <th className="px-4 py-2.5 font-medium">Provee</th>
                  <th className="px-4 py-2.5 font-medium">Contacto</th>
                  <th className="px-4 py-2.5 font-medium">Alias / forma de pago</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map((p) => (
                  <FilaProveedor key={p.id} p={p} categorias={categoriasPorProveedor[p.id]} onEditar={() => onEditar(p)} onEliminar={() => onEliminar(p)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* ===== Mobile: tarjetas ===== */}
          <div className="md:hidden space-y-2">
            {filtrado.map((p) => (
              <FilaProveedorMobile key={p.id} p={p} categorias={categoriasPorProveedor[p.id]} onEditar={() => onEditar(p)} onEliminar={() => onEliminar(p)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function BadgesCategorias({ categorias }) {
  if (!categorias || categorias.size === 0) return <span className="text-ink-light text-xs">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from(categorias).map((c) => (
        <span key={c} className={`text-[10px] px-2 py-0.5 rounded-full ${CATEGORIA_COLOR[c] || CATEGORIA_COLOR.otro}`}>
          {CATEGORIA_LABEL[c]}
        </span>
      ))}
    </div>
  )
}

function FilaProveedor({ p, categorias, onEditar, onEliminar }) {
  return (
    <tr className={`border-b border-rule last:border-0 hover:bg-paper/60 ${!p.activo ? 'opacity-40' : ''}`}>
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{p.nombre_fantasia}</p>
        {p.razon_social && <p className="text-xs text-ink-light">{p.razon_social}</p>}
      </td>
      <td className="px-4 py-3"><BadgesCategorias categorias={categorias} /></td>
      <td className="px-4 py-3">
        {p.telefono ? (
          <span className="flex items-center gap-1.5 text-ink-mid">
            {p.telefono}
            <a href={armarLinkWhatsapp(p.telefono, '¡Hola! Te quería hacer un pedido.')} target="_blank" rel="noreferrer" className="text-ink-light hover:text-wine">
              <MessageCircle size={13} />
            </a>
          </span>
        ) : <span className="text-ink-light">—</span>}
      </td>
      <td className="px-4 py-3 text-ink-mid">
        {p.alias_pago || '—'}{p.forma_pago ? ` · ${p.forma_pago}` : ''}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          <button onClick={onEditar} className="text-ink-light hover:text-ink"><Pencil size={14} /></button>
          <button onClick={onEliminar} className="text-ink-light hover:text-coral"><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  )
}

function FilaProveedorMobile({ p, categorias, onEditar, onEliminar }) {
  return (
    <div className={`border border-rule rounded-lg p-4 bg-paper-card ${!p.activo ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div>
          <p className="font-medium text-ink">{p.nombre_fantasia}</p>
          {p.razon_social && <p className="text-xs text-ink-light">{p.razon_social}</p>}
        </div>
        {p.telefono && (
          <a href={armarLinkWhatsapp(p.telefono, '¡Hola! Te quería hacer un pedido.')} target="_blank" rel="noreferrer" className="text-wine flex-shrink-0">
            <MessageCircle size={18} />
          </a>
        )}
      </div>
      <div className="mb-2"><BadgesCategorias categorias={categorias} /></div>
      <p className="text-xs text-ink-mid mb-3">
        {p.telefono || 'Sin teléfono'}{p.alias_pago ? ` · MP: ${p.alias_pago}` : ''}
      </p>
      <div className="flex items-center gap-4 pt-2 border-t border-rule">
        <button onClick={onEditar} className="text-xs text-ink-mid hover:text-ink">Editar</button>
        <button onClick={onEliminar} className="text-xs text-ink-mid hover:text-coral">Eliminar</button>
      </div>
    </div>
  )
}

function FormProveedor({ form, setForm, onGuardar, onCerrar }) {
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
