import { signal } from '@preact/signals';
import './overlay.css';

type Toast = { id: number; text: string };
const toasts = signal<Toast[]>([]);
let seq = 0;

/** Aviso breve no bloqueante. Solo se muestra el último para no amontonarlos. */
export function toast(text: string) {
  const id = ++seq;
  toasts.value = [{ id, text }];
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 2800);
}

export const ToastHost = () => (
  <div class="c-toasts" role="status" aria-live="polite">{toasts.value.map(t => <div class="c-toast" key={t.id}>{t.text}</div>)}</div>
);
