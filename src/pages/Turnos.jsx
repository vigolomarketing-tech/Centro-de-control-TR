import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSocios } from '../lib/useSocios'
import { ROLES_TURNO } from '../lib/calc'
import { formatDate, todayISO } from '../lib/format'
import Header from '../components/Header'
import ConfirmDialog from '../components/ConfirmDialog'

function etiquetaRol(valor) {
  return ROLES_TURNO.find((r) => r.value === valor)?.label ?? valor
}

export default function Turnos() {
  const { socios } = useSocios()
  const [fecha, setFecha] = useState(todayISO())
  const [socioId, setSocioId] = useState('')
  const [rol, setRol] = useState('cocina')
  const [turnosDelDia, setTurnosDelDia] = useState([])
  const [mesTurnos, setMesTurnos] = useState([])
  const [mes, setMes] = useState(todayISO().slice(0, 7))
  const [guardando, setGuardando] = useState(false)
  const [aBorrar, setABorrar] = useState(null)

  useEffect(() => {
    if (socios.length > 0 && !socioId) setSocioId(socios[0].id)
  }, [socios, socioId])

  async function cargarDia() {
    const { data } = await supabase
      .from('turnos')
      .select('*, profiles:socio_id (nombre)')
      .eq('fecha', fecha)
      .order('created_at')
    setTurnosDelDia(data || [])
  }

  async function cargarMes() {
    const desde = `${mes}-01`
    const [anio, mesNum] = mes.split('-').map(Number)
    const hasta = new Date(anio, mesNum, 0).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('turnos')
      .select('fecha, socio_id, profiles:socio_id (nombre)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
    setMesTurnos(data || [])
  }

  useEffect(() => {
    cargarDia()
  }, [fecha])

  useEffect(() => {
    cargarMes()
  }, [mes])

  async function agregarTurno() {
    if (!socioId) return
    setGuardando(true)
    await supabase.from('turnos').insert({ fecha, socio_id: socioId, rol })
    setGuardando(false)
    cargarDia()
    cargarMes()
  }

  async function borrar() {
    if (!aBorrar) return
    await supabase.from('turnos').delete().eq('id', aBorrar.id)
    setABorrar(null)
    cargarDia()
    cargarMes()
  }

  const resumenMensual = useMemo(() => {
    const map = {}
    mesTurnos.forEach((t) => {
      const nombre = t.profiles?.nombre ?? '—'
      if (!map[t.socio_id]) map[t.socio_id] = { nombre, fechas: new Set() }
      map[t.socio_id].fechas.add(t.fecha)
    })
    return Object.values(map)
      .map((s) => ({ nombre: s.nombre, noches: s.fechas.size }))
      .sort((a, b) => b.noches - a.noches)
  }, [mesTurnos])

  return (
    <>
      <Header titulo="Turnos" />
      <div className="contenido">
        <div className="card">
          <h2>Registrar turno</h2>
          <div className="form-grid">
            <div>
              <label>Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label>Socio</label>
              <select value={socioId} onChange={(e) => setSocioId(e.target.value)}>
                {socios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Rol</label>
              <div className="chip-selector">
                {ROLES_TURNO.map((r) => (
                  <button key={r.value} className={`chip${rol === r.value ? ' activo' : ''}`} onClick={() => setRol(r.value)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn" onClick={agregarTurno} disabled={guardando}>
              + Agregar
            </button>
          </div>
        </div>

        <div className="seccion-titulo">Turnos del {formatDate(fecha)}</div>
        {turnosDelDia.length === 0 ? (
          <p className="vacio">Nadie registrado todavía este día.</p>
        ) : (
          turnosDelDia.map((t) => (
            <div key={t.id} className="linea-pedido card" style={{ marginBottom: 8 }}>
              <div>
                <strong>{t.profiles?.nombre}</strong>
                <div className="texto-suave">{etiquetaRol(t.rol)}</div>
              </div>
              <button className="link-boton" style={{ color: 'var(--rojo)' }} onClick={() => setABorrar(t)}>
                ✕
              </button>
            </div>
          ))
        )}

        <div className="seccion-titulo">Resumen mensual</div>
        <div className="card">
          <label>Mes</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
        {resumenMensual.length === 0 ? (
          <p className="vacio">Sin turnos este mes.</p>
        ) : (
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Socio</th>
                  <th>Noches trabajadas</th>
                </tr>
              </thead>
              <tbody>
                {resumenMensual.map((s) => (
                  <tr key={s.nombre}>
                    <td>{s.nombre}</td>
                    <td>{s.noches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        abierto={!!aBorrar}
        titulo="¿Borrar turno?"
        mensaje="Se va a borrar este registro de turno."
        onConfirmar={borrar}
        onCancelar={() => setABorrar(null)}
      />
    </>
  )
}
