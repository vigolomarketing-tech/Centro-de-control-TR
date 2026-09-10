import { semaforoFoodCost } from '../lib/calc'
import { formatPercent } from '../lib/format'

export default function Semaforo({ pct }) {
  const nivel = semaforoFoodCost(pct)
  return <span className={`semaforo semaforo--${nivel}`}>{formatPercent(pct)}</span>
}
