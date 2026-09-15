import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Plus, Trash2, ShoppingBag, Globe, Store, Package, X } from 'lucide-react'

const money = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`)

const CANALES = [
  { key: 'ecommerce_propio', label: 'E-commerce propio', icon: Globe },
  { key: 'mercado_libre', label: 'Mercado Libre', icon: ShoppingBag },
  { key: 'b2b', label: 'B2B directo', icon: Store },
]

export default function Ventas() {
  const [productos, setProductos] = useState([])
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [canal, setCanal] = useState('ecommerce_propio')
  const [cliente, setCliente] = useState('')
  const [ordenExterna, setOrdenExterna] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState([]) // [{producto_id, sku, nombre, cantidad, precio_unitario}]

  async function cargar() {
    setLoading(true)
    setError(null)
    const [{ data: p, error: err1 }, { data: v, error: err2 }] = await Promise.all([
      supabase.from('vw_precios_por_canal').select('id, sku_interno, nombre, variante, pvp_publicacion_ars, imagen_url'),
      supabase.from('ventas').select('*, venta_items(cantidad, precio_unitario, productos(nombre, sku_interno))').order('creado_en', { ascending: false }).limit(30),
    ])
    if (err1 || err2) { setError((err1 || err2).message); setLoading(false); return }
    setProductos(p || [])
    setVentas(v || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const resultadosBusqueda = busqueda.length < 2 ? [] : productos.filter((p) => {
    const q = busqueda.toLowerCase()
    return `${p.sku_interno} ${p.nombre} ${p.variante || ''}`.toLowerCase().includes(q)
  }).slice(0, 8)

  function agregarAlCarrito(p) {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.producto_id === p.id)
      if (existe) {
        return prev.map((item) => item.producto_id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      }
      return [...prev, { producto_id: p.id, sku: p.sku_interno, nombre: p.nombre + (p.variante ? ` · ${p.variante}` : ''), cantidad: 1, precio_unitario: p.pvp_publicacion_ars || 0 }]
    })
    setBusqueda('')
  }

  function actualizarItem(producto_id, campo, valor) {
    setCarrito((prev) => prev.map((item) => item.producto_id === producto_id ? { ...item, [campo]: Number(valor) || 0 } : item))
  }

  function sacarDelCarrito(producto_id) {
    setCarrito((prev) => prev.filter((item) => item.producto_id !== producto_id))
  }

  const totalVenta = carrito.reduce((s, item) => s + item.cantidad * item.precio_unitario, 0)

  async function registrarVenta() {
    if (carrito.length === 0) { alert('Agregá al menos un producto.'); return }
    setGuardando(true)
    const { data: venta, error: errVenta } = await supabase.from('ventas').insert({
      canal,
      numero_orden_externo: ordenExterna || null,
      cliente_nombre: cliente || null,
      total_venta: totalVenta,
    }).select().single()
    if (errVenta) { alert('No se pudo registrar la venta: ' + errVenta.message); setGuardando(false); return }

    const { error: errItems } = await supabase.from('venta_items').insert(
      carrito.map((item) => ({ venta_id: venta.id, producto_id: item.producto_id, cantidad: item.cantidad, precio_unitario: item.precio_unitario }))
    )
    if (errItems) { alert('La venta se creó pero los productos no se pudieron cargar: ' + errItems.message); setGuardando(false); return }

    setCarrito([]); setCliente(''); setOrdenExterna('')
    setGuardando(false)
    cargar()
  }

  async function cancelarVenta(venta) {
    if (!confirm(`¿Cancelar esta venta? Esto devuelve el stock de los ${venta.venta_items.length} producto(s).`)) return
    const { error: err } = await supabase.from('venta_items').delete().eq('venta_id', venta.id)
    if (err) { alert('No se pudo cancelar: ' + err.message); return }
    await supabase.from('ventas').update({ estado: 'cancelada' }).eq('id', venta.id)
    cargar()
  }

  if (loading) return <p className="text-sm text-ink-light py-12 text-center">Cargando…</p>

  if (error) {
    return (
      <div className="border border-coral rounded-lg p-5 bg-coral-light max-w-xl">
        <p className="text-sm font-medium text-coral mb-2">No se pudo cargar Ventas</p>
        <p className="text-xs font-mono bg-paper border border-rule rounded p-2 mb-3 overflow-x-auto">{error}</p>
        <p className="text-xs text-ink-mid">Esto casi siempre significa que el SQL del módulo Ventas todavía no se corrió en Supabase.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Productos</p>
        <h1 className="font-display text-2xl">Registrar venta</h1>
      </div>

      {/* Canal */}
      <div className="flex gap-2 mb-5">
        {CANALES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCanal(c.key)}
            className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border transition-colors ${
              canal === c.key ? 'border-wine bg-wine text-paper' : 'border-rule text-ink-mid hover:border-wine'
            }`}
          >
            <c.icon size={14} /> {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <input className="input" placeholder="Cliente (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        <input className="input" placeholder="N° de orden externo (opcional — el de ML o el sitio)" value={ordenExterna} onChange={(e) => setOrdenExterna(e.target.value)} />
      </div>

      {/* Buscador de producto */}
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
        <input
          className="input pl-9" placeholder="Buscar producto por código, nombre, variante…"
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        />
        {resultadosBusqueda.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-paper-card border border-rule rounded-lg shadow-soft-lg overflow-hidden">
            {resultadosBusqueda.map((p) => (
              <button
                key={p.id}
                onClick={() => agregarAlCarrito(p)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-paper text-left border-b border-rule last:border-0"
              >
                <div className="w-8 h-8 rounded bg-paper border border-rule flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {p.imagen_url ? <img src={p.imagen_url} alt="" className="w-full h-full object-contain p-0.5" /> : <Package size={12} className="text-ink-light" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">{p.nombre}{p.variante && ` · ${p.variante}`}</p>
                  <p className="text-[10px] font-mono text-ink-light">{p.sku_interno}</p>
                </div>
                <span className="text-xs text-ink-light flex-shrink-0">{money(p.pvp_publicacion_ars)}</span>
                <Plus size={14} className="text-wine flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Carrito */}
      {carrito.length > 0 && (
        <div className="rounded-xl border border-rule bg-paper-card overflow-hidden mb-4 mt-3">
          {carrito.map((item) => (
            <div key={item.producto_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-rule last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink truncate">{item.nombre}</p>
                <p className="text-[10px] font-mono text-ink-light">{item.sku}</p>
              </div>
              <input
                type="number" min="1" value={item.cantidad}
                onChange={(e) => actualizarItem(item.producto_id, 'cantidad', e.target.value)}
                className="w-14 text-right border border-rule rounded px-1.5 py-1 text-sm bg-paper flex-shrink-0"
              />
              <span className="text-ink-light text-xs flex-shrink-0">×</span>
              <input
                type="number" min="0" value={item.precio_unitario}
                onChange={(e) => actualizarItem(item.producto_id, 'precio_unitario', e.target.value)}
                className="w-24 text-right border border-rule rounded px-1.5 py-1 text-sm bg-paper flex-shrink-0"
              />
              <span className="text-sm font-medium text-ink w-24 text-right flex-shrink-0">{money(item.cantidad * item.precio_unitario)}</span>
              <button onClick={() => sacarDelCarrito(item.producto_id)} className="text-ink-light hover:text-coral flex-shrink-0"><X size={15} /></button>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-paper">
            <span className="text-sm font-medium text-ink">Total</span>
            <span className="font-display text-xl text-wine">{money(totalVenta)}</span>
          </div>
        </div>
      )}

      <button
        onClick={registrarVenta}
        disabled={carrito.length === 0 || guardando}
        className="bg-wine text-paper text-sm rounded px-5 py-2.5 hover:bg-wine-mid transition-colors disabled:opacity-40 mb-8"
      >
        {guardando ? 'Registrando…' : 'Registrar venta'}
      </button>

      {/* Historial reciente */}
      <h2 className="font-display text-lg text-ink mb-3">Últimas ventas</h2>
      <div className="space-y-2">
        {ventas.length === 0 && <p className="text-sm text-ink-light">Todavía no hay ventas cargadas.</p>}
        {ventas.map((v) => {
          const canalInfo = CANALES.find((c) => c.key === v.canal)
          return (
            <div key={v.id} className={`rounded-xl border p-3.5 ${v.estado === 'cancelada' ? 'border-rule bg-paper/50 opacity-60' : 'border-rule bg-paper-card'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs text-ink-mid">
                  {canalInfo && <canalInfo.icon size={12} />} {canalInfo?.label || v.canal}
                  {v.cliente_nombre && ` · ${v.cliente_nombre}`}
                  {v.estado === 'cancelada' && <span className="text-coral ml-1">(cancelada)</span>}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink">{money(v.total_venta)}</span>
                  {v.estado === 'confirmada' && (
                    <button onClick={() => cancelarVenta(v)} className="text-ink-light hover:text-coral"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              <p className="text-xs text-ink-light">
                {(v.venta_items || []).map((it) => `${it.cantidad}× ${it.productos?.nombre}`).join(', ')}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
