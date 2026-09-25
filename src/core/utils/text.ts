/** Texto plano a partir de HTML confiable del temario. */
export function htmlToText(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent ?? '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}
/** Índice de la n-ésima aparición de `needle` en `hay`, o -1. */
export function nthIndexOf(hay: string, needle: string, n: number): number {
  let i = -1;
  for (let k = 0; k <= n; k++) { i = hay.indexOf(needle, i + 1); if (i < 0) return -1; }
  return i;
}
