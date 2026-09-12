import { Link } from 'react-router-dom'
import { Package, Boxes, ShoppingBag, Truck, Wallet, ArrowLeft, ArrowUpRight } from 'lucide-react'

const modulos = [
  { to: '/stock-productos', icon: Boxes, titulo: 'Stock', descripcion: 'Catálogo completo — SKU propio, código de fábrica, lotes de importación.', gradient: 'from-blue-dark to-blue', disponible: true },
  { to: '/gastos?unidad=productos', icon: Wallet, titulo: 'Gastos', descripcion: 'Marketing, legales, compras de producto — los gastos de esta unidad.', gradient: 'from-wine-mid to-wine', disponible: true },
  { to: '/productos/ventas', icon: ShoppingBag, titulo: 'Ventas', descripcion: 'E-commerce propio, Mercado Libre y B2B directo — todavía no existe.', gradient: 'from-orange to-coral', disponible: false },
  { to: '/productos/compras', icon: Truck, titulo: 'Compras', descripcion: 'Pedidos a fábricas de China — todavía no existe.', gradient: 'from-terracota to-brown', disponible: false },
]

export default function ProductosHub() {
  return (
    <div>
      <Link to="/" className="flex items-center gap-1.5 text-xs text-ink-mid hover:text-wine mb-4 w-fit">
        <ArrowLeft size={13} /> Volver al panel
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-dark to-blue shadow-sm">
          <Package size={21} className="text-paper" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-light">Unidad de negocio</p>
          <h1 className="font-display text-2xl text-ink">Productos</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulos.map((m) => {
          const card = (
            <div
              className={`group relative h-full rounded-2xl p-6 border overflow-hidden transition-all duration-300 ${
                m.disponible
                  ? 'border-rule bg-paper-card hover:-translate-y-1 hover:shadow-xl hover:border-transparent cursor-pointer'
                  : 'border-rule bg-paper-card opacity-60'
              }`}
            >
              {m.disponible && (
                <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${m.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              )}
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${m.gradient} shadow-sm`}>
                <m.icon size={19} className="text-paper" strokeWidth={1.75} />
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="font-display text-base text-ink">{m.titulo}</h3>
                {m.disponible ? (
                  <ArrowUpRight size={15} className="text-ink-light opacity-0 group-hover:opacity-100 group-hover:text-orange transition-all duration-300" />
                ) : (
                  <span className="text-[9px] uppercase tracking-wide text-ink-light border border-rule rounded-full px-2 py-0.5 whitespace-nowrap">Próximamente</span>
                )}
              </div>
              <p className="text-xs text-ink-mid leading-snug">{m.descripcion}</p>
            </div>
          )
          return m.disponible ? (
            <Link key={m.to} to={m.to} className="block h-full">{card}</Link>
          ) : (
            <div key={m.to} className="h-full">{card}</div>
          )
        })}
      </div>
    </div>
  )
}
