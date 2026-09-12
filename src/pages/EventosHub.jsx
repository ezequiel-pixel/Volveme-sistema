import { Link } from 'react-router-dom'
import {
  FileText, CalendarDays, Coffee, Users, PackageSearch, Wrench, Building2,
  ShoppingCart, Receipt, Wallet, Sliders, ArrowLeft, ArrowUpRight,
} from 'lucide-react'

const modulos = [
  { to: '/cotizaciones', icon: FileText, titulo: 'Cotizaciones', descripcion: 'Cargá las variables del evento y calculá el precio en vivo.', gradient: 'from-coral to-orange' },
  { to: '/eventos', icon: CalendarDays, titulo: 'Eventos', descripcion: 'Agenda de eventos confirmados. Se crean solos al aceptar una cotización.', gradient: 'from-orange to-terracota' },
  { to: '/cafe-del-mes', icon: Coffee, titulo: 'Café del mes', descripcion: 'El café que se está usando en barra este mes.', gradient: 'from-wine to-wine-mid' },
  { to: '/staff', icon: Users, titulo: 'Staff', descripcion: 'Baristas y equipo: roles, contacto, WhatsApp y Mercado Pago.', gradient: 'from-blue to-blue-dark' },
  { to: '/stock', icon: PackageSearch, titulo: 'Stock', descripcion: 'Café, leche, vasos y descartables. Alerta de stock mínimo.', gradient: 'from-blue-dark to-wine' },
  { to: '/equipamiento', icon: Wrench, titulo: 'Equipamiento', descripcion: 'Máquinas y molinos propios y de alquiler, tarifas de cotización.', gradient: 'from-terracota to-brown' },
  { to: '/proveedores', icon: Building2, titulo: 'Proveedores', descripcion: 'Contactos, forma de pago y qué le compra Volveme a cada uno.', gradient: 'from-ink-light to-ink-mid' },
  { to: '/compras', icon: ShoppingCart, titulo: 'Compras', descripcion: 'Órdenes a proveedores. Al recibirlas, suma stock solo.', gradient: 'from-coral to-wine' },
  { to: '/facturacion', icon: Receipt, titulo: 'Facturación', descripcion: 'Cobros a clientes, pagos a staff, proveedores y logística.', gradient: 'from-orange to-coral' },
  { to: '/gastos?unidad=barra_cafe', icon: Wallet, titulo: 'Gastos', descripcion: 'Sueldos, marketing, legales — los gastos de la unidad Eventos.', gradient: 'from-wine-mid to-wine' },
  { to: '/config', icon: Sliders, titulo: 'Config', descripcion: 'Parámetros del motor de precios: multiplicador, IVA, amortización.', gradient: 'from-blue to-ink-mid' },
]

export default function EventosHub() {
  return (
    <div>
      <Link to="/" className="flex items-center gap-1.5 text-xs text-ink-mid hover:text-wine mb-4 w-fit">
        <ArrowLeft size={13} /> Volver al panel
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-wine to-orange shadow-sm">
          <Coffee size={21} className="text-paper" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light">Unidad de negocio</p>
          <h1 className="font-display text-2xl text-ink">Eventos</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulos.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="group relative rounded-2xl p-6 border border-rule bg-paper-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-transparent block"
          >
            <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${m.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${m.gradient} shadow-sm`}>
              <m.icon size={19} className="text-paper" strokeWidth={1.75} />
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-display text-base text-ink">{m.titulo}</h3>
              <ArrowUpRight size={15} className="text-ink-light opacity-0 group-hover:opacity-100 group-hover:text-orange transition-all duration-300" />
            </div>
            <p className="text-xs text-ink-mid leading-snug">{m.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
