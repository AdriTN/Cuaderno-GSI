import { signal } from '@preact/signals';

/** Enrutado por hash (#seccion/parametro): funciona dentro del visor de artifacts sin servidor. */
export type Route = { name: string; param?: string };
const parse = (): Route => { const [name, param] = (location.hash.slice(1) || 'hoy').split('/'); return { name: name || 'hoy', param: param ? decodeURIComponent(param) : undefined }; };

export const route = signal<Route>(parse());
window.addEventListener('hashchange', () => { route.value = parse(); window.scrollTo(0, 0); });
export const navigate = (path: string) => { location.hash = path; };
export const href = (name: string, param?: string) => `#${name}${param ? '/' + encodeURIComponent(param) : ''}`;
