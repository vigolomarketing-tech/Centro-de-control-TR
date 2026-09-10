import { useEffect, useState } from 'react'
import { subscribeQueue } from '../lib/offlineQueue'

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    function goOnline() {
      setOnline(true)
    }
    function goOffline() {
      setOnline(false)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    const unsub = subscribeQueue(setPendientes)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      unsub()
    }
  }, [])

  if (online && pendientes === 0) return null

  return (
    <div className="offline-banner">
      {!online
        ? pendientes > 0
          ? `Sin conexión · ${pendientes} pedido(s) guardados para sincronizar`
          : 'Sin conexión · se está trabajando offline'
        : `Sincronizando ${pendientes} pedido(s) pendientes...`}
    </div>
  )
}
