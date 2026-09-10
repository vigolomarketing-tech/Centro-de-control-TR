import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSocios } from '../lib/useSocios'
import { usePeriodo, aISO } from '../lib/periodo'
import { formatCurrency } from '../lib/format'
import Header from '../components/Header'

function calcularTransferencias(saldos) {
  const acreedores = saldos
    .filter((s) => s.saldo > 1)
    .map((s) => ({ ...s }))
    .sort((a, b) => b.saldo - a.saldo)
  const deudores = saldos
    .filter((s) => s.saldo < -1)
    .map((s) => ({ ...s, saldo: -s.saldo }))
    .sort((a, b) => b.saldo - a.saldo)

  const transferencias = []
  let i = 0
  let j = 0
  while (i < deudores.length && j < acreedores.length) {
    const deudor = deudores[i]
    const acreedor = acreedores[j]
    const monto = Math.min(deudor.saldo, acreedor.saldo)
    if (monto > 1) {
      transferencias.push({ de: deudor.nombre, a: acreedor.nombre, monto })
    }
    deudor.saldo -= monto
    acreedor.saldo -= monto
    if (deudor.saldo <= 1) i++
    if (acreedor.saldo <= 1) j++
  }
  return transferencias
}

export default function CuentasSocios() {
  const { socios } = useSocios()
  const { modo, setModo, rango, moverPeriodo } = usePeriodo('mensual')
  const [gastos, setGastos] = useState([])
  const [turnos, setTurnos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const [{ data: gas }, { data: tur }] = await Promise.all([
        supabase.from('gastos').select('monto, pagado_por').gte('fecha', aISO(rango.inicio)).lt('fecha', aISO(rango.fin)),
        supabase.from('turnos').select('fecha, socio_id').gte('fecha', aISO(rango.inicio)).lt('fecha', aISO(rango.fin)),
      ])
      setGastos(gas || [])
      setTurnos(tur || [])
      setCargando(false)
    }
    cargar()
  }, [rango])

  const datos = useMemo(() => {
    if (socios.length === 0) return { totalGastos: 0, correspondeCadaUno: 0, saldos: [], transferencias: [] }

    const totalGastos = gastos.reduce((t, g) => t + Number(g.monto), 0)
    const correspondeCadaUno = totalGastos / socios.length

    const puestoPorSocio = {}
    gastos.forEach((g) => {
      puestoPorSocio[g.pagado_por] = (puestoPorSocio[g.pagado_por] || 0) + Number(g.monto)
    })

    const nochesPorSocio = {}
    turnos.forEach((t) => {
      if (!nochesPorSocio[t.socio_id]) nochesPorSocio[t.socio_id] = new Set()
      nochesPorSocio[t.socio_id].add(t.fecha)
    })

    const saldos = socios.map((s) => {
      const puso = puestoPorSocio[s.id] || 0
      const noches = nochesPorSocio[s.id]?.size || 0
      return { id: s.id, nombre: s.nombre, puso, noches, saldo: puso - correspondeCadaUno }
    })

    const transferencias = calcularTransferencias(saldos)

    return { totalGastos, correspondeCadaUno, saldos, transferencias }
  }, [socios, gastos, turnos])

  return (
    <>
      <Header titulo="Cuentas entre socios" />
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
          <p className="cargando">Calculando cuentas...</p>
        ) : (
          <>
            <div className="card">
              <div className="flex-entre">
                <span>Gastos totales del período</span>
                <strong>{formatCurrency(datos.totalGastos)}</strong>
              </div>
              <div className="flex-entre" style={{ marginTop: 6 }}>
                <span>A cada socio le corresponde poner</span>
                <strong>{formatCurrency(datos.correspondeCadaUno)}</strong>
              </div>
            </div>

            <div className="seccion-titulo">Saldo por socio</div>
            {datos.saldos
              .slice()
              .sort((a, b) => b.saldo - a.saldo)
              .map((s) => (
                <div key={s.id} className="socio-saldo">
                  <div>
                    <div className="socio-saldo__nombre">{s.nombre}</div>
                    <div className="socio-saldo__detalle">
                      Puso {formatCurrency(s.puso)} · {s.noches} noche{s.noches === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className={`socio-saldo__monto ${s.saldo >= 0 ? 'socio-saldo__monto--favor' : 'socio-saldo__monto--debe'}`}>
                    {s.saldo >= 0 ? '+' : ''}
                    {formatCurrency(s.saldo)}
                  </div>
                </div>
              ))}

            <div className="seccion-titulo">Para quedar a cero</div>
            {datos.transferencias.length === 0 ? (
              <p className="vacio">Todos están al día. No hace falta transferir nada.</p>
            ) : (
              datos.transferencias.map((t, i) => (
                <div key={i} className="transferencia">
                  <span>
                    <strong>{t.de}</strong> le transfiere <strong>{formatCurrency(t.monto)}</strong> a <strong>{t.a}</strong>
                  </span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </>
  )
}
