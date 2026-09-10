import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { CATEGORIAS_INSUMO, UNIDADES, costoUnitarioInsumo } from '../lib/calc'
import { formatCurrency, formatDate, formatNumber } from '../lib/format'
import Header from '../components/Header'
import ConfirmDialog from '../components/ConfirmDialog'
import LineChart from '../components/LineChart'

const VACIO = {
  nombre: '',
  categoria: 'otros',
  precio_compra: '',
  cantidad: '',
  unidad: 'unidad',
  proveedor: '',
}

function etiquetaCategoria(valor) {
  return CATEGORIAS_INSUMO.find((c) => c.value === valor)?.label ?? valor
}

export default function Insumos() {
  const [insumos, setInsumos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null) // 'crear' | 'editar' | null
  const [form, setForm] = useState(VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aBorrar, setABorrar] = useState(null)
  const [historial, setHistorial] = useState(null) // { insumo, data }

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('insumos').select('*').order('categoria').order('nombre')
    setInsumos(data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrirCrear() {
    setForm(VACIO)
    setEditandoId(null)
    setError('')
    setModal('crear')
  }

  function abrirEditar(insumo) {
    setForm({
      nombre: insumo.nombre,
      categoria: insumo.categoria,
      precio_compra: insumo.precio_compra,
      cantidad: insumo.cantidad,
      unidad: insumo.unidad,
      proveedor: insumo.proveedor || '',
    })
    setEditandoId(insumo.id)
    setError('')
    setModal('editar')
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      precio_compra: Number(form.precio_compra),
      cantidad: Number(form.cantidad),
      unidad: form.unidad,
      proveedor: form.proveedor.trim() || null,
    }
    const query = editandoId
      ? supabase.from('insumos').update(payload).eq('id', editandoId)
      : supabase.from('insumos').insert(payload)
    const { error } = await query
    setGuardando(false)
    if (error) {
      setError('No se pudo guardar. Revisá los datos.')
      return
    }
    setModal(null)
    cargar()
  }

  async function borrar() {
    if (!aBorrar) return
    await supabase.from('insumos').delete().eq('id', aBorrar.id)
    setABorrar(null)
    cargar()
  }

  async function verHistorial(insumo) {
    const { data } = await supabase
      .from('insumos_historico')
      .select('*')
      .eq('insumo_id', insumo.id)
      .order('registrado_at')
    const puntos = [...(data || []), {
      registrado_at: insumo.actualizado_at,
      costo_unitario: insumo.costo_unitario,
    }]
    setHistorial({
      insumo,
      data: puntos.map((p) => ({ x: p.registrado_at, y: Number(p.costo_unitario) })),
    })
  }

  return (
    <>
      <Header titulo="Insumos" accion={{ label: '+ Nuevo', onClick: abrirCrear }} />
      <div className="contenido">
        {cargando ? (
          <p className="cargando">Cargando insumos...</p>
        ) : insumos.length === 0 ? (
          <p className="vacio">No hay insumos cargados todavía.</p>
        ) : (
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Compra</th>
                  <th>Costo unit.</th>
                  <th>Proveedor</th>
                  <th>Actualizado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nombre}</td>
                    <td>{etiquetaCategoria(i.categoria)}</td>
                    <td>
                      {formatCurrency(i.precio_compra)} / {formatNumber(i.cantidad, i.cantidad % 1 ? 2 : 0)} {i.unidad}
                    </td>
                    <td>
                      <strong>{formatCurrency(costoUnitarioInsumo(i))}</strong>
                    </td>
                    <td>{i.proveedor || '—'}</td>
                    <td>{formatDate(i.actualizado_at)}</td>
                    <td>
                      <div className="btn-fila">
                        <button className="link-boton" onClick={() => verHistorial(i)}>
                          Historial
                        </button>
                        <button className="link-boton" onClick={() => abrirEditar(i)}>
                          Editar
                        </button>
                        <button className="link-boton" style={{ color: 'var(--rojo)' }} onClick={() => setABorrar(i)}>
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-fondo" onClick={() => setModal(null)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{modal === 'crear' ? 'Nuevo insumo' : 'Editar insumo'}</h2>
            {error && <div className="error-msg">{error}</div>}
            <form className="form-grid" onSubmit={guardar}>
              <div>
                <label>Nombre</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </div>
              <div>
                <label>Categoría</label>
                <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                  {CATEGORIAS_INSUMO.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fila-2">
                <div>
                  <label>Precio de compra</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precio_compra}
                    onChange={(e) => setForm({ ...form, precio_compra: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Cantidad</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={form.cantidad}
                    onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label>Unidad</label>
                <select value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Proveedor (opcional)</label>
                <input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
              </div>
              {form.precio_compra && form.cantidad && Number(form.cantidad) > 0 && (
                <p className="texto-suave">
                  Costo unitario: <strong>{formatCurrency(Number(form.precio_compra) / Number(form.cantidad))}</strong>
                </p>
              )}
              <div className="btn-fila">
                <button type="button" className="btn btn--secundario" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historial && (
        <div className="modal-fondo" onClick={() => setHistorial(null)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{historial.insumo.nombre}</h2>
            <p className="texto-suave">Evolución del costo unitario</p>
            <LineChart data={historial.data} />
            <button className="btn btn--secundario" style={{ marginTop: 16 }} onClick={() => setHistorial(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        abierto={!!aBorrar}
        titulo="¿Borrar insumo?"
        mensaje={`Se va a borrar "${aBorrar?.nombre}". Esta acción no se puede deshacer.`}
        onConfirmar={borrar}
        onCancelar={() => setABorrar(null)}
      />
    </>
  )
}
