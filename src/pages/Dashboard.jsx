import { Link } from 'react-router-dom'
import {
  CalendarDays,
  FileText,
  Users,
  Coffee,
  PackageSearch,
  ShoppingCart,
  Receipt,
  Store,
} from 'lucide-react'

const modules = [
  {
    to: '/eventos',
    icon: CalendarDays,
    title: 'Eventos',
    description: 'Agenda, estado de cada evento y disponibilidad de fechas.',
    status: 'disponible',
    color: 'accent',
  },
  {
    to: '/cotizaciones',
    icon: FileText,
    title: 'Cotizaciones',
    description: 'Armá el presupuesto de un evento y generá el PDF.',
    status: 'proximamente',
    color: 'coral',
  },
  {
    to: '/staff',
    icon: Users,
    title: 'Staff',
    description: 'Baristas y equipo: roles, contacto, disponibilidad.',
    status: 'proximamente',
    color: 'teal',
  },
  {
    to: '/equipamiento',
    icon: Coffee,
    title: 'Equipamiento',
    description: 'Máquinas y molinos: estado y asignación a eventos.',
    status: 'proximamente',
    color: 'accent',
  },
  {
    to: '/stock',
    icon: PackageSearch,
    title: 'Insumos y Stock',
    description: 'Café, leche, vasos y descartables. Alerta de stock mínimo.',
    status: 'proximamente',
    color: 'teal',
  },
  {
    to: '/compras',
    icon: ShoppingCart,
    title: 'Compras',
    description: 'Órdenes a proveedores. Al recibirlas, suma stock solo.',
    status: 'proximamente',
    color: 'coral',
  },
  {
    to: '/facturacion',
    icon: Receipt,
    title: 'Facturación y Pagos',
    description: 'Comprobantes vinculados a cada evento y registro de cobros.',
    status: 'proximamente',
    color: 'accent',
  },
  {
    to: '/productos',
    icon: Store,
    title: 'Productos',
    description: 'E-commerce de accesorios. Módulo separado, más adelante.',
    status: 'proximamente',
    color: 'ink-light',
    muted: true,
  },
]

const colorMap = {
  accent: { bg: 'bg-peach', text: 'text-orange' },
  teal: { bg: 'bg-blue-light', text: 'text-blue-dark' },
  coral: { bg: 'bg-coral-light', text: 'text-coral' },
  'ink-light': { bg: 'bg-paper-warm', text: 'text-ink-light' },
}

export default function Dashboard() {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-light mb-1">Panel</p>
      <h1 className="font-display text-3xl mb-8">Volveme — Sistema</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon
          const colors = colorMap[mod.color]
          const disponible = mod.status === 'disponible'

          const card = (
            <div
              className={`group h-full border border-rule rounded-lg p-5 bg-paper-card transition-all ${
                disponible
                  ? 'hover:border-ink hover:shadow-sm cursor-pointer'
                  : mod.muted
                  ? 'opacity-50'
                  : 'opacity-80'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${colors.bg}`}>
                <Icon size={19} className={colors.text} strokeWidth={1.75} />
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <h3 className="font-medium text-ink">{mod.title}</h3>
                {!disponible && (
                  <span className="text-[10px] uppercase tracking-wide text-ink-light border border-rule rounded-full px-2 py-0.5">
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
