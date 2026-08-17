import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcularNecesidadesInsumos } from '../lib/necesidadesInsumos'
import PanelNecesidades from '../components/PanelNecesidades'
import { Plus, Pencil, Trash2, X, Search, AlertTriangle, PackagePlus } from 'lucide-react'

const CATEGORIA_LABEL = {
  leche: 'Leche',
  agua: 'Agua',
  cafe: 'Café',
  vasos: 'Vasos',
  calcos: 'Calcos',
  insumos: 'Insumos',
  otro: 'Otro',
}

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })

const VACIO = {
  id: null,
  nombre: '',
  categoria: 'leche',
  proveedor: '',
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

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('insumos').select('*').order('categoria').order('nombre')
    setInsumos(data || [])
    setLoading(false)
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
  }, [])

  async function guardar() {
    const payload = {
      nombre: form.nombre,
      categoria: form.categoria,
      proveedor: form.proveedor || null,
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
      proveedor: formReponer.proveedor || formReponer.insumo.proveedor || null,
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
    if (busqueda && !i.nombre.toLowerCase().includes(busqueda.toLowerCase()) && !(i.proveedor || '').toLowerCase().includes(busqueda.toLowerCase())) return false
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

      {/* Filtros */}
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
          {/* ===== Desktop: tabla ===== */}
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
                      insumo: item, cantidad_paquetes: 1, precio_unitario_pagado: item.precio_paquete, proveedor: item.proveedor || '',
                    })}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* ===== Mobile: tarjetas ===== */}
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
                  insumo: item, cantidad_paquetes: 1, precio_unitario_pagado: item.precio_paquete, proveedor: item.proveedor || '',
                })}
              />
            ))}
          </div>
        </>
      )}

      {form && <FormModal form={form} setForm={setForm} onGuardar={guardar} onCerrar={() => setForm(null)} />}
      {formReponer && (
        <FormReponer
          formReponer={formReponer}
          setFormReponer={setFormReponer}
          onConfirmar={confirmarReposicion}
          onCerrar={() => setFormReponer(null)}
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

function FilaInsumo({ item, stockBajo, onEditar, onToggleActivo, onEliminar, onReponer }) {
  return (
    <tr className={`border-b border-rule last:border-0 hover:bg-paper/60 ${!item.activo ? 'opacity-40' : ''}`}>
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{item.nombre}</p>
        <p className="text-xs text-ink-light">{CATEGORIA_LABEL[item.categoria]}{!item.iva_incluido && ' · +IVA'}</p>
      </td>
      <td className="px-4 py-3 text-ink-mid">{item.proveedor || <span className="text-ink-light">—</span>}</td>
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
          <p className="text-xs text-ink-light">{CATEGORIA_LABEL[item.categoria]}{item.proveedor ? ` · ${item.proveedor}` : ''}</p>
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
        <p className="text-sm text-ink-mid mb-4">{formReponer.insumo.nombre} — {formReponer.insumo.tipo_paquete}</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-ink-mid mb-1">Proveedor</label>
            <input className="input" value={formReponer.proveedor} onChange={(e) => set('proveedor', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
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

function FormModal({ form, setForm, onGuardar, onCerrar }) {
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

          <div className="grid grid-cols-2 gap-3">
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
              <label className="block text-xs text-ink-mid mb-1">Proveedor</label>
              <input className="input" placeholder="ej: Tregar" value={form.proveedor} onChange={(e) => set('proveedor', e.target.value)} />
            </div>
          </div>

          <div className="border-t border-rule pt-4">
            <p className="text-xs uppercase tracking-wide text-ink-light mb-3">Cómo se compra</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
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
            <div className="grid grid-cols-2 gap-3">
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

          <div className="border-t border-rule pt-4 grid grid-cols-2 gap-3">
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
