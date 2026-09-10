import { formatCurrency } from '../lib/format'

// Gráfico de barras simple en SVG. data: [{ label, value }]
export default function BarChart({ data, alto = 160, formatoValor = formatCurrency, color = '#1B2FB5' }) {
  if (!data || data.length === 0) {
    return <p className="vacio">Todavía no hay datos suficientes para graficar.</p>
  }

  const ancho = 320
  const paddingInferior = 24
  const paddingSuperior = 18
  const max = Math.max(...data.map((d) => d.value), 1)
  const anchoBarra = (ancho - 16) / data.length
  const areaAlto = alto - paddingInferior - paddingSuperior

  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} width="100%" height={alto} role="img">
      <line x1="8" y1={alto - paddingInferior} x2={ancho - 8} y2={alto - paddingInferior} stroke="#ddd3c0" strokeWidth="1" />
      {data.map((d, i) => {
        const h = (d.value / max) * areaAlto
        const x = 8 + i * anchoBarra + anchoBarra * 0.15
        const w = anchoBarra * 0.7
        const y = alto - paddingInferior - h
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={Math.max(h, 1)} fill={color} rx="3" />
            <text x={x + w / 2} y={y - 4} fontSize="9" textAnchor="middle" fill="#1B2FB5" fontWeight="700">
              {formatoValor(d.value)}
            </text>
            <text x={x + w / 2} y={alto - 8} fontSize="9" textAnchor="middle" fill="#5c5c66">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
