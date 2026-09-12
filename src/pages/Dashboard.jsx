import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { Coffee, Package, ArrowUpRight, LineChart } from 'lucide-react'

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
        supabase.from('eventos').select('id', { count: 'exact', head: true }).gte('fecha', hoy).lte('fecha', en7dias).in('estado', ['confirmado', 'realizado']),
        supabase.from('pagos').select('monto').not('evento_id', 'is', null).is('staff_id', null).is('proveedor_id', null).is('compra_id', null).gte('fecha', inicioMes),
        supabase.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
      ])

      setStats({
        eventosProximos: eventosProximosRes.count ?? 0,
        facturacionMes: (facturacionMesRes.data || []).reduce((s, p) => s + Number(p.monto), 0),
        skusProductos: productosRes.count ?? 0,
      })
    }
    cargarStats()
  }, [])

  return (
    <div className="min-h-[80vh] flex flex-col justify-center max-w-2xl mx-auto w-full py-8 sm:py-0">
      <h1 className="font-display text-3xl sm:text-4xl text-ink mb-10 sm:mb-14 text-center sm:text-left">
        Volveme
      </h1>

      <div className="space-y-3 sm:space-y-4">
        <BloqueUnidad
          to="/eventos-hub"
          icon={Coffee}
          titulo="Eventos"
          stat={stats ? `${stats.eventosProximos} próximos esta semana` : null}
        />
        <BloqueUnidad
          to="/productos-hub"
          icon={Package}
          titulo="Productos"
          stat={stats ? `${stats.skusProductos} SKUs en catálogo` : null}
        />
      </div>

      {verReportes && (
        <Link
          to="/reportes"
          className="group flex items-center gap-3 mt-8 sm:mt-10 py-3 px-1 text-ink-mid hover:text-ink transition-colors"
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

function BloqueUnidad({ to, icon: Icon, titulo, stat }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 sm:gap-5 rounded-2xl border border-rule bg-paper-card px-5 sm:px-7 py-5 sm:py-6 transition-all duration-300 hover:border-ink/15 hover:shadow-soft-lg active:scale-[0.99]"
    >
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-peach/60 flex-shrink-0 transition-colors duration-300 group-hover:bg-peach">
        <Icon size={22} className="text-wine" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-display text-xl sm:text-2xl text-ink leading-tight">{titulo}</h2>
        <p className="text-xs sm:text-sm text-ink-light mt-0.5 h-5">{stat || '\u00A0'}</p>
      </div>
      <ArrowUpRight
        size={20}
        strokeWidth={1.75}
        className="text-ink-light flex-shrink-0 transition-all duration-300 group-hover:text-orange group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </Link>
  )
}
