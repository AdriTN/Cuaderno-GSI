export const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (h ? `${h}:${pad(m)}` : `${m}`) + `:${pad(x)}`;
};
export const num = (n: number, digits = 1) => (Math.round(n * 10 ** digits) / 10 ** digits).toLocaleString('es-ES');
export const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
export const hours = (sec: number) => (sec < 3600 ? `${Math.round(sec / 60)} min` : `${num(sec / 3600)} h`);
/** plural(3, 'tema', 'temas') → "3 temas" */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const words = (s = '') => s.trim().split(/\s+/).filter(Boolean).length;
export const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
