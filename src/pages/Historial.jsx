import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency, formatDateTime } from '../lib/format'
import Header from '../components/Header'

const LIMITE = 100

export default function Historial() {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('todos') // todos | pendientes

  async function cargar() {
    setCargando(true)
    let query = supabase
      .from('pedidos')
      .select('*, pedido_items(*), profiles:repartidor_id (nombre)')
      .order('created_at', { ascending: false })
      .limit(LIMITE)
    if (filtro === 'pendientes') query = query.eq('cobrado', false)
    const { data } = await query
    setPedidos(data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [filtro])

  async function toggleCobrado(pedido) {
    setPedidos((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, cobrado: !p.cobrado } : p)))
    await supabase.from('pedidos').update({ cobrado: !pedido.cobrado }).eq('id', pedido.id)
  }

  return (
    <>
      <Header titulo="Historial de pedidos" />
      <div className="contenido">
        <div className="periodo-selector">
          <button className={`chip${filtro === 'todos' ? ' activo' : ''}`} onClick={() => setFiltro('todos')}>
            Todos
          </button>
          <button className={`chip${filtro === 'pendientes' ? ' activo' : ''}`} onClick={() => setFiltro('pendientes')}>
            Pendientes de cobro
          </button>
        </div>

        {cargando ? (
          <p className="cargando">Cargando pedidos...</p>
        ) : pedidos.length === 0 ? (
          <p className="vacio">No hay pedidos para mostrar.</p>
        ) : (
          pedidos.map((p) => (
            <div key={p.id} className="card">
              <div className="flex-entre">
                <strong>{formatCurrency(p.facturacion)}</strong>
                <button
                  className={`chip${p.cobrado ? ' activo' : ''}`}
                  style={!p.cobrado ? { borderColor: 'var(--rojo)', color: 'var(--rojo)' } : undefined}
                  onClick={() => toggleCobrado(p)}
                >
                  {p.cobrado ? 'Cobrado ✓' : 'Pendiente'}
                </button>
              </div>
              <div className="texto-suave" style={{ marginTop: 4 }}>
                {formatDateTime(p.created_at)} · {p.zona} · {p.metodo_pago}
                {p.profiles?.nombre ? ` · repartió ${p.profiles.nombre}` : ''}
              </div>
              {p.cliente_nombre && (
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  <strong>{p.cliente_nombre}</strong>
                  {p.direccion ? ` · ${p.direccion}` : ''}
                </div>
              )}
              <div style={{ fontSize: 13, marginTop: 6 }}>
                {(p.pedido_items || []).map((it) => (
                  <div key={it.id}>
                    {it.cantidad}x {it.producto_nombre}
                  </div>
                ))}
              </div>
              {p.notas && (
                <div className="texto-suave" style={{ marginTop: 6 }}>
                  {p.notas}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}
