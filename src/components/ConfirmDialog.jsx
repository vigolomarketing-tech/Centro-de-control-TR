export default function ConfirmDialog({ abierto, titulo, mensaje, onConfirmar, onCancelar, textoConfirmar = 'Borrar' }) {
  if (!abierto) return null
  return (
    <div className="modal-fondo" onClick={onCancelar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>{titulo}</h2>
        <p className="texto-suave">{mensaje}</p>
        <div className="btn-fila" style={{ marginTop: 16 }}>
          <button className="btn btn--secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="btn btn--peligro" onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
