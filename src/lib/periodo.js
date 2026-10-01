import { useMemo, useState } from 'react'
import { formatDate } from './format'

function lunesDeSemana(fecha) {
  const d = new Date(fecha)
  const dia = d.getDay()
  const offset = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  return d
}

export function sumarDias(fecha, dias) {
  const d = new Date(fecha)
  d.setDate(d.getDate() + dias)
  return d
}

export function aISO(d) {
  return d.toISOString().slice(0, 10)
}

// Hook compartido para elegir un período semanal o mensual, con navegación prev/siguiente.
export function usePeriodo(modoInicial = 'semanal') {
  const [modo, setModo] = useState(modoInicial)
  const [referencia, setReferencia] = useState(new Date())

  const rango = useMemo(() => {
    if (modo === 'semanal') {
      const inicio = lunesDeSemana(referencia)
      const fin = sumarDias(inicio, 7)
      return { inicio, fin, etiqueta: `${formatDate(inicio)} — ${formatDate(sumarDias(fin, -1))}` }
    }
    const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1)
    const fin = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 1)
    const etiqueta = inicio.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    return { inicio, fin, etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) }
  }, [modo, referencia])

  function moverPeriodo(delta) {
    setReferencia((prev) => {
      const d = new Date(prev)
      if (modo === 'semanal') d.setDate(d.getDate() + delta * 7)
      else d.setMonth(d.getMonth() + delta)
      return d
    })
  }

  return { modo, setModo, rango, moverPeriodo }
}
