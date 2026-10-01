import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function useSocios() {
  const [socios, setSocios] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, nombre, email')
      .order('nombre')
      .then(({ data }) => {
        setSocios(data || [])
        setCargando(false)
      })
  }, [])

  return { socios, cargando }
}
