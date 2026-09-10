import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import OfflineBanner from './components/OfflineBanner'
import Login from './pages/Login'
import Insumos from './pages/Insumos'
import Recetas from './pages/Recetas'
import Pedidos from './pages/Pedidos'
import Gastos from './pages/Gastos'
import Turnos from './pages/Turnos'
import Balance from './pages/Balance'
import CuentasSocios from './pages/CuentasSocios'
import Mas from './pages/Mas'

export default function App() {
  const { session, cargando } = useAuth()

  if (cargando) {
    return <div className="cargando">Cargando...</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="app-shell">
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<Navigate to="/pedidos" replace />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="/recetas" element={<Recetas />} />
        <Route path="/insumos" element={<Insumos />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/balance" element={<Balance />} />
        <Route path="/turnos" element={<Turnos />} />
        <Route path="/cuentas" element={<CuentasSocios />} />
        <Route path="/mas" element={<Mas />} />
        <Route path="*" element={<Navigate to="/pedidos" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
