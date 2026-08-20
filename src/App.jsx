import { Routes, Route, Navigate } from 'react-router-dom'
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
import Proveedores from './pages/Proveedores'
import Compras from './pages/Compras'
import Facturacion from './pages/Facturacion'
import Checklist from './pages/Checklist'
import Layout from './components/Layout'
import ComingSoon from './components/ComingSoon'

export default function App() {
  const { session, loading } = useAuth()

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

  return (
    <Routes>
      {/* Fuera del Layout: sin nav, para que la impresión/PDF salga limpia */}
      <Route path="/cotizaciones/:id/presupuesto" element={<Presupuesto />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/eventos" element={<Eventos />} />
        <Route path="/eventos/:id" element={<EventoDetalle />} />
        <Route path="/eventos/:id/ficha" element={<FichaOperativa />} />
        <Route path="/eventos/:id/checklist" element={<Checklist />} />
        <Route path="/cotizaciones" element={<Cotizaciones />} />
        <Route path="/cotizaciones/nueva" element={<NuevaCotizacion />} />
        <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
        <Route path="/cafe-del-mes" element={<CafeDelMes />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/equipamiento" element={<ComingSoon title="Equipamiento" />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/proveedores" element={<Proveedores />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/facturacion" element={<Facturacion />} />
        <Route path="/productos" element={<ComingSoon title="Productos" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
