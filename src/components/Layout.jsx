import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  LogOut, Menu, X, ChevronDown,
  Home, FileText, CalendarDays, Coffee, Users, Package, Wrench, Building2,
  ShoppingBag, Receipt, SlidersHorizontal, LineChart, Wallet, Boxes,
} from 'lucide-react'

// Los dos "mundos" del sistema — mismo tratamiento visual (ícono en
// cuadrado con degradé) que ya usan los bloques del Dashboard, para que
// se sienta la misma identidad en las dos pantallas. Dashboard y
// Reportes quedan afuera de esto a propósito: son los únicos puntos
// que no pertenecen a un solo mundo.
const grupos = [
  {
    key: 'eventos',
    label: 'Eventos',
    icon: Coffee,
    gradient: 'from-wine to-orange',
    items: [
      { to: '/cotizaciones', label: 'Cotizaciones', icon: FileText },
      { to: '/eventos', label: 'Eventos', icon: CalendarDays },
      { to: '/cafe-del-mes', label: 'Café del mes', icon: Coffee },
      { to: '/staff', label: 'Staff', icon: Users },
      { to: '/stock', label: 'Stock', icon: Package },
      { to: '/equipamiento', label: 'Equipamiento', icon: Wrench },
      { to: '/proveedores', label: 'Proveedores', icon: Building2 },
      { to: '/compras', label: 'Compras', icon: ShoppingBag },
      { to: '/facturacion', label: 'Facturación', icon: Receipt },
      { to: '/gastos?unidad=barra_cafe', label: 'Gastos', icon: Wallet },
      { to: '/config', label: 'Config', icon: SlidersHorizontal },
    ],
  },
  {
    key: 'productos',
    label: 'Productos',
    icon: Package,
    gradient: 'from-blue-dark to-blue',
    items: [
      { to: '/stock-productos', label: 'Stock', icon: Boxes },
      { to: '/gastos?unidad=productos', label: 'Gastos', icon: Wallet },
    ],
  },
]

function pathnameDe(to) {
  return to.split('?')[0]
}

export default function Layout() {
  const [abierto, setAbierto] = useState(false)
  const location = useLocation()

  // El grupo que contiene la ruta actual arranca desplegado solo —
  // así nunca te perdés preguntándote en qué mundo estás parado.
  const grupoActivo = grupos.find((g) => g.items.some((i) => pathnameDe(i.to) === location.pathname))?.key
  const [expandido, setExpandido] = useState(grupoActivo || 'eventos')

  useEffect(() => {
    if (grupoActivo) setExpandido(grupoActivo)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Barra superior — solo en mobile, con botón para abrir el menú */}
      <div className="md:hidden sticky top-0 z-30 bg-paper-card/90 backdrop-blur-md border-b border-rule h-14 flex items-center justify-between px-4">
        <span className="font-display text-base text-ink">Volveme</span>
        <button onClick={() => setAbierto(true)} className="text-ink-mid hover:text-ink">
          <Menu size={22} strokeWidth={1.75} />
        </button>
      </div>

      {/* Fondo oscuro detrás del menú mobile, para cerrarlo tocando afuera */}
      {abierto && (
        <div className="md:hidden fixed inset-0 bg-ink/40 backdrop-blur-sm z-40" onClick={() => setAbierto(false)} />
      )}

      {/* Sidebar — fijo en desktop, panel deslizable en mobile */}
      <aside
        className={`
          bg-paper-card/95 backdrop-blur-xl border-r border-rule w-72 flex-shrink-0 flex flex-col
          fixed md:sticky top-0 h-screen z-50 transition-transform duration-300 ease-out
          ${abierto ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}
      >
        <div className="px-5 pt-6 pb-5 flex items-center justify-between">
          <div>
            <p className="font-display text-xl text-ink leading-none">Volveme</p>
            <p className="text-[11px] text-ink-light mt-1">Sistema interno</p>
          </div>
          <button onClick={() => setAbierto(false)} className="md:hidden text-ink-light hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-3">
          {/* Dashboard — único ítem simple arriba de todo */}
          <FilaSimple to="/" label="Panel" icon={Home} end onClick={() => setAbierto(false)} />

          <div className="pt-2" />

          {/* Los dos mundos, en acordeón */}
          {grupos.map((g) => {
            const abiertoGrupo = expandido === g.key
            const GIcon = g.icon
            return (
              <div key={g.key} className="mb-1">
                <button
                  onClick={() => setExpandido(abiertoGrupo ? null : g.key)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-peach/40 transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${g.gradient} shadow-sm flex-shrink-0`}>
                    <GIcon size={15} className="text-paper" strokeWidth={1.75} />
                  </div>
                  <span className="font-display text-[15px] text-ink flex-1 text-left">{g.label}</span>
                  <ChevronDown
                    size={15}
                    strokeWidth={2}
                    className={`text-ink-light transition-transform duration-300 ${abiertoGrupo ? 'rotate-180' : ''}`}
                  />
                </button>

                <div
                  className={`grid transition-all duration-300 ease-out ${
                    abiertoGrupo ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="pl-[18px] ml-4 border-l border-rule mt-1.5 space-y-1 pb-1.5">
                      {g.items.map((item) => (
                        <FilaSimple key={item.to} to={item.to} label={item.label} icon={item.icon} onClick={() => setAbierto(false)} sub />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="pt-2" />

          {/* Reportes — el otro punto que no pertenece a un solo mundo.
              Le doy el mismo tratamiento de ícono-con-degradé que a los
              grupos (no un link plano como Panel) porque es el módulo
              que cruza toda la empresa — merece pesar lo mismo que
              "Eventos" o "Productos" en la jerarquía visual. */}
          <NavLink
            to="/reportes"
            onClick={() => setAbierto(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2 py-2 rounded-xl transition-colors ${
                isActive ? 'bg-wine text-paper' : 'hover:bg-peach/40 text-ink'
              }`
            }
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-ink to-ink-mid shadow-sm flex-shrink-0">
              <LineChart size={15} className="text-paper" strokeWidth={1.75} />
            </div>
            <span className="font-display text-[15px] flex-1 text-left">Reportes</span>
          </NavLink>
        </nav>

        <div className="px-3 pb-5 pt-3 border-t border-rule">
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2.5 text-sm font-medium text-ink-light hover:text-coral transition-colors px-3 py-2.5 rounded-lg hover:bg-coral-light w-full"
          >
            <LogOut size={16} strokeWidth={1.75} /> Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-8 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}

/** Una fila de navegación simple — se usa tanto para Panel (ítem suelto)
 * como para cada sub-ítem adentro de un grupo desplegado. "sub" la
 * indenta un toque menos de peso visual, pero mismo tamaño de texto
 * que el resto — no hace falta que se vea "menor". */
function FilaSimple({ to, label, icon: Icon, end, sub, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-wine text-paper' : 'text-ink-mid hover:bg-peach/40 hover:text-ink'
        }`
      }
    >
      <Icon size={16} strokeWidth={1.75} />
      {label}
    </NavLink>
  )
}
