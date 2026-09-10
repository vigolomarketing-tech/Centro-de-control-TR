import { formatCurrency, formatDateShort } from '../lib/format'

// Gráfico de línea simple en SVG, sin dependencias externas.
// data: [{ x: fecha o etiqueta, y: numero }]
export default function LineChart({ data, alto = 140, formatoY = formatCurrency, formatoX = formatDateShort }) {
  if (!data || data.length === 0) {
    return <p className="vacio">Todavía no hay datos suficientes para graficar.</p>
  }

  const ancho = 320
  const padding = 28
  const valores = data.map((d) => d.y)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1

  const puntos = data.map((d, i) => {
    const x = data.length === 1 ? ancho / 2 : padding + (i / (data.length - 1)) * (ancho - padding * 2)
    const y = alto - padding - ((d.y - min) / rango) * (alto - padding * 2)
    return { x, y, d }
  })

  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} width="100%" height={alto} role="img">
      <line x1={padding} y1={alto - padding} x2={ancho - padding} y2={alto - padding} stroke="#ddd3c0" strokeWidth="1" />
      <path d={linea} fill="none" stroke="#1B2FB5" strokeWidth="2.5" />
      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#1B2FB5" />
          {(i === 0 || i === puntos.length - 1) && (
            <text x={p.x} y={alto - 8} fontSize="9" textAnchor="middle" fill="#5c5c66">
              {formatoX(p.d.x)}
            </text>
          )}
        </g>
      ))}
      <text x={padding} y={12} fontSize="10" fill="#1B2FB5" fontWeight="700">
        {formatoY(max)}
      </text>
      <text x={padding} y={alto - padding - 4} fontSize="10" fill="#5c5c66">
        {formatoY(min)}
      </text>
    </svg>
  )
}
