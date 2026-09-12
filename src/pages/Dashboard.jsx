import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { Coffee, Package, ArrowUpRight, LineChart, Users, Globe, ShoppingBag, Store } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export default function Dashboard() {
  const { perfil } = useAuth()
  const verReportes = perfil?.rol !== 'operacion' && perfil?.rol !== 'logistica'
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function cargarStats() {
      const hoy = new Date().toISOString().slice(0, 10)
      const en7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

      const [eventosProximosRes, facturacionMesRes, productosRes] = await Promise.all([
        supabase
          .from('eventos')
          .select('id, nombre, fecha, cantidad_personas, clientes(nombre)')
          .gte('fecha', hoy).lte('fecha', en7dias).in('estado', ['confirmado', 'realizado'])
          .order('fecha').limit(3),
        supabase.from('pagos').select('monto').not('evento_id', 'is', null).is('staff_id', null).is('proveedor_id', null).is('compra_id', null).gte('fecha', inicioMes),
        supabase.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
      ])

      const totalInvitados = (eventosProximosRes.data || []).reduce((s, e) => s + (Number(e.cantidad_personas) || 0), 0)

      setStats({
        eventosProximos: eventosProximosRes.data || [],
        totalInvitados,
        facturacionMes: (facturacionMesRes.data || []).reduce((s, p) => s + Number(p.monto), 0),
        skusProductos: productosRes.count ?? 0,
      })
    }
    cargarStats()
  }, [])

  return (
    <div className="max-w-3xl mx-auto w-full py-4 sm:py-8">
      <h1 className="font-display text-3xl sm:text-4xl text-ink mb-8 sm:mb-10">Volveme</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* ---- EVENTOS ---- */}
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
              {stats ? `${stats.eventosProximos.length} próximo${stats.eventosProximos.length !== 1 ? 's' : ''}` : '\u00A0'}
            </span>
            {stats && stats.totalInvitados > 0 && (
              <span className="text-xs text-ink-light">{stats.totalInvitados} invitados en total</span>
            )}
          </div>
        </Link>

        {/* ---- PRODUCTOS ---- */}
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
            <span className="text-xs text-ink-light">{stats ? `${stats.skusProductos} SKUs` : '\u00A0'}</span>
            <span className="text-xs text-ink-light">$0 este mes</span>
          </div>
        </Link>
      </div>

      {verReportes && (
        <Link
          to="/reportes"
          className="group flex items-center gap-3 mt-6 py-3 px-1 text-ink-mid hover:text-ink transition-colors"
        >
          <LineChart size={16} strokeWidth={1.75} />
          <span className="text-sm">
            Reportes
            {stats && stats.facturacionMes > 0 && <span className="text-ink-light"> · {money(stats.facturacionMes)} este mes</span>}
          </span>
          <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
        </Link>
      )}
    </div>
  )
}
