import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  CalendarDays,
  FileText,
  Users,
  Coffee,
  PackageSearch,
  ShoppingCart,
  Receipt,
  Store,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'

const modules = [
  {
    to: '/cotizaciones',
    icon: FileText,
    title: 'Cotizaciones',
    description: 'Cargá las variables del evento, calculá el precio en vivo y confirmá.',
    status: 'disponible',
    gradient: 'from-coral to-orange',
    glow: 'hover:shadow-coral/20',
  },
  {
    to: '/eventos',
    icon: CalendarDays,
    title: 'Eventos',
    description: 'Se crean solos cuando una cotización se confirma. Agenda y estado.',
    status: 'disponible',
    gradient: 'from-orange to-terracota',
    glow: 'hover:shadow-orange/20',
  },
  {
    to: '/staff',
    icon: Users,
    title: 'Staff',
    description: 'Baristas y equipo: roles, contacto, WhatsApp y Mercado Pago.',
    status: 'disponible',
    gradient: 'from-blue to-blue-dark',
    glow: 'hover:shadow-blue/20',
  },
  {
    to: '/equipamiento',
    icon: Coffee,
    title: 'Equipamiento',
    description: 'Máquinas y molinos: estado y asignación a eventos.',
    status: 'proximamente',
    gradient: 'from-wine to-wine-mid',
    glow: 'hover:shadow-wine/20',
  },
  {
    to: '/stock',
    icon: PackageSearch,
    title: 'Insumos y Stock',
    description: 'Café, leche, vasos y descartables. Alerta de stock mínimo.',
    status: 'proximamente',
    gradient: 'from-blue-dark to-wine',
    glow: 'hover:shadow-blue-dark/20',
  },
  {
    to: '/compras',
    icon: ShoppingCart,
    title: 'Compras',
    description: 'Órdenes a proveedores. Al recibirlas, suma stock solo.',
    status: 'proximamente',
    gradient: 'from-coral to-wine',
    glow: 'hover:shadow-coral/20',
  },
  {
    to: '/facturacion',
    icon: Receipt,
    title: 'Facturación y Pagos',
    description: 'Comprobantes vinculados a cada evento y registro de cobros.',
    status: 'proximamente',
    gradient: 'from-terracota to-brown',
    glow: 'hover:shadow-terracota/20',
  },
  {
    to: '/productos',
    icon: Store,
    title: 'Productos',
    description: 'E-commerce de accesorios. Módulo separado, más adelante.',
    status: 'proximamente',
    gradient: 'from-ink-light to-ink-mid',
    glow: 'hover:shadow-ink-light/10',
    muted: true,
  },
]

const money = (n) =>
  (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export default function Dashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function cargarStats() {
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      const hoy = new Date().toISOString().slice(0, 10)
      const en7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

      const [cotizacionesRes, eventosRes, ingresosRes, baristasRes] = await Promise.all([
        supabase
          .from('cotizaciones')
          .select('id', { count: 'exact', head: true })
          .in('estado', ['enviada', 'negociacion']),
        supabase
          .from('eventos')
          .select('id', { count: 'exact', head: true })
          .gte('fecha', hoy)
          .lte('fecha', en7dias),
        supabase
          .from('cotizaciones')
          .select('precio_final')
          .eq('estado', 'aceptada')
          .gte('created_at', inicioMes.toISOString()),
        supabase
          .from('baristas')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'activo'),
      ])

      const ingresosMes = (ingresosRes.data || []).reduce((sum, r) => sum + (r.precio_final || 0), 0)

      setStats({
        cotizacionesActivas: cotizacionesRes.count ?? 0,
        eventosProximos: eventosRes.count ?? 0,
        ingresosMes,
        baristasActivos: baristasRes.count ?? null,
      })
    }
    cargarStats()
  }, [])

  return (
    <div className="relative">
      {/* fondo — degradé muy sutil de marca, apenas insinuado */}
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
      <h1 className="font-display text-4xl mb-8 leading-tight">
        <span className="bg-gradient-to-r from-wine via-wine to-orange bg-clip-text text-transparent">
          Volveme — Sistema
        </span>
      </h1>

      {/* KPIs en vivo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          icon={FileText}
          label="Cotizaciones activas"
          value={stats ? stats.cotizacionesActivas : '—'}
          accent="orange"
        />
        <StatCard
          icon={Clock}
          label="Eventos próx. 7 días"
          value={stats ? stats.eventosProximos : '—'}
          accent="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Ingresos del mes"
          value={stats ? money(stats.ingresosMes) : '—'}
          accent="wine"
          small
        />
        <StatCard
          icon={Users}
          label="Baristas activos"
          value={stats?.baristasActivos ?? '—'}
          accent="coral"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon
          const disponible = mod.status === 'disponible'

          const card = (
            <div
              className={`group relative h-full rounded-2xl p-6 border transition-all duration-300 overflow-hidden ${
                disponible
                  ? `border-rule bg-paper-card hover:border-transparent hover:-translate-y-1 hover:shadow-xl ${mod.glow} cursor-pointer`
                  : mod.muted
                  ? 'border-rule bg-paper-card opacity-45'
                  : 'border-rule bg-paper-card opacity-70'
              }`}
            >
              {disponible && (
                <div
                  className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${mod.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                />
              )}

              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-gradient-to-br ${mod.gradient} shadow-sm`}
              >
                <Icon size={21} className="text-paper" strokeWidth={1.75} />
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg text-ink">{mod.title}</h3>
                {disponible ? (
                  <ArrowUpRight
                    size={16}
                    className="text-ink-light opacity-0 group-hover:opacity-100 group-hover:text-orange transition-all duration-300"
                  />
                ) : (
                  <span className="text-[10px] uppercase tracking-wide text-ink-light border border-rule rounded-full px-2 py-0.5 whitespace-nowrap">
                    Próximamente
                  </span>
                )}
              </div>

              <p className="text-sm text-ink-mid leading-snug">{mod.description}</p>
            </div>
          )

          return disponible ? (
            <Link key={mod.to} to={mod.to} className="block h-full">
              {card}
            </Link>
          ) : (
            <div key={mod.to} className="h-full">
              {card}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const accentMap = {
  orange: { text: 'text-orange', ring: 'group-hover:shadow-orange/15', bar: 'from-orange to-coral' },
  blue: { text: 'text-blue', ring: 'group-hover:shadow-blue/15', bar: 'from-blue to-blue-dark' },
  wine: { text: 'text-wine', ring: 'group-hover:shadow-wine/15', bar: 'from-wine to-wine-mid' },
  coral: { text: 'text-coral', ring: 'group-hover:shadow-coral/15', bar: 'from-coral to-orange' },
}

function StatCard({ icon: Icon, label, value, accent, small }) {
  const a = accentMap[accent]
  return (
    <div
      className={`group relative rounded-2xl border border-rule bg-paper-card/70 backdrop-blur-sm p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${a.ring} overflow-hidden`}
    >
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${a.bar} opacity-60`} />
      <Icon size={16} className={`${a.text} mb-3`} strokeWidth={1.75} />
      <p className={`font-display ${small ? 'text-xl' : 'text-3xl'} text-ink leading-none mb-1.5`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-ink-light">{label}</p>
    </div>
  )
}
