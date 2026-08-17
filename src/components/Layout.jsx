import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/cotizaciones', label: 'Cotizaciones' },
  { to: '/eventos', label: 'Eventos' },
  { to: '/cafe-del-mes', label: 'Café del mes' },
  { to: '/staff', label: 'Staff' },
  // Próximos módulos se agregan acá: Stock, Compras, Facturación…
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-paper">
      <nav className="border-b border-rule bg-paper">
        <div className="max-w-5xl mx-auto pl-4 sm:pl-6 h-14 flex items-center gap-2">
          <span className="font-display text-base mr-3 sm:mr-6 flex-shrink-0">Volveme</span>

          {/* Los links scrollean horizontal en mobile en vez de romper el
              layout — así entran los 4 sin apretarse ni desbordar la
              pantalla. "Salir" queda afuera del scroll, siempre visible. */}
          <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `text-xs uppercase tracking-wide px-3 h-14 flex items-center border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                    isActive
                      ? 'border-orange text-ink'
                      : 'border-transparent text-ink-light hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="flex-shrink-0 text-xs uppercase tracking-wide text-ink-light hover:text-coral transition-colors px-4 sm:px-0"
          >
            Salir
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
