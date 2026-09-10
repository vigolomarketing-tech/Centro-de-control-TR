import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency, formatNumber } from '../lib/format'
import { usePeriodo, aISO } from '../lib/periodo'
import Header from '../components/Header'
import BarChart from '../components/BarChart'
import { CATEGORIAS_GASTO } from '../lib/calc'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function Balance() {
  const { modo, setModo, rango, moverPeriodo } = usePeriodo('semanal')
  const [pedidos, setPedidos] = useState([])
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const inicioISO = rango.inicio.toISOString()
      const finISO = rango.fin.toISOString()
      const [{ data: peds }, { data: gas }] = await Promise.all([
        supabase
          .from('pedidos')
          .select('*, pedido_items(*)')
          .gte('created_at', inicioISO)
          .lt('created_at', finISO),
        supabase.from('gastos').select('*').gte('fecha', aISO(rango.inicio)).lt('fecha', aISO(rango.fin)),
      ])
      setPedidos(peds || [])
      setGastos(gas || [])
      setCargando(false)
    }
    cargar()
  }, [rango])

  const resumen = useMemo(() => {
    const facturacion = pedidos.reduce((t, p) => t + Number(p.facturacion), 0)
    const costoMercaderia = pedidos.reduce((t, p) => t + Number(p.costo_mercaderia), 0)
    const costoEnvio = pedidos.reduce((t, p) => t + Number(p.costo_envio), 0)
    const gastosTotales = gastos.reduce((t, g) => t + Number(g.monto), 0)
    const resultadoNeto = facturacion - costoMercaderia - costoEnvio - gastosTotales
    const ticketPromedio = pedidos.length > 0 ? facturacion / pedidos.length : 0

    const gastosPorCategoria = {}
    gastos.forEach((g) => {
      gastosPorCategoria[g.categoria] = (gastosPorCategoria[g.categoria] || 0) + Number(g.monto)
    })

    const pedidosPorZona = {}
    pedidos.forEach((p) => {
      pedidosPorZona[p.zona] = (pedidosPorZona[p.zona] || 0) + 1
    })

    const ventasPorProducto = {}
    pedidos.forEach((p) => {
      ;(p.pedido_items || []).forEach((it) => {
        ventasPorProducto[it.producto_nombre] = (ventasPorProducto[it.producto_nombre] || 0) + it.cantidad
      })
    })
    const ranking = Object.entries(ventasPorProducto)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6)

    return { facturacion, costoMercaderia, costoEnvio, gastosTotales, resultadoNeto, ticketPromedio, gastosPorCategoria, pedidosPorZona, ranking }
  }, [pedidos, gastos])

  const evolucion = useMemo(() => {
    if (modo === 'semanal') {
      const buckets = Array.from({ length: 7 }, (_, i) => ({ label: DIAS_SEMANA[i], value: 0 }))
      pedidos.forEach((p) => {
        const dia = new Date(p.created_at).getDay()
        const idx = dia === 0 ? 6 : dia - 1
        buckets[idx].value += Number(p.facturacion)
      })
      return buckets
    }
    const semanas = Math.ceil((rango.fin - rango.inicio) / (7 * 24 * 60 * 60 * 1000))
    const buckets = Array.from({ length: semanas }, (_, i) => ({ label: `Sem ${i + 1}`, value: 0 }))
    pedidos.forEach((p) => {
      const dias = Math.floor((new Date(p.created_at) - rango.inicio) / (24 * 60 * 60 * 1000))
      const idx = Math.min(Math.floor(dias / 7), buckets.length - 1)
      if (idx >= 0) buckets[idx].value += Number(p.facturacion)
    })
    return buckets
  }, [pedidos, modo, rango])

  function exportarCSV() {
    const filas = [
      ['Período', rango.etiqueta],
      [],
      ['Facturación total', resumen.facturacion],
      ['Costo de mercadería', resumen.costoMercaderia],
      ['Costo de envío', resumen.costoEnvio],
      ['Gastos totales', resumen.gastosTotales],
      ['Resultado neto', resumen.resultadoNeto],
      ['Parte por socio/empresa (÷6)', resumen.resultadoNeto / 6],
      ['Ticket promedio', resumen.ticketPromedio],
      ['Cantidad de pedidos', pedidos.length],
      [],
      ['Gastos por categoría'],
      ...Object.entries(resumen.gastosPorCategoria).map(([cat, monto]) => [
        CATEGORIAS_GASTO.find((c) => c.value === cat)?.label ?? cat,
        monto,
      ]),
      [],
      ['Pedidos por zona'],
      ...Object.entries(resumen.pedidosPorZona).map(([zona, cant]) => [zona, cant]),
      [],
      ['Ranking de productos'],
      ...resumen.ranking.map((r) => [r.nombre, r.cantidad]),
    ]
    const csv = filas.map((fila) => fila.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balance_${modo}_${aISO(rango.inicio)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Header titulo="Balance" />
      <div className="contenido">
        <div className="periodo-selector">
          <button className={`chip${modo === 'semanal' ? ' activo' : ''}`} onClick={() => setModo('semanal')}>
            Semanal
          </button>
          <button className={`chip${modo === 'mensual' ? ' activo' : ''}`} onClick={() => setModo('mensual')}>
            Mensual
          </button>
        </div>

        <div className="flex-entre" style={{ marginBottom: 14 }}>
          <button className="btn--secundario btn btn--chico" onClick={() => moverPeriodo(-1)}>
            ‹
          </button>
          <strong>{rango.etiqueta}</strong>
          <button className="btn--secundario btn btn--chico" onClick={() => moverPeriodo(1)}>
            ›
          </button>
        </div>

        {cargando ? (
          <p className="cargando">Calculando balance...</p>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat">
                <div className="stat__label">Facturación</div>
                <div className="stat__valor">{formatCurrency(resumen.facturacion)}</div>
              </div>
              <div className="stat">
                <div className="stat__label">Costo mercadería</div>
                <div className="stat__valor">{formatCurrency(resumen.costoMercaderia)}</div>
              </div>
              <div className="stat">
                <div className="stat__label">Gastos</div>
                <div className="stat__valor">{formatCurrency(resumen.gastosTotales)}</div>
              </div>
              <div className="stat">
                <div className="stat__label">Resultado neto</div>
                <div className={`stat__valor ${resumen.resultadoNeto >= 0 ? 'stat__valor--positivo' : 'stat__valor--negativo'}`}>
                  {formatCurrency(resumen.resultadoNeto)}
                </div>
              </div>
            </div>

            <div className="card">
              <h2>Reparto (÷6: 5 socios + empresa)</h2>
              <div className="stat__valor" style={{ color: 'var(--cobalto)' }}>
                {formatCurrency(resumen.resultadoNeto / 6)}
              </div>
              <p className="texto-suave">por cada socio y una parte igual para el fondo de la empresa.</p>
            </div>

            <div className="card">
              <h2>Evolución</h2>
              <BarChart data={evolucion} />
            </div>

            <div className="stats-grid">
              <div className="stat">
                <div className="stat__label">Ticket promedio</div>
                <div className="stat__valor">{formatCurrency(resumen.ticketPromedio)}</div>
              </div>
              <div className="stat">
                <div className="stat__label">Pedidos</div>
                <div className="stat__valor">{formatNumber(pedidos.length)}</div>
              </div>
            </div>

            <div className="card">
              <h2>Ranking de productos</h2>
              {resumen.ranking.length === 0 ? (
                <p className="vacio">Sin ventas en este período.</p>
              ) : (
                resumen.ranking.map((r, i) => (
                  <div key={r.nombre} className="flex-entre" style={{ padding: '6px 0' }}>
                    <span>
                      {i + 1}. {r.nombre}
                    </span>
                    <strong>{formatNumber(r.cantidad)}</strong>
                  </div>
                ))
              )}
            </div>

            <div className="card">
              <h2>Pedidos por zona</h2>
              {Object.keys(resumen.pedidosPorZona).length === 0 ? (
                <p className="vacio">Sin pedidos en este período.</p>
              ) : (
                Object.entries(resumen.pedidosPorZona).map(([zona, cant]) => (
                  <div key={zona} className="flex-entre" style={{ padding: '6px 0' }}>
                    <span>{zona}</span>
                    <strong>{cant}</strong>
                  </div>
                ))
              )}
            </div>

            <div className="card">
              <h2>Gastos por categoría</h2>
              {Object.keys(resumen.gastosPorCategoria).length === 0 ? (
                <p className="vacio">Sin gastos en este período.</p>
              ) : (
                Object.entries(resumen.gastosPorCategoria).map(([cat, monto]) => (
                  <div key={cat} className="flex-entre" style={{ padding: '6px 0' }}>
                    <span>{CATEGORIAS_GASTO.find((c) => c.value === cat)?.label ?? cat}</span>
                    <strong>{formatCurrency(monto)}</strong>
                  </div>
                ))
              )}
            </div>

            <button className="btn btn--secundario" onClick={exportarCSV}>
              Exportar CSV
            </button>
          </>
        )}
      </div>
    </>
  )
}
