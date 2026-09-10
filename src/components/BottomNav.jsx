import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/pedidos', icono: '🛵', label: 'Pedidos' },
  { to: '/recetas', icono: '🌮', label: 'Recetas' },
  { to: '/insumos', icono: '📦', label: 'Insumos' },
  { to: '/gastos', icono: '💸', label: 'Gastos' },
  { to: '/balance', icono: '📊', label: 'Balance' },
  { to: '/mas', icono: '⋯', label: 'Más' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bottom-nav__item${isActive ? ' activo' : ''}`}
        >
          <span className="bottom-nav__icono">{item.icono}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
