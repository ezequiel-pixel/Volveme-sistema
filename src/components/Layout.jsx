import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/eventos', label: 'Eventos' },
  // Próximos módulos se agregan acá: Cotizaciones, Stock, Compras, Facturación…
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-paper">
      <nav className="border-b border-rule bg-paper">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-2">
          <span className="font-display text-base mr-6">Volveme</span>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `text-xs uppercase tracking-wide px-3 h-14 flex items-center border-b-2 transition-colors ${
                  isActive
                    ? 'border-orange text-ink'
                    : 'border-transparent text-ink-light hover:text-ink'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => supabase.auth.signOut()}
            className="ml-auto text-xs uppercase tracking-wide text-ink-light hover:text-coral transition-colors"
          >
            Salir
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
