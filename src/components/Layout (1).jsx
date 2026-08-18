import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  LogOut, Menu, X,
  LayoutDashboard, FileText, CalendarDays, Coffee, Users, PackageSearch,
  ShoppingCart, Receipt,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { to: '/eventos', label: 'Eventos', icon: CalendarDays },
  { to: '/cafe-del-mes', label: 'Café del mes', icon: Coffee },
  { to: '/staff', label: 'Staff', icon: Users },
  { to: '/stock', label: 'Stock', icon: PackageSearch },
  { to: '/compras', label: 'Compras', icon: ShoppingCart },
  { to: '/facturacion', label: 'Facturación', icon: Receipt },
]

export default function Layout() {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Barra superior — solo en mobile, con botón para abrir el menú */}
      <div className="md:hidden sticky top-0 z-30 bg-paper-card border-b border-rule h-14 flex items-center justify-between px-4">
        <span className="font-display text-base text-ink">Volveme</span>
        <button onClick={() => setAbierto(true)} className="text-ink-mid hover:text-ink">
          <Menu size={22} />
        </button>
      </div>

      {/* Fondo oscuro detrás del menú mobile, para cerrarlo tocando afuera */}
      {abierto && (
        <div className="md:hidden fixed inset-0 bg-ink/40 z-40" onClick={() => setAbierto(false)} />
      )}

      {/* Sidebar — fijo en desktop, panel deslizable en mobile */}
      <aside
        className={`
          bg-paper-card border-r border-rule w-64 flex-shrink-0 flex flex-col
          fixed md:sticky top-0 h-screen z-50 transition-transform duration-200
          ${abierto ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}
      >
        <div className="px-6 pt-6 pb-5 flex items-center justify-between">
          <div>
            <p className="font-display text-lg text-ink leading-none">Volveme</p>
            <p className="text-[11px] uppercase tracking-wide text-ink-light mt-1">Admin · Sistema</p>
          </div>
          <button onClick={() => setAbierto(false)} className="md:hidden text-ink-light hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setAbierto(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 text-sm font-medium px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-wine text-paper'
                      : 'text-ink-mid hover:bg-peach/50 hover:text-ink'
                  }`
                }
              >
                <Icon size={16} strokeWidth={2} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="px-3 pb-5 pt-3 border-t border-rule">
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2.5 text-sm font-medium text-ink-light hover:text-coral transition-colors px-3 py-2.5 rounded-lg hover:bg-coral-light w-full"
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-8 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
