import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Eventos from './pages/Eventos'
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
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/eventos" element={<Eventos />} />
        <Route path="/cotizaciones" element={<ComingSoon title="Cotizaciones" />} />
        <Route path="/staff" element={<ComingSoon title="Staff" />} />
        <Route path="/equipamiento" element={<ComingSoon title="Equipamiento" />} />
        <Route path="/stock" element={<ComingSoon title="Insumos y Stock" />} />
        <Route path="/compras" element={<ComingSoon title="Compras" />} />
        <Route path="/facturacion" element={<ComingSoon title="Facturación y Pagos" />} />
        <Route path="/productos" element={<ComingSoon title="Productos" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
