export default function Header({ titulo, accion }) {
  return (
    <header className="header">
      <span className="header__titulo">{titulo}</span>
      {accion && (
        <button className="header__accion" onClick={accion.onClick}>
          {accion.label}
        </button>
      )}
    </header>
  )
}
