import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSocios } from '../lib/useSocios'
import { ZONAS, METODOS_PAGO, costoProducto, precioVigente } from '../lib/calc'
import { formatCurrency } from '../lib/format'
import { guardarPedido } from '../lib/offlineQueue'
import Header from '../components/Header'
import CargaRapidaWhatsapp from '../components/CargaRapidaWhatsapp'

export default function Pedidos() {
  const { perfil } = useAuth()
  const { socios } = useSocios()
  const [modo, setModo] = useState('manual') // manual | whatsapp
  const [productos, setProductos] = useState([])
  const [insumosById, setInsumosById] = useState({})
  const [itemsPorProducto, setItemsPorProducto] = useState({})
  const [config, setConfig] = useState(null)
  const [cargando, setCargando] = useState(true)

  const [carrito, setCarrito] = useState([]) // { producto_id, nombre, cantidad, precio_unitario, costo_unitario }
  const [zona, setZona] = useState(ZONAS[0])
  const [costoEnvio, setCostoEnvio] = useState('0')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [repartidorId, setRepartidorId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    async function cargar() {
      const [{ data: prods }, { data: items }, { data: ins }, { data: conf }] = await Promise.all([
        supabase.from('productos').select('*').eq('activo', true).order('orden'),
        supabase.from('producto_insumos').select('*'),
        supabase.from('insumos').select('*'),
        supabase.from('configuracion').select('*').single(),
      ])
      const insMap = {}
      ;(ins || []).forEach((i) => (insMap[i.id] = i))
      const itemsMap = {}
      ;(items || []).forEach((it) => {
        if (!itemsMap[it.producto_id]) itemsMap[it.producto_id] = []
        itemsMap[it.producto_id].push(it)
      })
      setProductos(prods || [])
      setInsumosById(insMap)
      setItemsPorProducto(itemsMap)
      setConfig(conf)
      setCargando(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    if (socios.length > 0 && !repartidorId) setRepartidorId(socios[0].id)
  }, [socios, repartidorId])

  function agregarProducto(producto) {
    const { precio, esPromo } = precioVigente(producto, config?.promo_activa, config?.promo_vencimiento)
    const costo = costoProducto(itemsPorProducto[producto.id] || [], insumosById)
    setCarrito((prev) => {
      const existente = prev.find((l) => l.producto_id === producto.id)
      if (existente) {
        return prev.map((l) => (l.producto_id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l))
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          cantidad: 1,
          precio_unitario: precio,
          costo_unitario: costo,
          esPromo,
        },
      ]
    })
  }

  function cambiarCantidad(producto_id, delta) {
    setCarrito((prev) =>
      prev
        .map((l) => (l.producto_id === producto_id ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0)
    )
  }

  const cantidadPorProducto = useMemo(() => {
    const map = {}
    carrito.forEach((l) => (map[l.producto_id] = l.cantidad))
    return map
  }, [carrito])

  const totales = useMemo(() => {
    const facturacion = carrito.reduce((t, l) => t + l.cantidad * l.precio_unitario, 0)
    const costoMercaderia = carrito.reduce((t, l) => t + l.cantidad * l.costo_unitario, 0)
    const envio = Number(costoEnvio) || 0
    const ganancia = facturacion - costoMercaderia - envio
    return { facturacion, costoMercaderia, ganancia }
  }, [carrito, costoEnvio])

  function limpiar() {
    setCarrito([])
    setCostoEnvio('0')
  }

  async function confirmarPedido() {
    if (carrito.length === 0) return
    setGuardando(true)
    setMensaje('')
    const pedido = {
      zona,
      costo_envio: Number(costoEnvio) || 0,
      metodo_pago: metodoPago,
      repartidor_id: repartidorId || null,
      facturacion: totales.facturacion,
      costo_mercaderia: totales.costoMercaderia,
      ganancia: totales.ganancia,
      creado_por: perfil?.id || null,
      items: carrito.map((l) => ({
        producto_id: l.producto_id,
        producto_nombre: l.nombre,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        costo_unitario: l.costo_unitario,
      })),
    }
    const resultado = await guardarPedido(pedido)
    setGuardando(false)
    limpiar()
    setMensaje(resultado.offline ? 'Pedido guardado. Se va a sincronizar cuando vuelva la conexión.' : 'Pedido guardado ✓')
    setTimeout(() => setMensaje(''), 4000)
  }

  if (cargando) return <p className="cargando">Cargando productos...</p>

  return (
    <>
      <Header titulo="Cargar pedido" />
      <div className="contenido">
        {mensaje && <div className="exito-msg">{mensaje}</div>}

        <div className="periodo-selector">
          <button className={`chip${modo === 'manual' ? ' activo' : ''}`} onClick={() => setModo('manual')}>
            Manual
          </button>
          <button className={`chip${modo === 'whatsapp' ? ' activo' : ''}`} onClick={() => setModo('whatsapp')}>
            Pegar WhatsApp
          </button>
        </div>

        {modo === 'whatsapp' ? (
          <CargaRapidaWhatsapp
            productos={productos}
            itemsPorProducto={itemsPorProducto}
            insumosById={insumosById}
            config={config}
            socios={socios}
            creadoPor={perfil?.id}
            onGuardado={() => setMensaje('')}
          />
        ) : (
          <>
        <div className="seccion-titulo">Productos</div>
        <div className="productos-grid">
          {productos.map((p) => {
            const { precio, esPromo } = precioVigente(p, config?.promo_activa, config?.promo_vencimiento)
            const cant = cantidadPorProducto[p.id]
            return (
              <button key={p.id} className="producto-btn" onClick={() => agregarProducto(p)}>
                {cant > 0 && <span className="producto-btn__badge">{cant}</span>}
                <span className="producto-btn__nombre">{p.nombre}</span>
                <span className={`producto-btn__precio${esPromo ? ' producto-btn__precio--promo' : ''}`}>
                  {formatCurrency(precio)}
                </span>
              </button>
            )
          })}
        </div>

        {carrito.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Pedido</h2>
            {carrito.map((l) => (
              <div key={l.producto_id} className="linea-pedido">
                <div>
                  <div style={{ fontWeight: 700 }}>{l.nombre}</div>
                  <div className="texto-suave">{formatCurrency(l.precio_unitario)} c/u</div>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => cambiarCantidad(l.producto_id, -1)}>
                    −
                  </button>
                  <strong>{l.cantidad}</strong>
                  <button type="button" onClick={() => cambiarCantidad(l.producto_id, 1)}>
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="seccion-titulo">Entrega</div>
        <div className="card">
          <label>Zona</label>
          <div className="chip-selector">
            {ZONAS.map((z) => (
              <button key={z} className={`chip${zona === z ? ' activo' : ''}`} onClick={() => setZona(z)}>
                {z}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Costo de envío</label>
            <input type="number" min="0" value={costoEnvio} onChange={(e) => setCostoEnvio(e.target.value)} />
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Método de pago</label>
            <div className="chip-selector">
              {METODOS_PAGO.map((m) => (
                <button
                  key={m.value}
                  className={`chip${metodoPago === m.value ? ' activo' : ''}`}
                  onClick={() => setMetodoPago(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Repartió</label>
            <select value={repartidorId} onChange={(e) => setRepartidorId(e.target.value)}>
              {socios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {carrito.length > 0 && (
          <div className="card">
            <div className="flex-entre">
              <span>Facturación</span>
              <strong>{formatCurrency(totales.facturacion)}</strong>
            </div>
            <div className="flex-entre" style={{ marginTop: 6 }}>
              <span>Costo mercadería</span>
              <span>{formatCurrency(totales.costoMercaderia)}</span>
            </div>
            <div className="flex-entre" style={{ marginTop: 6 }}>
              <span>Ganancia</span>
              <strong className={totales.ganancia >= 0 ? '' : 'stat__valor--negativo'}>
                {formatCurrency(totales.ganancia)}
              </strong>
            </div>
          </div>
        )}

        <button className="btn" disabled={carrito.length === 0 || guardando} onClick={confirmarPedido}>
          {guardando ? 'Guardando...' : 'Guardar pedido'}
        </button>
          </>
        )}
      </div>
    </>
  )
}
