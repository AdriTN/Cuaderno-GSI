import { useEffect, useState } from 'preact/hooks';
import { Icon } from './Icon';

type Props = { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; label: string; unit?: string };

/** Campo numérico propio: botones − / + grandes y escritura libre (sin las flechas nativas). */
export function NumberField({ value, onChange, min, max, step = 1, label, unit }: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const commit = (raw: string) => { const n = parseInt(raw.replace(/\D/g, ''), 10); const v = Number.isFinite(n) ? clamp(n) : value; setText(String(v)); if (v !== value) onChange(v); };
  return (
    <div class="c-num" role="group" aria-label={label}>
      <button type="button" class="c-num__btn" aria-label={`Restar ${step}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}><Icon name="minus" size={18} /></button>
      <label class="c-num__field">
        <input type="text" inputMode="numeric" pattern="[0-9]*" aria-label={label} value={text} onInput={e => setText((e.target as HTMLInputElement).value)} onBlur={e => commit((e.target as HTMLInputElement).value)}
          onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + step)); } if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - step)); } }} />
        {unit && <span class="c-num__unit">{unit}</span>}
      </label>
      <button type="button" class="c-num__btn" aria-label={`Sumar ${step}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}><Icon name="plus" size={18} /></button>
    </div>
  );
}
