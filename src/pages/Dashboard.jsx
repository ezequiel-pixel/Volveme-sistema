import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Coffee, Package, ArrowRight, Sparkles, BarChart3 } from 'lucide-react'

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export default function Dashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function cargarStats() {
      const hoy = new Date().toISOString().slice(0, 10)
      const en7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

      const [eventosProximosRes, cotizacionesRes, facturacionMesRes, productosRes] = await Promise.all([
        supabase.from('eventos').select('id', { count: 'exact', head: true }).gte('fecha', hoy).lte('fecha', en7dias).in('estado', ['confirmado', 'realizado']),
        supabase.from('cotizaciones').select('id', { count: 'exact', head: true }).in('estado', ['enviada', 'negociacion']),
        supabase.from('pagos').select('monto').not('evento_id', 'is', null).is('staff_id', null).is('proveedor_id', null).is('compra_id', null).gte('fecha', inicioMes),
        supabase.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
      ])

      setStats({
        eventosProximos: eventosProximosRes.count ?? 0,
        cotizacionesActivas: cotizacionesRes.count ?? 0,
        facturacionMes: (facturacionMesRes.data || []).reduce((s, p) => s + Number(p.monto), 0),
        skusProductos: productosRes.count ?? 0,
      })
    }
    cargarStats()
  }, [])

  return (
    <div className="relative">
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 900px 500px at 15% -5%, rgba(255,106,26,0.06), transparent 60%),' +
            'radial-gradient(ellipse 700px 500px at 100% 10%, rgba(63,107,255,0.05), transparent 60%)',
        }}
      />

      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={13} className="text-orange" />
        <p className="text-xs uppercase tracking-[0.15em] text-ink-light font-medium">Panel</p>
      </div>
      <h1 className="font-display text-4xl mb-10 leading-tight">
        <span className="bg-gradient-to-r from-wine via-wine to-orange bg-clip-text text-transparent">
          Volveme — Sistema
        </span>
      </h1>

      {/* Los dos bloques principales — todo el sistema vive adentro de
          uno de estos dos. Reportes es lo único que cruza las dos
          unidades, por eso tiene su propio acceso chico aparte, no un
          bloque grande como estos. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <BloqueUnidad
          to="/eventos-hub"
          icon={Coffee}
          titulo="Eventos"
          subtitulo="Barra de café móvil"
          gradient="from-wine to-orange"
          kpis={stats ? [
            { label: 'Próx. 7 días', valor: stats.eventosProximos },
            { label: 'Cotizaciones activas', valor: stats.cotizacionesActivas },
            { label: 'Facturado este mes', valor: money(stats.facturacionMes), ancho: true },
          ] : null}
        />
        <BloqueUnidad
          to="/productos-hub"
          icon={Package}
          titulo="Productos"
          subtitulo="E-commerce de accesorios"
          gradient="from-blue-dark to-blue"
          kpis={stats ? [
            { label: 'SKUs en catálogo', valor: stats.skusProductos },
            { label: 'Ventas cargadas', valor: '—' },
            { label: 'Facturado este mes', valor: '—', ancho: true },
          ] : null}
        />
      </div>

      {/* Reportes — el único acceso compartido, chico y aparte a propósito */}
      <Link
        to="/reportes"
        className="group flex items-center gap-4 rounded-xl border border-rule bg-paper-card p-5 hover:border-transparent hover:shadow-lg transition-all duration-300"
      >
        <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-gradient-to-br from-ink to-ink-mid flex-shrink-0">
          <BarChart3 size={19} className="text-paper" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <p className="font-display text-base text-ink">Reportes</p>
          <p className="text-xs text-ink-mid">Facturación, gastos y utilidad — Eventos, Productos y el total de la empresa, todo junto acá.</p>
        </div>
        <ArrowRight size={16} className="text-ink-light opacity-0 group-hover:opacity-100 group-hover:text-orange transition-all duration-300 flex-shrink-0" />
      </Link>
    </div>
  )
}

function BloqueUnidad({ to, icon: Icon, titulo, subtitulo, gradient, kpis }) {
  return (
    <Link
      to={to}
      className="group relative rounded-2xl p-8 border border-rule bg-paper-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-transparent block"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient} opacity-70 group-hover:opacity-100 transition-opacity`} />
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br ${gradient} shadow-md`}>
        <Icon size={28} className="text-paper" strokeWidth={1.75} />
      </div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-2xl text-ink">{titulo}</h2>
        <ArrowRight size={20} className="text-ink-light opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:text-orange transition-all duration-300" />
      </div>
      <p className="text-sm text-ink-mid mb-6">{subtitulo}</p>

      {kpis ? (
        <div className="grid grid-cols-3 gap-3 pt-5 border-t border-rule">
          {kpis.map((k) => (
            <div key={k.label} className={k.ancho ? 'col-span-1' : ''}>
              <p className={`font-display text-ink leading-none mb-1 ${String(k.valor).length > 6 ? 'text-base' : 'text-xl'}`}>{k.valor}</p>
              <p className="text-[10px] uppercase tracking-wide text-ink-light">{k.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="pt-5 border-t border-rule">
          <p className="text-xs text-ink-light">Cargando…</p>
        </div>
      )}
    </Link>
  )
}
