// Cálculos de costos y food cost, compartidos entre Recetas y Pedidos.

export const UNIDADES = ['kg', 'litro', 'unidad', 'docena', 'paquete', 'tanda']

export const CATEGORIAS_INSUMO = [
  { value: 'carne', label: 'Carne' },
  { value: 'panificados', label: 'Panificados' },
  { value: 'lacteos', label: 'Lácteos' },
  { value: 'verduleria', label: 'Verdulería' },
  { value: 'salsas', label: 'Salsas' },
  { value: 'papas', label: 'Papas' },
  { value: 'aceite', label: 'Aceite' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'otros', label: 'Otros' },
]

export const ZONAS = ['Longchamps', 'Glew', 'Burzaco', 'Adrogué', 'Retiro']
export const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercadopago', label: 'MercadoPago' },
]
export const CATEGORIAS_GASTO = [
  { value: 'insumos', label: 'Insumos' },
  { value: 'nafta', label: 'Nafta' },
  { value: 'gas', label: 'Gas' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'imprenta', label: 'Imprenta' },
  { value: 'sueldos', label: 'Sueldos' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'otros', label: 'Otros' },
]
export const ROLES_TURNO = [
  { value: 'cocina', label: 'Cocina' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'atencion', label: 'Atención de pedidos' },
]

export function costoUnitarioInsumo(insumo) {
  if (!insumo || !insumo.cantidad) return 0
  return Number(insumo.precio_compra) / Number(insumo.cantidad)
}

// items: [{ insumo_id, cantidad }], insumosById: { [id]: insumo }
export function costoProducto(items, insumosById) {
  return (items || []).reduce((total, item) => {
    const insumo = insumosById[item.insumo_id]
    if (!insumo) return total
    return total + Number(item.cantidad) * costoUnitarioInsumo(insumo)
  }, 0)
}

export function foodCostPct(costo, precioVenta) {
  if (!precioVenta) return 0
  return (costo / precioVenta) * 100
}

export function gananciaUnidad(costo, precioVenta) {
  return precioVenta - costo
}

// verde <=35%, amarillo 35-40%, rojo >40%
export function semaforoFoodCost(pct) {
  if (pct <= 35) return 'verde'
  if (pct <= 40) return 'amarillo'
  return 'rojo'
}

export function precioVigente(producto, promoActiva, promoVencimiento) {
  const vencida = promoVencimiento ? new Date(promoVencimiento) < new Date() : false
  if (promoActiva && !vencida && producto.precio_promo != null) {
    return { precio: Number(producto.precio_promo), esPromo: true }
  }
  return { precio: Number(producto.precio_normal), esPromo: false }
}
