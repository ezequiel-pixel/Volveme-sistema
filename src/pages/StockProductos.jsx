import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, AlertTriangle, ChevronDown, ChevronUp, Package } from 'lucide-react'

const money = (n) => n == null ? '—' : `US$ ${Number(n).toFixed(2)}`
const moneyCorto = (n) => `US$ ${n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(0)}`

const PALETA = ['#3d2a2e', '#ff6a1a', '#3f6bff', '#a47864', '#8c5a45', '#01269a', '#fd926f', '#5a4045']

// Vecinos de caja inferidos del packing list GC20260307S — el archivo
// no tiene una columna de "caja física", pero las líneas sin cantidad
// de cajas propia (combinadas) aparecen agrupadas en filas
// consecutivas de la planilla, que es como estos listados chinos
// suelen anotar "esto entró junto en la caja sobrante". Es una
// inferencia, no un dato certero — se marca así en pantalla.
const VECINOS_DE_CAJA = {
  'GCT037': ['GCP005-1'], 'GCP005-1': ['GCT037'],
  'GCM009-600': ['GCCM038-120T', 'GCF008-2', 'GCS004'],
  'GCS004': ['GCCM038-120T', 'GCF008-2', 'GCM009-600'],
  'GCF008-2': ['GCCM038-120T', 'GCM009-600', 'GCS004'],
  'GCCM038-120T': ['GCCM038-90M', 'GCCM038-90T', 'GCF008-2', 'GCM009-600', 'GCS004'],
  'GCP007-1': ['GCA021'], 'GCA021': ['GCP007-1'],
  'GCD002': ['GCB004-1', 'GCD001-8', 'GCD016-2'],
  'GCD001-8': ['GCB004-1', 'GCD002', 'GCD016-2'],
  'GCD016-2': ['GCB004-1', 'GCD001-8', 'GCD002'],
  'GCB004-1': ['GCD001-8', 'GCD002', 'GCD016-2'],
  'GCB010': ['GCA004', 'GCA020-1', 'GCKB015'],
  'GCA004': ['GCA020-1', 'GCB010', 'GCKB015'],
  'GCKB015': ['GCA004', 'GCA020-1', 'GCB010'],
  'GCA020-1': ['GCA004', 'GCB010', 'GCKB015'],
  'GCCM038-90M': ['GCCM038-120T', 'GCCM038-90T'],
  'GCCM038-90T': ['GCCM038-120T', 'GCCM038-90M'],
  'GCB001': ['GCV007'], 'GCV007': ['GCB001'],
  'GCGM036': ['GCA004-3'], 'GCA004-3': ['GCGM036'],
  'GCC065': ['GCA033'], 'GCA033': ['GCC065'],
  'GCA005': ['GCGP004-8'], 'GCGP004-8': ['GCA005'],
}

export default function StockProductos() {
  const [productos, setProductos] = useState([])
  const [todosLosLotes, setTodosLosLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [vista, setVista] = useState('familia') // 'familia' | 'pedidos'
  const [busqueda, setBusqueda] = useState('')
  const [filtroFamilia, setFiltroFamilia] = useState('todas')
  const [familiasAbiertas, setFamiliasAbiertas] = useState(new Set())
  const [pedidosAbiertos, setPedidosAbiertos] = useState(new Set())

  function toggleFamilia(familia) {
    setFamiliasAbiertas((prev) => {
      const next = new Set(prev)
      if (next.has(familia)) next.delete(familia)
      else next.add(familia)
      return next
    })
  }

  function togglePedido(factura) {
    setPedidosAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(factura)) next.delete(factura)
      else next.add(factura)
      return next
    })
  }

  async function cargar() {
    setLoading(true)
    setError(null)
    const [{ data, error: err }, { data: lotes, error: errLotes }] = await Promise.all([
      supabase.from('productos').select('*').eq('activo', true).order('familia').order('sku_interno'),
      supabase.from('producto_lotes').select('*, productos(nombre, variante, sku_interno, codigo_proveedor, imagen_url)').order('fecha_pedido', { ascending: false }),
    ])
    if (err || errLotes) { setError((err || errLotes).message); setLoading(false); return }
    setProductos(data || [])
    setTodosLosLotes(lotes || [])
    // La primera vez, el pedido más reciente arranca abierto — así no
    // hay que hacer doble clic para ver lo último que llegó.
    if (lotes && lotes.length > 0) setPedidosAbiertos(new Set([lotes[0].numero_factura]))
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function actualizarStock(p, nuevoValor) {
    const valor = nuevoValor === '' ? 0 : Number(nuevoValor)
    setProductos((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock_actual: valor } : x)))
    const { error: err } = await supabase.from('productos').update({ stock_actual: valor }).eq('id', p.id)
    if (err) alert('No se pudo guardar el stock: ' + err.message)
  }

  function filtrarPorFamilia(familia) {
    setFiltroFamilia(familia)
    document.getElementById('tabla-productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const familias = [...new Set(productos.map((p) => p.familia))].sort()

  // ---- Inteligencia del panel superior — sobre TODO el catálogo, no
  // sobre lo filtrado (así siempre da el panorama real completo) ----
  const valorTotalInventario = productos.reduce((s, p) => s + (Number(p.stock_actual) || 0) * (Number(p.costo_unitario_usd) || 0), 0)
  const piezasTotales = productos.reduce((s, p) => s + (Number(p.stock_actual) || 0), 0)
  const bajoMinimoTodos = productos.filter((p) => p.stock_minimo && p.stock_actual < p.stock_minimo)

  const piezasPorFamilia = familias
    .map((f) => ({
      familia: f,
      piezas: productos.filter((p) => p.familia === f).reduce((s, p) => s + (Number(p.stock_actual) || 0), 0),
    }))
    .sort((a, b) => b.piezas - a.piezas)

  // ---- Agrupado por pedido/factura — "qué trajo cada envío", al
  // revés del agrupado por familia ("qué tengo de cada producto"). Un
  // mismo pedido puede traer el mismo SKU en más de una caja (llegó
  // repartido) — se listan las líneas tal cual están en el packing
  // list, sin fusionar, así se ve la realidad física del envío.
  const pedidosAgrupados = {}
  for (const l of todosLosLotes) {
    const factura = l.numero_factura || 'Sin factura'
    if (!pedidosAgrupados[factura]) {
      pedidosAgrupados[factura] = { factura, fecha: l.fecha_pedido, lineas: [], totalCajas: 0, totalPiezas: 0 }
    }
    pedidosAgrupados[factura].lineas.push(l)
    pedidosAgrupados[factura].totalCajas += Number(l.cantidad_cajas) || 0
    pedidosAgrupados[factura].totalPiezas += Number(l.cantidad_total) || 0
  }
  const pedidosOrdenados = Object.values(pedidosAgrupados).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

  // ---- Lotes por producto, calculado directo de todosLosLotes (ya
  // están todos cargados, no hace falta pedirlos de nuevo al expandir
  // una tarjeta). Cada lote se clasifica como "caja dedicada" (tiene
  // cantidad_cajas propia en el packing list) o "combinada" (sin
  // cantidad_cajas — esas unidades vinieron dentro de una caja
  // compartida con otro producto, no tienen caja propia).
  const lotesPorProductoId = {}
  for (const l of todosLosLotes) {
    (lotesPorProductoId[l.producto_id] ||= []).push({ ...l, dedicada: l.cantidad_cajas != null })
  }


  const filtrados = productos.filter((p) => {
    if (filtroFamilia !== 'todas' && p.familia !== filtroFamilia) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const enTexto = `${p.sku_interno} ${p.codigo_proveedor || ''} ${p.nombre} ${p.variante || ''}`.toLowerCase()
      if (!enTexto.includes(q)) return false
    }
    return true
  })

  if (loading) return <p className="text-sm text-ink-light py-12 text-center">Cargando…</p>

  if (error) {
    return (
      <div className="border border-coral rounded-lg p-5 bg-coral-light max-w-xl">
        <p className="text-sm font-medium text-coral mb-2">No se pudo cargar Stock de Productos</p>
        <p className="text-xs font-mono bg-paper border border-rule rounded p-2 mb-3 overflow-x-auto">{error}</p>
        <p className="text-xs text-ink-mid">Esto casi siempre significa que el SQL del módulo Productos todavía no se corrió en Supabase.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Productos</p>
        <h1 className="font-display text-2xl">Stock de Productos</h1>
      </div>

      {/* ============ PANEL INTELIGENTE — el panorama antes que la lista ============ */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-2xl p-4 sm:p-5 bg-peach/50">
          <p className="font-display text-2xl sm:text-3xl text-wine leading-none mb-1.5">{moneyCorto(valorTotalInventario)}</p>
          <p className="text-[11px] sm:text-xs text-ink-mid">Valor del inventario</p>
        </div>
        <div className="rounded-2xl p-4 sm:p-5 bg-blue-light/40">
          <p className="font-display text-2xl sm:text-3xl text-blue-dark leading-none mb-1.5">{piezasTotales.toLocaleString('es-AR')}</p>
          <p className="text-[11px] sm:text-xs text-ink-mid">Piezas en stock</p>
        </div>
        <div className={`rounded-2xl p-4 sm:p-5 ${bajoMinimoTodos.length > 0 ? 'bg-coral-light' : 'bg-paper-warm/60'}`}>
          <p className={`font-display text-2xl sm:text-3xl leading-none mb-1.5 ${bajoMinimoTodos.length > 0 ? 'text-coral' : 'text-ink-mid'}`}>{bajoMinimoTodos.length}</p>
          <p className="text-[11px] sm:text-xs text-ink-mid">Para reponer</p>
        </div>
      </div>

      {bajoMinimoTodos.length > 0 && (
        <div className="rounded-2xl bg-coral-light p-4 sm:p-5 mb-4">
          <p className="text-sm font-medium text-coral mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Hay que reponer
          </p>
          <div className="space-y-2">
            {bajoMinimoTodos.map((p) => (
              <button
                key={p.id}
                onClick={() => { setBusqueda(p.sku_interno); document.getElementById('tabla-productos')?.scrollIntoView({ behavior: 'smooth' }) }}
                className="w-full flex items-center justify-between text-sm bg-paper-card rounded-xl px-4 py-2.5 hover:bg-paper transition-colors text-left"
              >
                <span className="text-ink">{p.nombre}{p.variante ? ` · ${p.variante}` : ''}</span>
                <span className="text-coral font-medium text-xs flex-shrink-0 ml-2">{p.stock_actual}/{p.stock_minimo}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {familias.length > 1 && (
        <div className="rounded-2xl bg-paper-card border border-rule p-5 sm:p-6 mb-6">
          <p className="text-sm font-medium text-ink mb-4">Por familia</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {piezasPorFamilia.map((f, i) => {
              const pct = piezasTotales > 0 ? (f.piezas / piezasTotales) * 100 : 0
              return (
                <button
                  key={f.familia}
                  onClick={() => filtrarPorFamilia(f.familia)}
                  className="w-full text-left group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-ink group-hover:text-wine transition-colors truncate pr-2">{f.familia}</span>
                    <span className="text-xs text-ink-light flex-shrink-0">{f.piezas.toLocaleString('es-AR')} pzs</span>
                  </div>
                  <div className="h-2 rounded-full bg-paper-warm overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: PALETA[i % PALETA.length] }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ============ SELECTOR DE VISTA — por familia, o por pedido/caja ============ */}
      <div className="flex gap-1 mb-4">
        {[['familia', 'Por familia'], ['pedidos', 'Por pedido / caja']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setVista(key)}
            className={`text-xs px-3.5 py-1.5 rounded-full border transition-colors ${
              vista === key ? 'border-wine bg-wine text-paper' : 'border-rule text-ink-mid hover:border-wine'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === 'pedidos' ? (
        <div className="space-y-2">
          {pedidosOrdenados.length === 0 && (
            <p className="text-sm text-ink-light py-8 text-center border border-rule rounded-2xl">Sin pedidos registrados todavía.</p>
          )}
          {pedidosOrdenados.map((pedido) => {
            const abierto = pedidosAbiertos.has(pedido.factura)
            return (
              <div key={pedido.factura} className="rounded-2xl border border-rule bg-paper-card overflow-hidden">
                <button
                  onClick={() => togglePedido(pedido.factura)}
                  className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-paper/60 transition-colors"
                >
                  <div className="text-left">
                    <span className="text-sm font-medium text-ink">{pedido.factura}</span>
                    {pedido.fecha && <span className="text-xs text-ink-light ml-2">{new Date(pedido.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</span>}
                  </div>
                  <span className="flex items-center gap-3 text-xs text-ink-light">
                    {pedido.totalCajas} cajas · {pedido.totalPiezas.toLocaleString('es-AR')} pzs
                    {abierto ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </span>
                </button>
                {abierto && (
                  <div className="border-t border-rule divide-y divide-rule">
                    {pedido.lineas.map((l) => (
                      <div key={l.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                        <div className="w-9 h-9 rounded-lg bg-paper border border-rule flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {l.productos?.imagen_url ? (
                            <img src={l.productos.imagen_url} alt="" className="w-full h-full object-contain p-0.5" loading="lazy" />
                          ) : (
                            <Package size={14} className="text-ink-light" strokeWidth={1.5} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink truncate">
                            {l.productos?.nombre}{l.productos?.variante && <span className="text-ink-light"> · {l.productos.variante}</span>}
                          </p>
                          <p className="text-[11px] font-mono text-ink-light">{l.productos?.sku_interno}</p>
                        </div>
                        <div className="text-right text-xs text-ink-mid flex-shrink-0">
                          {l.cantidad_cajas ? <p>{l.cantidad_cajas} caja{l.cantidad_cajas > 1 ? 's' : ''} × {l.cantidad_por_caja}</p> : null}
                          <p className="font-medium text-ink">{l.cantidad_total} pzs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
      <>
      {/* ============ LISTADO — buscador + filtro, agrupado por familia ============ */}
      <div id="tabla-productos" className="flex flex-col sm:flex-row gap-2 mb-4 scroll-mt-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input
            className="input pl-9" placeholder="Buscar por código, nombre, variante…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select className="input sm:w-64" value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}>
          <option value="todas">Todas las familias</option>
          {familias.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Buscando o con un filtro puesto: se salta el agrupamiento y
          muestra directo los resultados — agrupar cuando ya sabés lo
          que buscás solo estorba. Sin nada de eso: agrupado por
          familia, todo colapsado, así no hay 47 tarjetas de entrada. */}
      {(busqueda || filtroFamilia !== 'todas') ? (
        <>
          <p className="text-xs text-ink-light mb-2">{filtrados.length} de {productos.length} SKUs</p>
          <GrillaProductos
            productos={filtrados}
            lotesPorProductoId={lotesPorProductoId}
            onActualizarStock={actualizarStock}
          />
        </>
      ) : (
        <div className="space-y-2">
          {familias.map((familia) => {
            const productosFamilia = productos.filter((p) => p.familia === familia)
            const stockFamilia = productosFamilia.reduce((s, p) => s + (Number(p.stock_actual) || 0), 0)
            const abierta = familiasAbiertas.has(familia)
            return (
              <div key={familia} className="rounded-2xl border border-rule bg-paper-card overflow-hidden">
                <button
                  onClick={() => toggleFamilia(familia)}
                  className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-paper/60 transition-colors"
                >
                  <span className="text-sm font-medium text-ink">{familia}</span>
                  <span className="flex items-center gap-3 text-xs text-ink-light">
                    {productosFamilia.length} SKU{productosFamilia.length !== 1 ? 's' : ''} · {stockFamilia.toLocaleString('es-AR')} pzs
                    {abierta ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </span>
                </button>
                {abierta && (
                  <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-rule">
                    <GrillaProductos
                      productos={productosFamilia}
                      lotesPorProductoId={lotesPorProductoId}
                      onActualizarStock={actualizarStock}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>
      )}
    </div>
  )
}

/** Grilla de tarjetas de producto — 1 columna en mobile, 2-3 en
 * desktop, en vez de una tabla angosta de una sola columna. Se usa
 * tanto para resultados de búsqueda (flat) como adentro de cada
 * familia desplegada. */
function GrillaProductos({ productos, lotesPorProductoId, onActualizarStock }) {
  if (productos.length === 0) {
    return <p className="text-sm text-ink-light py-8 text-center">Sin resultados.</p>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {productos.map((p) => {
        const bajoMinimo = p.stock_minimo > 0 && p.stock_actual < p.stock_minimo
        const lotes = lotesPorProductoId[p.id] || []
        const codigosVecinos = p.codigo_proveedor ? (VECINOS_DE_CAJA[p.codigo_proveedor] || []) : []
        return (
          <div key={p.id} className={`rounded-xl border p-3.5 transition-colors ${bajoMinimo ? 'border-coral/40 bg-coral-light/30' : 'border-rule bg-paper'}`}>
            <div className="flex items-start gap-3 mb-2">
              <div className="w-14 h-14 rounded-lg bg-paper-card border border-rule flex items-center justify-center flex-shrink-0 overflow-hidden">
                {p.imagen_url ? (
                  <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain p-1" loading="lazy" />
                ) : (
                  <Package size={20} className="text-ink-light" strokeWidth={1.5} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink truncate">{p.nombre}{p.variante && <span className="text-ink-light"> · {p.variante}</span>}</p>
                <p className="text-[11px] font-mono text-ink-light mt-0.5">{p.sku_interno}{p.codigo_proveedor ? ` · ${p.codigo_proveedor}` : ''}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs text-ink-light">{money(p.costo_unitario_usd)}</span>
              <div className="flex items-center gap-1.5">
                {bajoMinimo && <AlertTriangle size={12} className="text-coral" />}
                <input
                  type="number" min="0"
                  className="w-16 text-right border border-rule rounded px-1.5 py-1 text-sm bg-paper-card"
                  value={p.stock_actual}
                  onChange={(e) => onActualizarStock(p, e.target.value)}
                />
              </div>
            </div>

            {/* Desglose por caja — siempre a la vista, sin clic. Si
                está en una sola caja no hace falta desglosar nada, el
                número de arriba ya alcanza. Si está repartido, cada
                línea muestra el código propio y, en la combinada, el
                código del otro producto con el que comparte caja. */}
            {lotes.length > 1 && (
              <div className="pt-2 border-t border-rule space-y-1">
                {lotes.map((l, i) => (
                  <div key={l.id} className="flex items-center justify-between text-[11px] font-mono">
                    <span className={l.dedicada ? 'text-ink-mid' : 'text-orange'}>
                      Caja {i + 1} {p.codigo_proveedor}
                      {!l.dedicada && (codigosVecinos.length > 0 ? ` ${codigosVecinos.join(' ')}` : ' (?)')}
                    </span>
                    <span className="font-medium text-ink flex-shrink-0 ml-2">{l.cantidad_total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
