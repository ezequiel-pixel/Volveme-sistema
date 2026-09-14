import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Ship, Package, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'

const money = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`)
const moneyUsd = (n) => (n == null ? '—' : `US$ ${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`)

export default function Importacion() {
  const [gastos, setGastos] = useState([])
  const [multiplicadores, setMultiplicadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    const [{ data: g, error: err1 }, { data: m, error: err2 }] = await Promise.all([
      supabase.from('gastos_generales').select('*').eq('unidad_negocio', 'productos')
        .or('categoria.ilike.Importación%,categoria.eq.Compra de mercadería')
        .order('fecha'),
      supabase.from('multiplicadores_landed_categoria').select('*').order('multiplicador', { ascending: false }),
    ])
    if (err1 || err2) { setError((err1 || err2).message); setLoading(false); return }
    setGastos(g || [])
    setMultiplicadores(m || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  if (loading) return <p className="text-sm text-ink-light py-12 text-center">Cargando…</p>

  if (error) {
    return (
      <div className="border border-coral rounded-lg p-5 bg-coral-light max-w-xl">
        <p className="text-sm font-medium text-coral mb-2">No se pudo cargar Importación</p>
        <p className="text-xs font-mono bg-paper border border-rule rounded p-2 mb-3 overflow-x-auto">{error}</p>
        <p className="text-xs text-ink-mid">Esto casi siempre significa que el SQL del módulo todavía no se corrió en Supabase.</p>
      </div>
    )
  }

  const mercaderia = gastos.filter((g) => g.categoria === 'Compra de mercadería')
  const despacho = gastos.filter((g) => g.categoria !== 'Compra de mercadería')

  const totalMercaderiaUsd = mercaderia.reduce((s, g) => s + Number(g.monto_usd || 0), 0)
  const totalDespachoUsd = despacho.reduce((s, g) => s + Number(g.monto_usd || 0), 0)
  const totalUsd = totalMercaderiaUsd + totalDespachoUsd
  const multiplicadorBlended = totalMercaderiaUsd > 0 ? totalUsd / totalMercaderiaUsd : 0

  // Agrupa despacho por categoría de gasto
  const porCategoria = {}
  for (const g of despacho) {
    const cat = g.categoria
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(g.monto_usd || 0)
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Módulo Productos</p>
        <h1 className="font-display text-2xl flex items-center gap-2"><Ship size={20} className="text-wine" /> Importación</h1>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl p-4 sm:p-5 bg-paper-warm/60">
          <p className="font-display text-xl sm:text-2xl text-ink">{moneyUsd(totalMercaderiaUsd)}</p>
          <p className="text-[11px] sm:text-xs text-ink-mid mt-1">Mercadería (EXW China)</p>
        </div>
        <div className="rounded-2xl p-4 sm:p-5 bg-coral-light">
          <p className="font-display text-xl sm:text-2xl text-coral">{moneyUsd(totalDespachoUsd)}</p>
          <p className="text-[11px] sm:text-xs text-ink-mid mt-1">Despacho / nacionalización</p>
        </div>
        <div className="rounded-2xl p-4 sm:p-5 bg-peach/50">
          <p className="font-display text-xl sm:text-2xl text-wine">{multiplicadorBlended.toFixed(2)}x</p>
          <p className="text-[11px] sm:text-xs text-ink-mid mt-1">Multiplicador blended (todo cash-out)</p>
        </div>
      </div>

      <div className="rounded-2xl bg-blue-light/30 p-4 sm:p-5 mb-6 flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-blue-dark flex-shrink-0 mt-0.5" />
        <p className="text-xs text-ink-mid">
          El multiplicador de arriba es <strong>todo lo pagado</strong> (incluye IVA y otros impuestos recuperables). Para precios, el módulo <strong>Precios</strong> usa el multiplicador ya corregido por categoría — con los impuestos recuperables descontados, según el desglose real de Marina Trade.
        </p>
      </div>

      {/* Desglose de despacho por categoría de gasto */}
      <div className="rounded-2xl bg-paper-card border border-rule p-5 sm:p-6 mb-6">
        <p className="text-sm font-medium text-ink mb-4">Despacho, por tipo de gasto</p>
        <div className="space-y-3">
          {Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).map(([cat, monto]) => {
            const pct = totalDespachoUsd > 0 ? (monto / totalDespachoUsd) * 100 : 0
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="text-ink">{cat.replace('Importación - ', '')}</span>
                  <span className="text-ink-light">{moneyUsd(monto)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-paper-warm overflow-hidden">
                  <div className="h-full rounded-full bg-coral" style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Multiplicador por categoría de producto */}
      <div className="rounded-2xl bg-paper-card border border-rule p-5 sm:p-6 mb-6">
        <p className="text-sm font-medium text-ink mb-1">Multiplicador landed, por categoría de producto</p>
        <p className="text-xs text-ink-light mb-4">Del presupuesto de Marina Trade, corregido a los gastos reales — usado en el módulo Precios.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {multiplicadores.map((m) => (
            <div key={m.categoria} className="flex items-center justify-between text-sm py-1 border-b border-rule/60">
              <span className="text-ink-mid">
                <span className="font-mono text-xs text-wine mr-2">{m.categoria}</span>
                {m.categoria_broker}
              </span>
              <span className={`font-medium ${m.multiplicador >= 2.5 ? 'text-coral' : 'text-ink'}`}>{m.multiplicador.toFixed(2)}x</span>
            </div>
          ))}
        </div>
      </div>

      {/* Historial de gastos de este pedido */}
      <div className="rounded-2xl bg-paper-card border border-rule overflow-hidden">
        <p className="text-sm font-medium text-ink px-5 pt-4 pb-3">Gastos de este pedido (GC20260307S)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-light">
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Concepto</th>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium text-right">USD</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id} className="border-b border-rule last:border-0">
                <td className="px-4 py-2 text-ink-light text-xs">{g.fecha ? new Date(g.fecha).toLocaleDateString('es-AR') : '—'}</td>
                <td className="px-4 py-2 text-ink">{g.descripcion}</td>
                <td className="px-4 py-2 text-ink-mid text-xs">{g.evento_o_cliente || '—'}</td>
                <td className="px-4 py-2 text-right font-medium text-ink">{moneyUsd(g.monto_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
