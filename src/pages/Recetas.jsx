import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { costoProducto, foodCostPct, gananciaUnidad, precioSugerido } from '../lib/calc'
import { formatCurrency, formatDate } from '../lib/format'
import Header from '../components/Header'
import Semaforo from '../components/Semaforo'
import ConfirmDialog from '../components/ConfirmDialog'
import LineChart from '../components/LineChart'

const TIPOS = [
  { value: 'hamburguesa', label: 'Hamburguesa' },
  { value: 'taco', label: 'Taco' },
  { value: 'combo', label: 'Combo' },
]

export default function Recetas() {
  const [productos, setProductos] = useState([])
  const [recetaItems, setRecetaItems] = useState([]) // producto_insumos
  const [insumos, setInsumos] = useState([])
  const [config, setConfig] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null) // producto en edición (o {} para nuevo)
  const [aBorrar, setABorrar] = useState(null)
  const [historial, setHistorial] = useState(null) // { producto, data, cambios }

  async function cargarTodo() {
    setCargando(true)
    const [{ data: prods }, { data: items }, { data: ins }, { data: conf }] = await Promise.all([
      supabase.from('productos').select('*').order('orden'),
      supabase.from('producto_insumos').select('*'),
      supabase.from('insumos').select('*'),
      supabase.from('configuracion').select('*').single(),
    ])
    setProductos(prods || [])
    setRecetaItems(items || [])
    setInsumos(ins || [])
    setConfig(conf)
    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
  }, [])

  const insumosById = useMemo(() => {
    const map = {}
    insumos.forEach((i) => (map[i.id] = i))
    return map
  }, [insumos])

  const itemsPorProducto = useMemo(() => {
    const map = {}
    recetaItems.forEach((item) => {
      if (!map[item.producto_id]) map[item.producto_id] = []
      map[item.producto_id].push(item)
    })
    return map
  }, [recetaItems])

  async function togglePromo() {
    const nuevo = { ...config, promo_activa: !config.promo_activa }
    setConfig(nuevo)
    await supabase.from('configuracion').update({ promo_activa: nuevo.promo_activa }).eq('id', true)
  }

  async function cambiarVencimiento(fecha) {
    const nuevo = { ...config, promo_vencimiento: fecha }
    setConfig(nuevo)
    await supabase.from('configuracion').update({ promo_vencimiento: fecha }).eq('id', true)
  }

  async function borrarProducto() {
    if (!aBorrar) return
    await supabase.from('productos').delete().eq('id', aBorrar.id)
    setABorrar(null)
    cargarTodo()
  }

  async function verHistorialProducto(producto) {
    const { data } = await supabase
      .from('productos_historico')
      .select('*')
      .eq('producto_id', producto.id)
      .order('registrado_at')
    const cambios = [
      ...(data || []),
      { registrado_at: producto.actualizado_at, precio_normal: producto.precio_normal, precio_promo: producto.precio_promo, activo: producto.activo },
    ]
    setHistorial({
      producto,
      cambios: [...cambios].reverse(),
      data: cambios.map((c) => ({ x: c.registrado_at, y: Number(c.precio_normal) })),
    })
  }

  const promoVencida = config?.promo_vencimiento ? new Date(config.promo_vencimiento) < new Date() : false

  return (
    <>
      <Header titulo="Recetas y productos" accion={{ label: '+ Nuevo', onClick: () => setEditando({}) }} />
      <div className="contenido">
        <p className="texto-suave" style={{ marginTop: 0 }}>
          Estos precios son sólo para esta app de gestión interna. No tocan la
          landing de pedidos (tacosruth.com), que es un proyecto aparte.
        </p>

        {config && (
          <div className="card">
            <div className="flex-entre">
              <div>
                <strong>Promo activa</strong>
                <p className="texto-suave" style={{ margin: '2px 0 0' }}>
                  Vence: {formatDate(config.promo_vencimiento)}
                  {promoVencida && <span style={{ color: 'var(--rojo)', fontWeight: 700 }}> · vencida</span>}
                </p>
              </div>
              <button
                className={`chip${config.promo_activa && !promoVencida ? ' activo' : ''}`}
                onClick={togglePromo}
              >
                {config.promo_activa ? 'ON' : 'OFF'}
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Fecha de vencimiento de la promo</label>
              <input
                type="date"
                value={config.promo_vencimiento}
                onChange={(e) => cambiarVencimiento(e.target.value)}
              />
            </div>
          </div>
        )}

        {cargando ? (
          <p className="cargando">Cargando recetas...</p>
        ) : (
          productos.map((p) => {
            const items = itemsPorProducto[p.id] || []
            const costo = costoProducto(items, insumosById)
            const pct = foodCostPct(costo, p.precio_normal)
            const ganancia = gananciaUnidad(costo, p.precio_normal)
            const sugerido = precioSugerido(costo)
            return (
              <div key={p.id} className="card" style={!p.activo ? { opacity: 0.6 } : undefined}>
                <div className="flex-entre">
                  <h2>
                    {p.nombre}
                    {!p.activo && (
                      <span className="chip" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}>
                        Pausado
                      </span>
                    )}
                  </h2>
                  <Semaforo pct={pct} />
                </div>
                <div className="stats-grid">
                  <div className="stat">
                    <div className="stat__label">Costo</div>
                    <div className="stat__valor">{formatCurrency(costo)}</div>
                  </div>
                  <div className="stat">
                    <div className="stat__label">Ganancia / unidad</div>
                    <div className={`stat__valor ${ganancia >= 0 ? 'stat__valor--positivo' : 'stat__valor--negativo'}`}>
                      {formatCurrency(ganancia)}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat__label">Precio normal</div>
                    <div className="stat__valor">{formatCurrency(p.precio_normal)}</div>
                  </div>
                  <div className="stat">
                    <div className="stat__label">Precio promo</div>
                    <div className="stat__valor">{p.precio_promo ? formatCurrency(p.precio_promo) : '—'}</div>
                  </div>
                </div>
                <p className="texto-suave" style={{ marginBottom: 0 }}>
                  Precio sugerido para 33% de food cost: <strong>{formatCurrency(sugerido)}</strong>
                </p>
                <div className="btn-fila" style={{ marginTop: 12 }}>
                  <button className="btn btn--secundario btn--chico" onClick={() => setEditando(p)}>
                    Editar receta
                  </button>
                  <button className="link-boton" onClick={() => verHistorialProducto(p)}>
                    Historial
                  </button>
                  <button className="link-boton" style={{ color: 'var(--rojo)' }} onClick={() => setABorrar(p)}>
                    Borrar
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {editando !== null && (
        <EditorReceta
          producto={editando}
          items={editando.id ? itemsPorProducto[editando.id] || [] : []}
          insumos={insumos}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            cargarTodo()
          }}
        />
      )}

      <ConfirmDialog
        abierto={!!aBorrar}
        titulo="¿Borrar producto?"
        mensaje={`Se va a borrar "${aBorrar?.nombre}" del menú. Esta acción no se puede deshacer.`}
        onConfirmar={borrarProducto}
        onCancelar={() => setABorrar(null)}
      />

      {historial && (
        <div className="modal-fondo" onClick={() => setHistorial(null)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{historial.producto.nombre}</h2>
            <p className="texto-suave">Evolución del precio normal</p>
            <LineChart data={historial.data} />
            <div className="seccion-titulo">Cambios</div>
            {historial.cambios.map((c, i) => (
              <div key={i} className="flex-entre" style={{ padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                <span className="texto-suave">{formatDate(c.registrado_at)}</span>
                <span>
                  {formatCurrency(c.precio_normal)}
                  {c.precio_promo ? ` · promo ${formatCurrency(c.precio_promo)}` : ''}
                  {!c.activo ? ' · pausado' : ''}
                </span>
              </div>
            ))}
            <button className="btn btn--secundario" style={{ marginTop: 16 }} onClick={() => setHistorial(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function EditorReceta({ producto, items, insumos, onCerrar, onGuardado }) {
  const esNuevo = !producto.id
  const [nombre, setNombre] = useState(producto.nombre || '')
  const [tipo, setTipo] = useState(producto.tipo || 'hamburguesa')
  const [precioNormal, setPrecioNormal] = useState(producto.precio_normal ?? '')
  const [precioPromo, setPrecioPromo] = useState(producto.precio_promo ?? '')
  const [activo, setActivo] = useState(producto.activo ?? true)
  const [lineas, setLineas] = useState(
    items.length > 0
      ? items.map((i) => ({ insumo_id: i.insumo_id, cantidad: i.cantidad }))
      : [{ insumo_id: insumos[0]?.id || '', cantidad: 1 }]
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const insumosById = useMemo(() => {
    const map = {}
    insumos.forEach((i) => (map[i.id] = i))
    return map
  }, [insumos])

  const costoActual = costoProducto(lineas, insumosById)
  const pctActual = foodCostPct(costoActual, Number(precioNormal) || 0)

  function actualizarLinea(idx, campo, valor) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)))
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { insumo_id: insumos[0]?.id || '', cantidad: 1 }])
  }

  function quitarLinea(idx) {
    setLineas((prev) => prev.filter((_, i) => i !== idx))
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')
    if (lineas.length === 0) {
      setError('Agregá al menos un insumo a la receta.')
      return
    }
    setGuardando(true)
    const payload = {
      nombre: nombre.trim(),
      tipo,
      precio_normal: Number(precioNormal),
      precio_promo: precioPromo === '' ? null : Number(precioPromo),
      activo,
    }
    let productoId = producto.id
    if (esNuevo) {
      const { data, error } = await supabase.from('productos').insert(payload).select('id').single()
      if (error) {
        setError('No se pudo crear el producto.')
        setGuardando(false)
        return
      }
      productoId = data.id
    } else {
      const { error } = await supabase.from('productos').update(payload).eq('id', productoId)
      if (error) {
        setError('No se pudo guardar el producto.')
        setGuardando(false)
        return
      }
      await supabase.from('producto_insumos').delete().eq('producto_id', productoId)
    }
    const nuevasLineas = lineas
      .filter((l) => l.insumo_id && Number(l.cantidad) > 0)
      .map((l) => ({ producto_id: productoId, insumo_id: l.insumo_id, cantidad: Number(l.cantidad) }))
    const { error: errorItems } = await supabase.from('producto_insumos').insert(nuevasLineas)
    setGuardando(false)
    if (errorItems) {
      setError('El producto se guardó pero hubo un error con la receta.')
      return
    }
    onGuardado()
  }

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>{esNuevo ? 'Nuevo producto' : `Editar: ${producto.nombre}`}</h2>
        {error && <div className="error-msg">{error}</div>}
        <form className="form-grid" onSubmit={guardar}>
          <div>
            <label>Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div>
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fila-2">
            <div>
              <label>Precio normal</label>
              <input type="number" min="0" value={precioNormal} onChange={(e) => setPrecioNormal(e.target.value)} required />
            </div>
            <div>
              <label>Precio promo (opcional)</label>
              <input type="number" min="0" value={precioPromo} onChange={(e) => setPrecioPromo(e.target.value)} />
            </div>
          </div>

          <div>
            <label>Estado</label>
            <div className="chip-selector">
              <button type="button" className={`chip${activo ? ' activo' : ''}`} onClick={() => setActivo(true)}>
                Activo
              </button>
              <button type="button" className={`chip${!activo ? ' activo' : ''}`} onClick={() => setActivo(false)}>
                Pausado
              </button>
            </div>
            <p className="texto-suave">Pausado lo saca de la pantalla de Pedidos sin borrarlo del catálogo.</p>
          </div>

          <div className="seccion-titulo">Insumos de la receta</div>
          {lineas.map((linea, idx) => (
            <div key={idx} className="fila-2" style={{ alignItems: 'end' }}>
              <div>
                <label>Insumo</label>
                <select value={linea.insumo_id} onChange={(e) => actualizarLinea(idx, 'insumo_id', e.target.value)}>
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({i.unidad})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <label>Cantidad</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={linea.cantidad}
                    onChange={(e) => actualizarLinea(idx, 'cantidad', e.target.value)}
                  />
                </div>
                <button type="button" className="link-boton" style={{ color: 'var(--rojo)' }} onClick={() => quitarLinea(idx)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn--secundario btn--chico" onClick={agregarLinea}>
            + Agregar insumo
          </button>

          <div className="card" style={{ marginTop: 4, marginBottom: 0 }}>
            <div className="flex-entre">
              <span>Costo calculado</span>
              <strong>{formatCurrency(costoActual)}</strong>
            </div>
            <div className="flex-entre" style={{ marginTop: 6 }}>
              <span>Food cost</span>
              <Semaforo pct={pctActual} />
            </div>
          </div>

          <div className="btn-fila">
            <button type="button" className="btn btn--secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
