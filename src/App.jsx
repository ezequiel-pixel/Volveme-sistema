import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './lib/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Eventos from './pages/Eventos'
import EventoDetalle from './pages/EventoDetalle'
import FichaOperativa from './pages/FichaOperativa'
import Cotizaciones from './pages/Cotizaciones'
import CotizacionDetalle from './pages/CotizacionDetalle'
import NuevaCotizacion from './pages/NuevaCotizacion'
import Presupuesto from './pages/Presupuesto'
import CafeDelMes from './pages/CafeDelMes'
import Staff from './pages/Staff'
import Stock from './pages/Stock'
import Equipamiento from './pages/Equipamiento'
import Proveedores from './pages/Proveedores'
import Compras from './pages/Compras'
import Facturacion from './pages/Facturacion'
import Config from './pages/Config'
import Reportes from './pages/Reportes'
import Gastos from './pages/Gastos'
import StockProductos from './pages/StockProductos'
import EventosHub from './pages/EventosHub'
import ProductosHub from './pages/ProductosHub'
import MisEventos from './pages/MisEventos'
import Usuarios from './pages/Usuarios'
import Checklist from './pages/Checklist'
import Layout from './components/Layout'
import ComingSoon from './components/ComingSoon'

// Qué puede ver cada rol. superadmin no tiene entrada — se resuelve
// "true" antes de mirar esto. El resto son funciones (path) => boolean.
// Cada rol tiene además su "inicio" — a dónde lo mandamos si intenta
// entrar a algo que no le toca (o a "/" directamente).
const PERMISOS_POR_ROL = {
  operacion: { inicio: '/', puede: (p) => !p.startsWith('/gastos') && !p.startsWith('/reportes') && !p.startsWith('/usuarios') },
  logistica: { inicio: '/productos-hub', puede: (p) => (p.startsWith('/productos-hub') || p.startsWith('/stock-productos') || p.startsWith('/gastos')) && !p.startsWith('/usuarios') },
  barista: { inicio: '/mis-eventos', puede: (p) => p.startsWith('/mis-eventos') || (p.startsWith('/eventos/') && p.endsWith('/ficha')) },
}

/** Envuelve todas las rutas protegidas y redirige si el rol actual no
 * puede ver la ruta a la que se intenta entrar. superadmin (o cualquier
 * rol no reconocido, por seguridad de que no se rompa nada si falta el
 * perfil) pasa siempre. */
function ControlDeAcceso({ rol, children }) {
  const location = useLocation()
  const reglas = PERMISOS_POR_ROL[rol]
  if (!reglas) return children // superadmin, o perfil sin cargar todavía

  if (!reglas.puede(location.pathname)) {
    return <Navigate to={reglas.inicio} replace />
  }
  return children
}

export default function App() {
  const { session, perfil, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-ink-light text-sm">
        Cargando…
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  const rol = perfil?.rol

  return (
    <ControlDeAcceso rol={rol}>
      <Routes>
        {/* Fuera del Layout: sin nav, para que la impresión/PDF salga limpia */}
        <Route path="/cotizaciones/:id/presupuesto" element={<Presupuesto />} />

        {/* Barista: layout mínimo, sin sidebar — no forma parte del
            Layout de siempre (esa pantalla ni siquiera debería
            enterarse de que existen Cotizaciones, Facturación, etc). */}
        <Route path="/mis-eventos" element={<MisEventos />} />

        <Route element={<Layout rol={rol} />}>
          <Route path="/" element={rol === 'barista' ? <Navigate to="/mis-eventos" replace /> : <Dashboard />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/eventos/:id" element={<EventoDetalle />} />
          <Route path="/eventos/:id/ficha" element={<FichaOperativa />} />
          <Route path="/eventos/:id/checklist" element={<Checklist />} />
          <Route path="/cotizaciones" element={<Cotizaciones />} />
          <Route path="/cotizaciones/nueva" element={<NuevaCotizacion />} />
          <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
          <Route path="/cafe-del-mes" element={<CafeDelMes />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/equipamiento" element={<Equipamiento />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/facturacion" element={<Facturacion />} />
          <Route path="/config" element={<Config />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/stock-productos" element={<StockProductos />} />
          <Route path="/eventos-hub" element={<EventosHub />} />
          <Route path="/productos-hub" element={<ProductosHub />} />
          <Route path="/productos" element={<ComingSoon title="Productos" />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ControlDeAcceso>
  )
}
