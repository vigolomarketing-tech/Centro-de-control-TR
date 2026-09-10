import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSocios } from '../lib/useSocios'
import { CATEGORIAS_GASTO } from '../lib/calc'
import { formatCurrency, formatDate, todayISO } from '../lib/format'
import Header from '../components/Header'
import ConfirmDialog from '../components/ConfirmDialog'

function etiquetaCategoria(valor) {
  return CATEGORIAS_GASTO.find((c) => c.value === valor)?.label ?? valor
}

const VACIO = { monto: '', categoria: 'insumos', descripcion: '', fecha: todayISO(), pagado_por: '' }

export default function Gastos() {
  const { socios } = useSocios()
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [archivo, setArchivo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aBorrar, setABorrar] = useState(null)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('gastos')
      .select('*, profiles:pagado_por (nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    setGastos(data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  useEffect(() => {
    if (socios.length > 0 && !form.pagado_por) {
      setForm((f) => ({ ...f, pagado_por: socios[0].id }))
    }
  }, [socios, form.pagado_por])

  function abrirNuevo() {
    setForm({ ...VACIO, pagado_por: socios[0]?.id || '' })
    setArchivo(null)
    setError('')
    setModalAbierto(true)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    let foto_url = null
    if (archivo) {
      const nombreArchivo = `${Date.now()}_${archivo.name}`
      const { error: errorSubida } = await supabase.storage.from('tickets').upload(nombreArchivo, archivo)
      if (errorSubida) {
        setError('No se pudo subir la foto del ticket, pero podés guardar el gasto sin ella.')
      } else {
        const { data } = supabase.storage.from('tickets').getPublicUrl(nombreArchivo)
        foto_url = data.publicUrl
      }
    }

    const payload = {
      monto: Number(form.monto),
      categoria: form.categoria,
      descripcion: form.descripcion.trim() || null,
      fecha: form.fecha,
      pagado_por: form.pagado_por,
      foto_url,
    }
    const { error: errorInsert } = await supabase.from('gastos').insert(payload)
    setGuardando(false)
    if (errorInsert) {
      setError('No se pudo guardar el gasto.')
      return
    }
    setModalAbierto(false)
    cargar()
  }

  async function borrar() {
    if (!aBorrar) return
    await supabase.from('gastos').delete().eq('id', aBorrar.id)
    setABorrar(null)
    cargar()
  }

  return (
    <>
      <Header titulo="Gastos" accion={{ label: '+ Nuevo', onClick: abrirNuevo }} />
      <div className="contenido">
        {cargando ? (
          <p className="cargando">Cargando gastos...</p>
        ) : gastos.length === 0 ? (
          <p className="vacio">No hay gastos cargados todavía.</p>
        ) : (
          gastos.map((g) => (
            <div key={g.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {g.foto_url ? (
                <img
                  src={g.foto_url}
                  alt="Ticket"
                  className="thumb-ticket"
                  onClick={() => setFotoAmpliada(g.foto_url)}
                  style={{ cursor: 'pointer' }}
                />
              ) : (
                <div className="thumb-ticket" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  🧾
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div className="flex-entre">
                  <strong>{formatCurrency(g.monto)}</strong>
                  <span className="texto-suave">{formatDate(g.fecha)}</span>
                </div>
                <div className="texto-suave">
                  {etiquetaCategoria(g.categoria)} · pagó {g.profiles?.nombre ?? '—'}
                </div>
                {g.descripcion && <div style={{ fontSize: 13, marginTop: 2 }}>{g.descripcion}</div>}
              </div>
              <button className="link-boton" style={{ color: 'var(--rojo)' }} onClick={() => setABorrar(g)}>
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {modalAbierto && (
        <div className="modal-fondo" onClick={() => setModalAbierto(false)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Nuevo gasto</h2>
            {error && <div className="error-msg">{error}</div>}
            <form className="form-grid" onSubmit={guardar}>
              <div>
                <label>Monto</label>
                <input type="number" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
              </div>
              <div>
                <label>Categoría</label>
                <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                  {CATEGORIAS_GASTO.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Descripción (opcional)</label>
                <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </div>
              <div className="fila-2">
                <div>
                  <label>Fecha</label>
                  <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                </div>
                <div>
                  <label>Quién pagó</label>
                  <select value={form.pagado_por} onChange={(e) => setForm({ ...form, pagado_por: e.target.value })}>
                    {socios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label>Foto del ticket (opcional)</label>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
              </div>
              <div className="btn-fila">
                <button type="button" className="btn btn--secundario" onClick={() => setModalAbierto(false)}>
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

      {fotoAmpliada && (
        <div className="modal-fondo" onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="Ticket" style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12 }} />
        </div>
      )}

      <ConfirmDialog
        abierto={!!aBorrar}
        titulo="¿Borrar gasto?"
        mensaje={`Se va a borrar el gasto de ${aBorrar ? formatCurrency(aBorrar.monto) : ''}. Esta acción no se puede deshacer.`}
        onConfirmar={borrar}
        onCancelar={() => setABorrar(null)}
      />
    </>
  )
}
