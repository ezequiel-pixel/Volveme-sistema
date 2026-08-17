import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut } from 'lucide-react'

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
      {/* Nav "vidrio flotante" — sticky, con blur y una sombra cálida
          muy sutil en vez del borde duro de antes. La pestaña activa
          ahora es una píldora rellena (wine), no un subrayado. */}
      <nav className="sticky top-0 z-20 bg-paper/80 backdrop-blur-md border-b border-rule">
        <div className="max-w-5xl mx-auto pl-4 sm:pl-6 h-14 flex items-center gap-2">
          <span className="font-display text-base mr-2 sm:mr-5 flex-shrink-0 text-ink">Volveme</span>

          {/* Los links scrollean horizontal en mobile en vez de romper el
              layout — así entran todos sin apretarse ni desbordar la
              pantalla. "Salir" queda afuera del scroll, siempre visible. */}
          <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `text-xs font-medium tracking-wide px-3.5 h-9 flex items-center rounded-full transition-colors flex-shrink-0 whitespace-nowrap ${
                    isActive
                      ? 'bg-wine text-paper'
                      : 'text-ink-mid hover:bg-peach/50 hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-ink-light hover:text-coral transition-colors px-4 sm:px-0"
          >
            <LogOut size={13} /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
