import { useMemo, useState } from 'react'
import { ZONAS, METODOS_PAGO, costoProducto, precioVigente } from '../lib/calc'
import { formatCurrency } from '../lib/format'
import { parsearMensajeWhatsapp, emparejarProducto, detectarZona } from '../lib/whatsappParser'
import { guardarPedido } from '../lib/offlineQueue'

const EJEMPLO = `*NUEVO PEDIDO - TACOS RUTH*
---
2x Hamburguesa Doble — $24.000
1x Menú 1 — $15.000
---
*TOTAL: $39.000*

Nombre: Juan
Entrega: Delivery
Dirección: Av. Hipólito Yrigoyen 1234, Longchamps
Pago: Efectivo (paga con $50.000)
Aclaraciones: sin cebolla`

export default function CargaRapidaWhatsapp({ productos, itemsPorProducto, insumosById, config, socios, creadoPor, onGuardado }) {
  const [texto, setTexto] = useState('')
  const [revision, setRevision] = useState(null) // null hasta que se parsea
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  function analizar() {
    setError('')
    if (!texto.trim()) return
    const parseado = parsearMensajeWhatsapp(texto)
    if (parseado.items.length === 0) {
      setError('No se encontró ningún producto en el mensaje. Revisá que tenga el formato "1x Producto — $1.000".')
      return
    }

    const lineas = parseado.items.map((item, idx) => {
      const match = emparejarProducto(item.nombreProducto, productos)
      const precioUnitario = match
        ? precioVigente(match, config?.promo_activa, config?.promo_vencimiento).precio
        : Math.round((item.precioTotal || 0) / (item.cantidad || 1))
      const costoUnitario = match ? costoProducto(itemsPorProducto[match.id] || [], insumosById) : 0
      return {
        id: idx,
        textoOriginal: item.nombreProducto,
        producto_id: match?.id || '',
        nombre: match?.nombre || item.nombreProducto,
        cantidad: item.cantidad,
        precio_unitario: precioUnitario,
        costo_unitario: costoUnitario,
        sinMatch: !match,
      }
    })

    const zonaDetectada = detectarZona(parseado.direccion, parseado.entrega, ZONAS)

    setRevision({
      lineas,
      totalParseado: parseado.total,
      nombre: parseado.nombre,
      direccion: parseado.direccion,
      aclaraciones: parseado.aclaraciones,
      zona: zonaDetectada || '',
      metodoPago: parseado.metodoPago || '',
      vuelto: parseado.vuelto ? String(parseado.vuelto) : '',
      costoEnvio: '0',
      repartidorId: socios[0]?.id || '',
    })
  }

  function actualizarLinea(id, campo, valor) {
    setRevision((prev) => ({
      ...prev,
      lineas: prev.lineas.map((l) => {
        if (l.id !== id) return l
        if (campo === 'producto_id') {
          const prod = productos.find((p) => p.id === valor)
          const precioUnitario = prod ? precioVigente(prod, config?.promo_activa, config?.promo_vencimiento).precio : l.precio_unitario
          const costoUnitario = prod ? costoProducto(itemsPorProducto[prod.id] || [], insumosById) : 0
          return { ...l, producto_id: valor, nombre: prod?.nombre || l.nombre, precio_unitario: precioUnitario, costo_unitario: costoUnitario, sinMatch: false }
        }
        return { ...l, [campo]: valor }
      }),
    }))
  }

  const totales = useMemo(() => {
    if (!revision) return { facturacion: 0, costoMercaderia: 0 }
    const facturacion = revision.lineas.reduce((t, l) => t + Number(l.cantidad) * Number(l.precio_unitario), 0)
    const costoMercaderia = revision.lineas.reduce((t, l) => t + Number(l.cantidad) * Number(l.costo_unitario), 0)
    return { facturacion, costoMercaderia }
  }, [revision])

  const faltaMatch = revision?.lineas.some((l) => !l.producto_id)
  const puedeGuardar = revision && revision.zona && revision.metodoPago && !faltaMatch

  async function confirmarYGuardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    const envio = Number(revision.costoEnvio) || 0
    const facturacion = totales.facturacion
    const costoMercaderia = totales.costoMercaderia
    const pedido = {
      zona: revision.zona,
      costo_envio: envio,
      metodo_pago: revision.metodoPago,
      repartidor_id: revision.repartidorId || null,
      facturacion,
      costo_mercaderia: costoMercaderia,
      ganancia: facturacion - costoMercaderia - envio,
      creado_por: creadoPor || null,
      cliente_nombre: revision.nombre || null,
      direccion: revision.direccion || null,
      notas:
        [revision.aclaraciones, revision.metodoPago === 'efectivo' && revision.vuelto ? `Paga con ${formatCurrency(revision.vuelto)}` : null]
          .filter(Boolean)
          .join(' · ') || null,
      cobrado: false,
      items: revision.lineas.map((l) => ({
        producto_id: l.producto_id,
        producto_nombre: l.nombre,
        cantidad: Number(l.cantidad),
        precio_unitario: Number(l.precio_unitario),
        costo_unitario: Number(l.costo_unitario),
      })),
    }
    const resultado = await guardarPedido(pedido)
    setGuardando(false)
    setTexto('')
    setRevision(null)
    setMensaje(resultado.offline ? 'Pedido guardado. Se va a sincronizar cuando vuelva la conexión.' : 'Pedido guardado ✓')
    onGuardado?.()
    setTimeout(() => setMensaje(''), 4000)
  }

  if (!revision) {
    return (
      <div className="card">
        <h2>Pegar mensaje de WhatsApp</h2>
        {mensaje && <div className="exito-msg">{mensaje}</div>}
        {error && <div className="error-msg">{error}</div>}
        <p className="texto-suave">Pegá el mensaje del pedido tal cual llega y lo analizamos solo.</p>
        <textarea
          rows={10}
          placeholder={EJEMPLO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
        <button className="btn" style={{ marginTop: 10 }} onClick={analizar} disabled={!texto.trim()}>
          Analizar mensaje
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex-entre">
        <h2>Revisar pedido</h2>
        <button className="link-boton" onClick={() => setRevision(null)}>
          Volver a pegar
        </button>
      </div>

      {revision.lineas.map((l) => (
        <div key={l.id} className="fila-2" style={{ alignItems: 'end', marginBottom: 8 }}>
          <div>
            <label>{l.sinMatch ? `"${l.textoOriginal}" (sin match, elegí uno)` : 'Producto'}</label>
            <select value={l.producto_id} onChange={(e) => actualizarLinea(l.id, 'producto_id', e.target.value)}>
              <option value="">— elegir —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <label>Cant.</label>
              <input type="number" min="1" value={l.cantidad} onChange={(e) => actualizarLinea(l.id, 'cantidad', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Precio c/u</label>
              <input type="number" min="0" value={l.precio_unitario} onChange={(e) => actualizarLinea(l.id, 'precio_unitario', e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      {revision.totalParseado != null && Math.round(revision.totalParseado) !== Math.round(totales.facturacion) && (
        <p className="texto-suave" style={{ color: 'var(--amarillo)' }}>
          El total del mensaje decía {formatCurrency(revision.totalParseado)}, pero según los productos matcheados da{' '}
          {formatCurrency(totales.facturacion)}. Revisá antes de guardar.
        </p>
      )}

      <div className="form-grid" style={{ marginTop: 10 }}>
        <div className="fila-2">
          <div>
            <label>Cliente</label>
            <input value={revision.nombre} onChange={(e) => setRevision({ ...revision, nombre: e.target.value })} />
          </div>
          <div>
            <label>Dirección</label>
            <input value={revision.direccion} onChange={(e) => setRevision({ ...revision, direccion: e.target.value })} />
          </div>
        </div>

        <div>
          <label>Zona</label>
          <div className="chip-selector">
            {ZONAS.map((z) => (
              <button key={z} className={`chip${revision.zona === z ? ' activo' : ''}`} onClick={() => setRevision({ ...revision, zona: z })}>
                {z}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label>Método de pago</label>
          <div className="chip-selector">
            {METODOS_PAGO.map((m) => (
              <button
                key={m.value}
                className={`chip${revision.metodoPago === m.value ? ' activo' : ''}`}
                onClick={() => setRevision({ ...revision, metodoPago: m.value })}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {revision.metodoPago === 'efectivo' && (
          <div>
            <label>¿Con cuánto paga? (opcional)</label>
            <input type="number" min="0" value={revision.vuelto} onChange={(e) => setRevision({ ...revision, vuelto: e.target.value })} />
          </div>
        )}

        <div className="fila-2">
          <div>
            <label>Costo de envío</label>
            <input type="number" min="0" value={revision.costoEnvio} onChange={(e) => setRevision({ ...revision, costoEnvio: e.target.value })} />
          </div>
          <div>
            <label>Repartió</label>
            <select value={revision.repartidorId} onChange={(e) => setRevision({ ...revision, repartidorId: e.target.value })}>
              {socios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {revision.aclaraciones && (
          <p className="texto-suave">
            Aclaraciones: <strong>{revision.aclaraciones}</strong>
          </p>
        )}
      </div>

      <div className="card" style={{ marginTop: 12, marginBottom: 12 }}>
        <div className="flex-entre">
          <span>Facturación</span>
          <strong>{formatCurrency(totales.facturacion)}</strong>
        </div>
        <div className="flex-entre" style={{ marginTop: 6 }}>
          <span>Costo mercadería</span>
          <span>{formatCurrency(totales.costoMercaderia)}</span>
        </div>
      </div>

      {faltaMatch && <p className="texto-suave" style={{ color: 'var(--rojo)' }}>Falta elegir producto en alguna línea.</p>}
      {!revision.zona && <p className="texto-suave" style={{ color: 'var(--rojo)' }}>Falta elegir la zona.</p>}
      {!revision.metodoPago && <p className="texto-suave" style={{ color: 'var(--rojo)' }}>Falta elegir el método de pago.</p>}

      <button className="btn" disabled={!puedeGuardar || guardando} onClick={confirmarYGuardar}>
        {guardando ? 'Guardando...' : 'Confirmar y guardar pedido'}
      </button>
    </div>
  )
}
