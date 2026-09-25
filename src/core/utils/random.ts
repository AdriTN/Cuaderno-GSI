export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Muestreo ponderado sin reemplazo (Efraimidis–Spirakis). */
export function weightedSample<T>(items: readonly T[], weight: (x: T) => number, n: number): T[] {
  return items.map(x => ({ x, k: Math.pow(Math.random(), 1 / Math.max(weight(x), 1e-3)) }))
    .sort((a, b) => b.k - a.k).slice(0, n).map(o => o.x);
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
