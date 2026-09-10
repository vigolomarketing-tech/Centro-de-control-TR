import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Header from '../components/Header'

export default function Mas() {
  const { perfil, signOut } = useAuth()
  return (
    <>
      <Header titulo="Más" />
      <div className="contenido">
        <div className="card">
          <h2>Hola, {perfil?.nombre ?? '...'}</h2>
          <p className="texto-suave">Tacos Ruth · Centro de Control</p>
        </div>

        <div className="espaciado-v">
          <Link to="/turnos" className="btn btn--secundario" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            🕓 Turnos
          </Link>
          <Link to="/cuentas" className="btn btn--secundario" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            🤝 Cuentas entre socios
          </Link>
        </div>

        <button className="btn btn--peligro" style={{ marginTop: 24 }} onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </div>
    </>
  )
}
