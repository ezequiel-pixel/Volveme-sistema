import { useEffect, useState } from 'react'
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
  const [familiasAbiertas, setFamiliasAbiertas] = useState(new Set())

  function toggleFamilia(familia) {
    setFamiliasAbiertas((prev) => {
      const next = new Set(prev)
      if (next.has(familia)) next.delete(familia)
      else next.add(familia)
      return next
    })
  }

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
            expandido={expandido}
            lotesPorProducto={lotesPorProducto}
            onToggleExpandir={toggleExpandir}
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
                      expandido={expandido}
                      lotesPorProducto={lotesPorProducto}
                      onToggleExpandir={toggleExpandir}
                      onActualizarStock={actualizarStock}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Grilla de tarjetas de producto — 1 columna en mobile, 2-3 en
 * desktop, en vez de una tabla angosta de una sola columna. Se usa
 * tanto para resultados de búsqueda (flat) como adentro de cada
 * familia desplegada. */
function GrillaProductos({ productos, expandido, lotesPorProducto, onToggleExpandir, onActualizarStock }) {
  if (productos.length === 0) {
    return <p className="text-sm text-ink-light py-8 text-center">Sin resultados.</p>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {productos.map((p) => {
        const bajoMinimo = p.stock_minimo > 0 && p.stock_actual < p.stock_minimo
        const estaExpandido = expandido === p.id
        return (
          <div key={p.id} className={`rounded-xl border p-3.5 transition-colors ${bajoMinimo ? 'border-coral/40 bg-coral-light/30' : 'border-rule bg-paper'}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{p.nombre}{p.variante && <span className="text-ink-light"> · {p.variante}</span>}</p>
                <p className="text-[11px] font-mono text-ink-light mt-0.5">{p.sku_interno}{p.codigo_proveedor ? ` · ${p.codigo_proveedor}` : ''}</p>
              </div>
              <button onClick={() => onToggleExpandir(p)} className="text-ink-light hover:text-ink flex-shrink-0">
                {estaExpandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
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
            {estaExpandido && (
              <div className="mt-3 pt-3 border-t border-rule">
                <p className="text-[10px] uppercase tracking-wide text-ink-light mb-1.5 flex items-center gap-1">
                  <Package size={11} /> Lotes
                </p>
                {!lotesPorProducto[p.id] ? (
                  <p className="text-xs text-ink-light">Cargando…</p>
                ) : lotesPorProducto[p.id].length === 0 ? (
                  <p className="text-xs text-ink-light">Sin lotes registrados.</p>
                ) : (
                  <div className="space-y-1.5">
                    {lotesPorProducto[p.id].map((l) => (
                      <div key={l.id} className="text-[11px] text-ink-mid">
                        <span className="font-medium text-ink">{l.numero_factura}</span>
                        {l.fecha_pedido && <span> · {new Date(l.fecha_pedido + 'T00:00:00').toLocaleDateString('es-AR')}</span>}
                        <span> · {l.cantidad_total} pzs</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
