import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import {
  Coffee, Package, ArrowUpRight, ArrowUp, ArrowDown, LineChart, Users, Globe,
  ShoppingBag, Store, TrendingUp,
} from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const moneyCorto = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buen día'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function Dashboard() {
  const { perfil } = useAuth()
  const verReportes = perfil?.rol !== 'operacion' && perfil?.rol !== 'logistica'
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function cargarStats() {
      const hoy = new Date().toISOString().slice(0, 10)
      const en7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      const hace6Meses = (() => {
        const d = new Date()
        d.setMonth(d.getMonth() - 5)
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
      })()

      const [eventosProximosRes, facturacionMensualRes, productosRes, eventosMesRes] = await Promise.all([
        supabase
          .from('eventos')
          .select('id, nombre, fecha, cantidad_personas, clientes(nombre)')
          .gte('fecha', hoy).lte('fecha', en7dias).in('estado', ['confirmado', 'realizado'])
          .order('fecha').limit(4),
        supabase.from('vw_reportes_facturacion_mensual').select('*').gte('mes', hace6Meses).order('mes'),
        supabase.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('eventos').select('id', { count: 'exact', head: true }).in('estado', ['confirmado', 'realizado']).gte('fecha', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
      ])

      const totalInvitados = (eventosProximosRes.data || []).reduce((s, e) => s + (Number(e.cantidad_personas) || 0), 0)
      const serieMensual = (facturacionMensualRes.data || []).map((f) => ({
        mes: MESES[new Date(f.mes + 'T00:00:00').getMonth()],
        total: Number(f.total_facturado),
      }))
      const mesActual = serieMensual.at(-1)?.total || 0
      const mesAnterior = serieMensual.at(-2)?.total || 0
      const variacionPct = mesAnterior > 0 ? ((mesActual - mesAnterior) / mesAnterior) * 100 : null

      setStats({
        eventosProximos: eventosProximosRes.data || [],
        totalInvitados,
        serieMensual,
        facturacionMes: mesActual,
        variacionPct,
        eventosEsteMes: eventosMesRes.count ?? 0,
        skusProductos: productosRes.count ?? 0,
      })
    }
    cargarStats()
  }, [])

  const subiendo = stats?.variacionPct != null && stats.variacionPct >= 0

  return (
    <div className="max-w-4xl mx-auto w-full py-4 sm:py-8">
      <p className="text-sm text-ink-light mb-1">{saludo()} — {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1 className="font-display text-3xl sm:text-5xl text-ink mb-8 sm:mb-10">Volveme</h1>

      {/* ============ HERO — tendencia de facturación, grande, con gráfico ============ */}
      <div className="rounded-3xl border border-rule bg-paper-card p-6 sm:p-8 mb-5 sm:mb-6 overflow-hidden relative">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-light mb-2 flex items-center gap-1.5">
              <TrendingUp size={13} /> Facturación este mes
            </p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <p className="font-display text-4xl sm:text-6xl text-ink leading-none">
                {stats ? moneyCorto(stats.facturacionMes) : '—'}
              </p>
              {stats?.variacionPct != null && (
                <span className={`flex items-center gap-1 text-sm font-medium rounded-full px-2.5 py-1 ${subiendo ? 'bg-teal-light text-teal-dark' : 'bg-coral-light text-coral'}`}>
                  {subiendo ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                  {Math.abs(stats.variacionPct).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-xs text-ink-light mt-2">
              {stats ? `${stats.eventosEsteMes} evento${stats.eventosEsteMes !== 1 ? 's' : ''} confirmado${stats.eventosEsteMes !== 1 ? 's' : ''} este mes` : '\u00A0'}
            </p>
          </div>
          {verReportes && (
            <Link to="/reportes" className="flex items-center gap-1.5 text-sm text-wine hover:gap-2.5 transition-all font-medium flex-shrink-0">
              Ver reportes completos <ArrowUpRight size={15} />
            </Link>
          )}
        </div>

        {stats && stats.serieMensual.length > 1 && (
          <div className="h-24 sm:h-28 -mx-2 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.serieMensual} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillFactu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6a1a" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#ff6a1a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  formatter={(v) => money(v)}
                  labelFormatter={(l) => l}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(61,42,46,0.09)' }}
                />
                <Area type="monotone" dataKey="total" stroke="#ff6a1a" strokeWidth={2.5} fill="url(#fillFactu)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ============ LOS DOS MUNDOS ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <Link
          to="/eventos-hub"
          className="group rounded-2xl border border-rule bg-paper-card p-6 transition-all duration-300 hover:border-ink/15 hover:shadow-soft-lg active:scale-[0.99] flex flex-col"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-peach/60 transition-colors duration-300 group-hover:bg-peach">
              <Coffee size={20} className="text-wine" strokeWidth={1.5} />
            </div>
            <ArrowUpRight size={18} strokeWidth={1.75} className="text-ink-light transition-all duration-300 group-hover:text-orange group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <h2 className="font-display text-xl text-ink mb-1">Eventos</h2>
          <p className="text-xs text-ink-light mb-5">Barra de café móvil</p>

          {!stats ? (
            <p className="text-xs text-ink-light">Cargando…</p>
          ) : stats.eventosProximos.length === 0 ? (
            <p className="text-sm text-ink-mid">Sin eventos esta semana.</p>
          ) : (
            <div className="space-y-2.5 flex-1">
              {stats.eventosProximos.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink truncate pr-2">{ev.clientes?.nombre || ev.nombre}</span>
                  <span className="flex items-center gap-1 text-ink-light text-xs flex-shrink-0">
                    <Users size={12} /> {ev.cantidad_personas || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-rule mt-5 pt-3 flex items-center justify-between">
            <span className="text-xs text-ink-light">
              {stats ? `${stats.eventosProximos.length} próximo${stats.eventosProximos.length !== 1 ? 's' : ''} esta semana` : '\u00A0'}
            </span>
            {stats && stats.totalInvitados > 0 && (
              <span className="text-xs text-ink-light">{stats.totalInvitados} invitados</span>
            )}
          </div>
        </Link>

        <Link
          to="/productos-hub"
          className="group rounded-2xl border border-rule bg-paper-card p-6 transition-all duration-300 hover:border-ink/15 hover:shadow-soft-lg active:scale-[0.99] flex flex-col"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-light/50 transition-colors duration-300 group-hover:bg-blue-light">
              <Package size={20} className="text-blue-dark" strokeWidth={1.5} />
            </div>
            <ArrowUpRight size={18} strokeWidth={1.75} className="text-ink-light transition-all duration-300 group-hover:text-blue group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <h2 className="font-display text-xl text-ink mb-1">Productos</h2>
          <p className="text-xs text-ink-light mb-5">E-commerce de accesorios</p>

          <div className="space-y-2.5 flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-ink-mid"><Globe size={13} /> E-commerce propio</span>
              <span className="text-ink-light text-xs">Sin ventas</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-ink-mid"><ShoppingBag size={13} /> Mercado Libre</span>
              <span className="text-ink-light text-xs">Sin ventas</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-ink-mid"><Store size={13} /> B2B directo</span>
              <span className="text-ink-light text-xs">Sin ventas</span>
            </div>
          </div>

          <div className="border-t border-rule mt-5 pt-3 flex items-center justify-between">
            <span className="text-xs text-ink-light">{stats ? `${stats.skusProductos} SKUs en catálogo` : '\u00A0'}</span>
            <span className="text-xs text-ink-light">$0 este mes</span>
          </div>
        </Link>
      </div>
    </div>
  )
}
