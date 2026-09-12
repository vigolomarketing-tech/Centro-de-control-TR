// Parsea el mensaje de pedido tal cual sale por WhatsApp para cargarlo sin tipear.
//
// Formato esperado (ver checkout de la landing):
//
// *NUEVO PEDIDO - TACOS RUTH*
// ---
// 2x Hamburguesa Doble — $24.000
// 1x Menú 1 — $15.000
// ---
// *TOTAL: $39.000*
//
// Nombre: Juan
// Entrega: Delivery
// Dirección: Av. Hipólito Yrigoyen 1234, Longchamps
// Pago: Efectivo (paga con $50.000)
// Aclaraciones: sin cebolla

function normalizar(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function aNumero(texto) {
  if (!texto) return null
  const limpio = texto.replace(/[^\d.,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

const RE_ITEM = /^(\d+)\s*x\s+(.+?)\s*[—–-]\s*\$?\s*([\d.,]+)\s*$/i
const RE_CAMPO = /^([A-Za-zÁÉÍÓÚáéíóúñÑ ]+):\s*(.+)$/

export function parsearMensajeWhatsapp(texto) {
  const lineas = (texto || '')
    .split('\n')
    .map((l) => l.replace(/\*/g, '').trim())
    .filter(Boolean)

  const items = []
  let total = null
  let nombre = ''
  let direccion = ''
  let entrega = ''
  let pagoTexto = ''
  let aclaraciones = ''

  for (const linea of lineas) {
    if (linea === '---') continue

    if (/^total/i.test(linea)) {
      total = aNumero(linea)
      continue
    }

    const mItem = linea.match(RE_ITEM)
    if (mItem) {
      items.push({
        cantidad: Number(mItem[1]),
        nombreProducto: mItem[2].trim(),
        precioTotal: aNumero(mItem[3]),
      })
      continue
    }

    const mCampo = linea.match(RE_CAMPO)
    if (mCampo) {
      const campo = normalizar(mCampo[1])
      const valor = mCampo[2].trim()
      if (campo === 'nombre') nombre = valor
      else if (campo === 'direccion') direccion = valor
      else if (campo === 'entrega') entrega = valor
      else if (campo === 'pago') pagoTexto = valor
      else if (campo === 'aclaraciones') aclaraciones = valor
    }
  }

  let metodoPago = null
  const pagoNorm = normalizar(pagoTexto)
  if (pagoNorm.includes('transfer')) metodoPago = 'transferencia'
  else if (pagoNorm.includes('mercado')) metodoPago = 'mercadopago'
  else if (pagoNorm.includes('efectivo')) metodoPago = 'efectivo'

  let vuelto = null
  if (metodoPago === 'efectivo') {
    const mVuelto = pagoTexto.match(/\$\s*([\d.,]+)/)
    if (mVuelto) vuelto = aNumero(mVuelto[0])
  }

  return {
    items,
    total,
    nombre,
    direccion,
    entrega,
    metodoPago,
    vuelto,
    aclaraciones,
    textoPagoOriginal: pagoTexto,
  }
}

// Busca el producto del catálogo que mejor matchea el nombre parseado del mensaje.
export function emparejarProducto(nombreProducto, productos) {
  const norm = normalizar(nombreProducto)
  if (!norm) return null
  let match = productos.find((p) => normalizar(p.nombre) === norm)
  if (match) return match
  match = productos.find((p) => {
    const pn = normalizar(p.nombre)
    return pn.includes(norm) || norm.includes(pn)
  })
  return match || null
}

// Intenta adivinar la zona de entrega a partir de la dirección o del campo "Entrega".
export function detectarZona(direccion, entrega, zonas) {
  const dirNorm = normalizar(direccion)
  const encontrada = zonas.find((z) => dirNorm.includes(normalizar(z)))
  if (encontrada) return encontrada
  if (normalizar(entrega).includes('retiro')) return 'Retiro'
  return null
}
