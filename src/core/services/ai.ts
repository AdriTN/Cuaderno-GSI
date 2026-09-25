/**
 * IA de la app, con tres conexiones posibles:
 *  - "claude": dentro de Claude, con la capacidad `sample` del visor. Gasta el uso de Claude de quien abre la app.
 *  - "manual": fuera de Claude, puente de copiar y pegar con claude.ai: usa la suscripción de Claude del usuario.
 *  - "apikey": fuera de Claude y opcional, llamando a la API de Anthropic con la clave de ESTE navegador.
 * La clave se guarda solo en el localStorage de este dispositivo: no va en el HTML, no se sincroniza
 * con la nube y no se incluye en las copias exportadas. Quien use otra copia de la app pone la suya.
 */
import { signal } from '@preact/signals';
import { onReset } from '../store/store';
import { useCapability } from './platform';

type Sample = ((input: string, opts?: any) => Promise<{ text: string }>) & { json?: (input: string, opts?: any) => Promise<any> };
export type AiStatus = 'loading' | 'ready' | 'off';
export type AiBackend = 'claude' | 'manual' | 'apikey' | 'none';
export type AiMode = 'manual' | 'apikey';
export type Tier = 'quick' | 'default' | 'complex';

export const MODELS: [string, string][] = [
  ['claude-haiku-4-5-20251001', 'Rápido y económico (Haiku 4.5)'],
  ['claude-sonnet-5', 'Equilibrado (Sonnet 5), recomendado'],
  ['claude-opus-5-5', 'Máxima calidad (Opus 5.5), más caro'],
];
const KEY_LS = 'cuaderno-gsi-apikey', MODEL_LS = 'cuaderno-gsi-model', MODE_LS = 'cuaderno-gsi-aimode';
/** Dirección de la app publicada en Claude, donde la IA es automática con la suscripción. */
export const CLAUDE_APP_URL = 'https://claude.ai/artifact/4U7qwSsNbMjw98jLx1VAVy';
const readLS = (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };

/** Dentro de Claude la página no puede llamar a otros dominios, así que la clave propia solo aplica fuera. */
export const insideClaude = typeof window !== 'undefined' && !!window.claude?.use;
export const aiStatus = signal<AiStatus>('loading');
export const aiBackend = signal<AiBackend>('none');
export const apiKey = signal(readLS(KEY_LS));
export const apiModel = signal(readLS(MODEL_LS) || 'claude-sonnet-5');
export const aiMode = signal<AiMode>(readLS(MODE_LS) === 'apikey' ? 'apikey' : 'manual');
let sample: Sample | null = null;

function refresh() {
  if (sample) { aiBackend.value = 'claude'; aiStatus.value = 'ready'; return; }
  aiBackend.value = insideClaude ? 'none' : aiMode.value === 'apikey' && apiKey.value ? 'apikey' : aiMode.value === 'apikey' ? 'none' : 'manual';
  aiStatus.value = aiBackend.value === 'none' ? 'off' : 'ready';
}
export async function initAi() { sample = insideClaude ? await useCapability<Sample>('sample') : null; refresh(); }

export function setApiKey(key: string, model = apiModel.value) {
  try { key ? localStorage.setItem(KEY_LS, key) : localStorage.removeItem(KEY_LS); localStorage.setItem(MODEL_LS, model); } catch { /* sin almacenamiento: solo en memoria */ }
  apiKey.value = key; apiModel.value = model; refresh();
}
export function setAiMode(m: AiMode) { try { localStorage.setItem(MODE_LS, m); } catch { /* */ } aiMode.value = m; refresh(); }
/** «Borrar todo» también olvida la clave de este dispositivo y vuelve al modo por suscripción. */
onReset(() => { setApiKey('', 'claude-sonnet-5'); setAiMode('manual'); });

/* ---------- puente con claude.ai (suscripción) ---------- */
export type ManualRequest = { prompt: string; json: boolean; resolve: (text: string) => void; reject: (e: any) => void };
export const manualRequest = signal<ManualRequest | null>(null);
function viaClaudeApp(prompt: string, json: boolean): Promise<string> {
  return new Promise((resolve, reject) => { manualRequest.value?.reject(new AiError('Consulta cancelada.', 'cancelled')); manualRequest.value = { prompt, json, resolve, reject }; });
}

export class AiError extends Error { constructor(message: string, public code?: string) { super(message); } }

/* ---------- API de Anthropic (fuera de Claude) ---------- */
const API = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 8192;
const headers = () => ({ 'content-type': 'application/json', 'x-api-key': apiKey.value, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });

async function apiError(r: Response): Promise<AiError> {
  let msg = ''; try { msg = (await r.json())?.error?.message ?? ''; } catch { /* sin cuerpo */ }
  if (r.status === 401) return new AiError('La clave de la API no es válida o ha sido revocada. Revísala en Ajustes.', 'auth');
  if (r.status === 403) return new AiError('Tu clave no tiene permiso para usar este modelo.', 'forbidden');
  if (r.status === 404) return new AiError('El modelo elegido no está disponible para tu clave. Prueba otro en Ajustes.', 'model');
  if (r.status === 429) return new AiError('Demasiadas consultas seguidas en tu cuenta de la API. Espera un minuto.', 'rate_limited');
  if (r.status === 529) return new AiError('La API está saturada en este momento. Inténtalo en unos minutos.', 'overloaded');
  if (r.status === 400 && /usage limit|spend/i.test(msg)) return new AiError('Has alcanzado el límite de gasto de tu cuenta de la API.', 'limit');
  return new AiError(msg || `La API respondió con un error (${r.status}).`, 'api');
}

async function apiText(prompt: string, onText?: (t: string) => void): Promise<string> {
  let r: Response;
  try { r = await fetch(API, { method: 'POST', headers: headers(), body: JSON.stringify({ model: apiModel.value, max_tokens: MAX_TOKENS, stream: true, messages: [{ role: 'user', content: prompt }] }) }); }
  catch { throw new AiError('No hay conexión con la API de Anthropic. Revisa tu conexión a internet.', 'network'); }
  if (!r.ok || !r.body) throw await apiError(r);
  // Respuesta en streaming (SSE): eventos separados por línea en blanco, con el JSON en «data:».
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', text = '';
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const event = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = event.split('\n').find(l => l.startsWith('data:'))?.slice(5).trim();
      if (!data) continue;
      const ev = JSON.parse(data);
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { text += ev.delta.text; onText?.(text); }
      if (ev.type === 'error') throw new AiError(ev.error?.message ?? 'Error durante la respuesta.', 'api');
    }
  }
  return text;
}

/** Extrae el primer objeto o array JSON de una respuesta de texto. */
function parseJSON(text: string): any {
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch { /* sigue */ }
  const start = clean.search(/[[{]/), end = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
  throw new SyntaxError('Respuesta sin JSON');
}

/* ---------- interfaz común ---------- */
function ensure() {
  if (aiStatus.value === 'loading') throw new AiError('La IA aún se está cargando, prueba en unos segundos.');
  if (aiBackend.value === 'none') throw new AiError(insideClaude ? 'La IA no está disponible en esta vista.' : 'Falta la clave de la API. Añádela en Ajustes o vuelve al modo «Mi suscripción de Claude».', 'unavailable');
}

export async function askText(prompt: string, opts: { tier?: Tier; onText?: (text: string) => void } = {}) {
  ensure();
  if (aiBackend.value === 'apikey') return apiText(prompt, opts.onText);
  if (aiBackend.value === 'manual') { const t = await viaClaudeApp(prompt, false); opts.onText?.(t); return t; }
  const r = await sample!(prompt, { modelTier: opts.tier ?? 'default', onText: opts.onText ? ({ text }: { text: string }) => opts.onText!(text) : undefined });
  return r.text;
}

export async function askJSON<T>(prompt: string, tier: Tier = 'default'): Promise<T> {
  ensure();
  const onlyJson = prompt + '\n\nResponde únicamente con el JSON, sin texto antes ni después.';
  if (aiBackend.value === 'apikey') return parseJSON(await apiText(onlyJson));
  if (aiBackend.value === 'manual') return parseJSON(await viaClaudeApp(onlyJson, true));
  if (sample!.json) return sample!.json(prompt, { modelTier: tier });
  return parseJSON((await sample!(prompt, { modelTier: tier })).text);
}

/** Prueba corta para validar la clave desde Ajustes. */
export async function testApiKey(): Promise<string> {
  const text = await apiText('Responde solo con la palabra: correcto');
  return text.trim();
}

/** Mensaje comprensible para cualquier error de la IA. */
export function aiErrorMessage(e: any): string {
  if (e?.code === 'not_granted') { aiStatus.value = 'off'; return 'Has rechazado el uso de la IA en esta sesión. Recarga la página si quieres activarla.'; }
  if (e?.code === 'rate_limited' && !(e instanceof AiError)) return 'Demasiadas consultas seguidas. Espera un minuto y vuelve a intentarlo.';
  if (e?.code === 'cancelled') return 'Consulta cancelada.';
  if (e?.code === 'prompt_too_large') return 'El texto enviado es demasiado largo. Acorta tus respuestas e inténtalo de nuevo.';
  if (e instanceof SyntaxError) return 'La respuesta de la IA no tenía el formato esperado. Vuelve a intentarlo.';
  return e?.message || 'Algo falló al consultar a la IA.';
}
