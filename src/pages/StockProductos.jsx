import { useEffect, useState, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { Search, AlertTriangle, ChevronDown, ChevronUp, Package } from 'lucide-react'

const money = (n) => n == null ? '—' : `US$ ${Number(n).toFixed(2)}`
const moneyCorto = (n) => `US$ ${n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(0)}`

const PALETA = ['#3d2a2e', '#ff6a1a', '#3f6bff', '#a47864', '#8c5a45', '#01269a', '#fd926f', '#5a4045']

export default function StockProductos() {
  const [productos, setProductos] = useState([])
  const [lotesPorProducto, setLotesPorProducto] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [filtroFamilia, setFiltroFamilia] = useState('todas')
  const [expandido, setExpandido] = useState(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.from('productos').select('*').eq('activo', true).order('familia').order('sku_interno')
    if (err) { setError(err.message); setLoading(false); return }
    setProductos(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function cargarLotes(productoId) {
    if (lotesPorProducto[productoId]) return
    const { data } = await supabase.from('producto_lotes').select('*').eq('producto_id', productoId).order('fecha_pedido', { ascending: false })
    setLotesPorProducto((prev) => ({ ...prev, [productoId]: data || [] }))
  }

  function toggleExpandir(p) {
    if (expandido === p.id) { setExpandido(null); return }
    setExpandido(p.id)
    cargarLotes(p.id)
  }

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
          <div className="space-y-4">
            {piezasPorFamilia.map((f, i) => {
              const pct = piezasTotales > 0 ? (f.piezas / piezasTotales) * 100 : 0
              return (
                <button
                  key={f.familia}
                  onClick={() => filtrarPorFamilia(f.familia)}
                  className="w-full text-left group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-ink group-hover:text-wine transition-colors">{f.familia}</span>
                    <span className="text-xs text-ink-light">{f.piezas.toLocaleString('es-AR')} pzs</span>
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

      {/* ============ LISTADO — buscador + filtro + tabla ============ */}
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

      <p className="text-xs text-ink-light mb-2">{filtrados.length} de {productos.length} SKUs</p>

      <div className="border border-rule rounded-lg overflow-hidden bg-paper-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
              <th className="px-4 py-2.5 font-medium">Familia</th>
              <th className="px-4 py-2.5 font-medium">SKU Volveme</th>
              <th className="px-4 py-2.5 font-medium">Código fábrica</th>
              <th className="px-4 py-2.5 font-medium">Producto</th>
              <th className="px-4 py-2.5 font-medium text-right">Costo unit.</th>
              <th className="px-4 py-2.5 font-medium text-right">Stock</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-light">Sin resultados.</td></tr>
            )}
            {filtrados.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-b border-rule last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-2.5 text-ink-mid text-xs">{p.familia}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-wine">{p.sku_interno}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-mid">{p.codigo_proveedor || '—'}</td>
                  <td className="px-4 py-2.5 text-ink">
                    {p.nombre}
                    {p.variante && <span className="text-ink-light"> · {p.variante}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-mid">{money(p.costo_unitario_usd)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.stock_minimo > 0 && p.stock_actual < p.stock_minimo && <AlertTriangle size={13} className="text-coral" />}
                      <input
                        type="number" min="0"
                        className="w-20 text-right border border-rule rounded px-2 py-1 text-sm"
                        value={p.stock_actual}
                        onChange={(e) => actualizarStock(p, e.target.value)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggleExpandir(p)} className="text-ink-light hover:text-ink">
                      {expandido === p.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </td>
                </tr>
                {expandido === p.id && (
                  <tr className="bg-paper/40">
                    <td colSpan={7} className="px-4 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-ink-light mb-2 flex items-center gap-1.5">
                        <Package size={12} /> Lotes de importación
                      </p>
                      {!lotesPorProducto[p.id] ? (
                        <p className="text-xs text-ink-light">Cargando…</p>
                      ) : lotesPorProducto[p.id].length === 0 ? (
                        <p className="text-xs text-ink-light">Sin lotes registrados.</p>
                      ) : (
                        <div className="space-y-1">
                          {lotesPorProducto[p.id].map((l) => (
                            <div key={l.id} className="text-xs text-ink-mid flex flex-wrap gap-x-4">
                              <span className="font-medium text-ink">{l.numero_factura}</span>
                              <span>{l.fecha_pedido ? new Date(l.fecha_pedido + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</span>
                              <span>{l.cantidad_cajas ? `${l.cantidad_cajas} cajas × ${l.cantidad_por_caja}` : '—'}</span>
                              <span className="font-medium">{l.cantidad_total} pzs</span>
                              {l.peso_total_kg && <span>{l.peso_total_kg} kg</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
