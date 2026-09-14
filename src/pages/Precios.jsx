import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Package, TrendingUp, AlertTriangle, Globe, ShoppingBag } from 'lucide-react'

const money = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`)
const pct = (n) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`)

export default function Precios() {
  const [productos, setProductos] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  async function cargar() {
    setLoading(true)
    setError(null)
    const [{ data: p, error: err1 }, { data: c, error: err2 }] = await Promise.all([
      supabase.from('vw_precios_por_canal').select('*').order('familia').order('sku_interno'),
      supabase.from('config_pricing_productos').select('*').eq('id', 1).single(),
    ])
    if (err1 || err2) { setError((err1 || err2).message); setLoading(false); return }
    setProductos(p || [])
    setConfig(c)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  if (loading) return <p className="text-sm text-ink-light py-12 text-center">Cargando…</p>

  if (error) {
    return (
      <div className="border border-coral rounded-lg p-5 bg-coral-light max-w-xl">
        <p className="text-sm font-medium text-coral mb-2">No se pudo cargar Precios</p>
        <p className="text-xs font-mono bg-paper border border-rule rounded p-2 mb-3 overflow-x-auto">{error}</p>
        <p className="text-xs text-ink-mid">Esto casi siempre significa que el SQL del módulo Precios todavía no se corrió en Supabase.</p>
      </div>
    )
  }

  const filtrados = productos.filter((p) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return `${p.sku_interno} ${p.codigo_proveedor || ''} ${p.nombre} ${p.variante || ''}`.toLowerCase().includes(q)
  })

  const promedioMargenML = productos.length ? productos.reduce((s, p) => s + (p.ml_margen_neto_pct || 0), 0) / productos.length : 0
  const promedioMargenEC = productos.length ? productos.reduce((s, p) => s + (p.ec_margen_neto_pct || 0), 0) / productos.length : 0

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Productos</p>
        <h1 className="font-display text-2xl">Precios por canal</h1>
      </div>

      {/* El hallazgo importante — ya no es un número único, es por categoría */}
      {productos.length > 0 && (() => {
        const mults = productos.map((p) => p.multiplicador_landed).filter((m) => m != null)
        const min = Math.min(...mults)
        const max = Math.max(...mults)
        return (
          <div className="rounded-2xl bg-coral-light p-5 sm:p-6 mb-6">
            <p className="text-sm font-medium text-coral mb-2 flex items-center gap-1.5">
              <AlertTriangle size={15} /> El multiplicador de importación varía mucho según el producto
            </p>
            <div className="flex items-baseline gap-3">
              <p className="font-display text-3xl text-ink">{min.toFixed(2)}x – {max.toFixed(2)}x</p>
              <p className="text-xs text-ink-mid">rango real por categoría — del más barato de nacionalizar al más caro (acrílico, muy por encima del resto). Detalle completo en <span className="text-coral font-medium">Importación</span>.</p>
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl p-4 sm:p-5 bg-blue-light/40">
          <p className="flex items-center gap-1.5 text-xs text-ink-mid mb-1"><Globe size={13} /> Margen neto promedio — E-commerce propio</p>
          <p className="font-display text-2xl text-blue-dark">{pct(promedioMargenEC)}</p>
        </div>
        <div className="rounded-2xl p-4 sm:p-5 bg-peach/50">
          <p className="flex items-center gap-1.5 text-xs text-ink-mid mb-1"><ShoppingBag size={13} /> Margen neto promedio — Mercado Libre</p>
          <p className="font-display text-2xl text-wine">{pct(promedioMargenML)}</p>
        </div>
      </div>

      <input
        className="input mb-2" placeholder="Buscar por código, nombre, variante…"
        value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
      />
      <p className="text-[11px] text-ink-light mb-4">
        <span className="text-orange">●</span> el ×3 no alcanzaba para el margen mínimo de esa categoría — el precio se subió para cubrirlo
      </p>

      <div className="border border-rule rounded-lg overflow-hidden bg-paper-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
              <th className="px-3 py-2.5 font-medium">Producto</th>
              <th className="px-3 py-2.5 font-medium text-right">Mult.</th>
              <th className="px-3 py-2.5 font-medium text-right">Costo landed</th>
              <th className="px-3 py-2.5 font-medium text-right">PVP</th>
              <th className="px-3 py-2.5 font-medium text-right bg-blue-light/20">EC neto</th>
              <th className="px-3 py-2.5 font-medium text-right bg-blue-light/20">EC %</th>
              <th className="px-3 py-2.5 font-medium text-right bg-peach/30">ML neto</th>
              <th className="px-3 py-2.5 font-medium text-right bg-peach/30">ML %</th>
              <th className="px-3 py-2.5 font-medium text-center">Mejor canal</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => {
              const mejorCanal = (p.ec_margen_neto_pct || 0) >= (p.ml_margen_neto_pct || 0) ? 'EC' : 'ML'
              return (
                <tr key={p.id} className="border-b border-rule last:border-0 hover:bg-paper/60">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-paper border border-rule flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {p.imagen_url ? <img src={p.imagen_url} alt="" className="w-full h-full object-contain p-0.5" /> : <Package size={14} className="text-ink-light" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-ink truncate">{p.nombre}{p.variante && <span className="text-ink-light"> · {p.variante}</span>}</p>
                        <p className="text-[10px] font-mono text-ink-light">{p.sku_interno}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-light text-xs">{p.multiplicador_landed?.toFixed(2)}x</td>
                  <td className="px-3 py-2.5 text-right text-ink-mid">{money(p.costo_landed_ars)}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-ink">
                    {money(p.pvp_base_ars)}
                    {p.uso_piso_margen && <span className="ml-1.5 text-[10px] text-orange" title={`Subido por piso de margen mínimo (${(p.margen_minimo_pct*100).toFixed(0)}%)`}>●</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right bg-blue-light/10">{money(p.ec_recibis_neto_ars)}</td>
                  <td className={`px-3 py-2.5 text-right bg-blue-light/10 font-medium ${p.ec_margen_neto_pct < 0.15 ? 'text-coral' : 'text-teal-dark'}`}>{pct(p.ec_margen_neto_pct)}</td>
                  <td className="px-3 py-2.5 text-right bg-peach/15">{money(p.ml_recibis_neto_ars)}</td>
                  <td className={`px-3 py-2.5 text-right bg-peach/15 font-medium ${p.ml_margen_neto_pct < 0.15 ? 'text-coral' : 'text-teal-dark'}`}>{pct(p.ml_margen_neto_pct)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${mejorCanal === 'EC' ? 'bg-blue-light text-blue-dark' : 'bg-peach text-orange'}`}>{mejorCanal}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
