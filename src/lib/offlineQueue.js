import { supabase } from './supabaseClient'

// Cola de pedidos pendientes de sincronizar cuando no hay internet.
// Se guarda en localStorage y se reintenta al volver la conexión.

const STORAGE_KEY = 'tr_pedidos_pendientes'
let listeners = []

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // localStorage lleno o no disponible: no hay mucho más para hacer acá
  }
  listeners.forEach((cb) => cb(queue.length))
}

export function subscribeQueue(cb) {
  listeners.push(cb)
  cb(readQueue().length)
  return () => {
    listeners = listeners.filter((l) => l !== cb)
  }
}

export function getQueueCount() {
  return readQueue().length
}

function genLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

async function insertPedido(pedido) {
  const { items, ...pedidoFields } = pedido
  const { data, error } = await supabase.from('pedidos').insert(pedidoFields).select('id').single()
  if (error) throw error
  const itemsConPedidoId = items.map((item) => ({ ...item, pedido_id: data.id }))
  const { error: itemsError } = await supabase.from('pedido_items').insert(itemsConPedidoId)
  if (itemsError) throw itemsError
  return data
}

function encolar(pedido) {
  const queue = readQueue()
  queue.push(pedido)
  writeQueue(queue)
}

// Guarda un pedido. Si hay internet lo manda directo a Supabase;
// si falla o está offline, lo deja en la cola local para sincronizar después.
export async function guardarPedido(pedido) {
  const pedidoConId = { ...pedido, creado_en_local_id: genLocalId() }
  if (!navigator.onLine) {
    encolar(pedidoConId)
    return { offline: true }
  }
  try {
    await insertPedido(pedidoConId)
    return { offline: false }
  } catch (err) {
    encolar(pedidoConId)
    return { offline: true, error: err }
  }
}

export async function flushQueue() {
  if (!navigator.onLine) return
  const queue = readQueue()
  if (queue.length === 0) return
  const remaining = []
  for (const pedido of queue) {
    try {
      await insertPedido(pedido)
    } catch {
      remaining.push(pedido)
    }
  }
  writeQueue(remaining)
}

let initialized = false
export function initOfflineSync() {
  if (initialized) return
  initialized = true
  window.addEventListener('online', flushQueue)
  flushQueue()
}
