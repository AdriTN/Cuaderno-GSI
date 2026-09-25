/**
 * Acceso seguro a las capacidades del visor de Claude (db, user, sample, downloads).
 * Fuera de Claude (p. ej. abriendo dist/index.html en local) `window.claude` no existe
 * y todo se degrada a null: la app funciona igual guardando solo en el navegador.
 */
type Claude = { use: (name: string) => Promise<any> };
declare global { interface Window { claude?: Claude } }

export async function useCapability<T = any>(name: string): Promise<T | null> {
  try { return window.claude?.use ? ((await window.claude.use(name)) as T | null) : null; }
  catch { return null; }
}
