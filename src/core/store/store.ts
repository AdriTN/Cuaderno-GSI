import { signal } from '@preact/signals';
import type { Docs, DocKey } from '../types';
import { DOC_KEYS, normalize } from './defaults';

/**
 * Estado del usuario: seis documentos JSON que se guardan en localStorage y se sincronizan
 * con la base de datos del artifact. Se mutan en sitio y se confirman con `commit()`,
 * que incrementa `revision` para que los componentes que la leen se vuelvan a pintar.
 */
const LS_PREFIX = 'cuaderno-gsi-v1:';

function loadLocal(): Docs {
  const out = {} as Docs;
  for (const k of DOC_KEYS) {
    let raw: unknown = null;
    try { raw = JSON.parse(localStorage.getItem(LS_PREFIX + k) ?? 'null'); } catch { /* datos corruptos: se usan los valores por defecto */ }
    (out as any)[k] = normalize(k, raw);
  }
  return out;
}

export const docs: Docs = loadLocal();
export const revision = signal(0);
export const dirtyDocs = new Set<DocKey>();
type Listener = () => void;
const onCommitListeners: Listener[] = [];
export const onCommit = (fn: Listener) => { onCommitListeners.push(fn); };

/** Aviso de reinicio (borrado o importación): cada módulo con estado en memoria lo limpia. */
const onResetListeners: Listener[] = [];
export const onReset = (fn: Listener) => { onResetListeners.push(fn); };
export const emitReset = () => onResetListeners.forEach(fn => fn());

export function saveLocal(key: DocKey) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(docs[key])); } catch { /* cuota llena: se mantiene en memoria */ }
}

/** Marca documentos como modificados, los guarda en local y avisa a la UI y al sincronizador. */
export function commit(...keys: DocKey[]) {
  const now = Date.now();
  for (const k of keys) { docs[k].u = now; dirtyDocs.add(k); saveLocal(k); }
  revision.value++;
  onCommitListeners.forEach(fn => fn());
}

/** Sustituye un documento completo (sincronización o importación). */
export function replaceDoc(key: DocKey, raw: unknown, markDirty = false) {
  (docs as any)[key] = normalize(key, raw);
  saveLocal(key);
  if (markDirty) dirtyDocs.add(key);
  revision.value++;
}

/** Suscribe el componente que la llama a los cambios del estado. */
export const useDocs = () => { void revision.value; return docs; };
