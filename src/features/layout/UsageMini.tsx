import { usage } from '@/core/services/usage';
import { insideClaude } from '@/core/services/ai';

/** Resumen del uso de la suscripción en la barra lateral (enlaza a Ajustes). */
export function UsageMini() {
  const u = usage.value;
  if (insideClaude || !u) return null;
  const bar = (label: string, p?: number) => p === undefined ? null : (
    <div class="l-usage__row"><span>{label}</span><span class="l-usage__bar"><span style={{ width: `${Math.min(100, p)}%`, background: p >= 90 ? 'var(--bad)' : p >= 70 ? 'var(--warn)' : 'var(--accent)' }} /></span><span class="u-num">{Math.round(p)} %</span></div>
  );
  return (
    <a class="l-usage" href="#ajustes" title="Uso de tu suscripción de Claude">
      <span class="l-usage__title">Uso de Claude</span>
      {bar('Sesión', u.fiveHour?.pct)}
      {bar('Semana', u.sevenDay?.pct)}
    </a>
  );
}
