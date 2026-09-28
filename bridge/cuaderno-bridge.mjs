#!/usr/bin/env node
/**
 * Puente de Cuaderno GSI: permite que la versión web de la app use Claude con TU suscripción,
 * a través de Claude Code instalado en este ordenador (modo no interactivo `claude -p`).
 *
 * Seguridad:
 *  - Solo escucha en 127.0.0.1: no es accesible desde la red ni desde otros equipos.
 *  - Exige un código de emparejamiento en cada petición (se genera la primera vez).
 *  - Solo acepta peticiones del navegador desde las webs permitidas (CORS).
 *  - Claude se ejecuta en una carpeta vacía y sin herramientas: no puede leer ni tocar archivos
 *    ni ejecutar comandos; solo responde texto.
 *
 * Uso:
 *   node cuaderno-bridge.mjs                          arranca el puente
 *   node cuaderno-bridge.mjs --origen https://tu-usuario.github.io   añade tu web a las permitidas
 *   node cuaderno-bridge.mjs --codigo                 muestra el código de emparejamiento
 *   node cuaderno-bridge.mjs --nuevo-codigo           genera un código nuevo (invalida el anterior)
 *   node cuaderno-bridge.mjs --instalar               arranque automático al iniciar Windows
 *
 * Requisitos: Node 18 o superior y Claude Code instalado con tu cuenta (`claude` y luego /login).
 */
import { spawn, execFile } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.1.0';
const HOST = '127.0.0.1';
const PORT = Number(process.env.PUENTE_PUERTO || 47821);
const IS_WIN = process.platform === 'win32';
const CONFIG_DIR = join(homedir(), '.cuaderno-gsi');
const CONFIG_FILE = join(CONFIG_DIR, 'puente.json');
const CLAUDE_BIN = process.env.CLAUDE_BIN || (IS_WIN ? 'claude.cmd' : 'claude');
const CREDENTIALS = process.env.CLAUDE_CREDENTIALS || join(homedir(), '.claude', '.credentials.json');
const USAGE_URL = process.env.USAGE_URL || 'https://api.anthropic.com/api/oauth/usage';
const TIMEOUT_MS = 5 * 60 * 1000;
const MAX_BODY = 2 * 1024 * 1024;
// Herramientas que se eliminan del todo: Claude solo puede contestar texto.
const NO_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,NotebookEdit,Task,TodoWrite,Agent,Skill';

/* ---------------------------------------------------------------- configuración */
function loadConfig() {
  let cfg = {};
  try { cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')); } catch { /* primera vez */ }
  let changed = false;
  if (!cfg.token) { cfg.token = randomBytes(18).toString('base64url'); changed = true; }
  if (!Array.isArray(cfg.origins)) { cfg.origins = ['http://localhost:8080', 'http://127.0.0.1:8080']; changed = true; }
  if (changed) saveConfig(cfg);
  return cfg;
}
function saveConfig(cfg) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}
const cfg = loadConfig();
const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] ?? '') : null; };

if (args.includes('--nuevo-codigo')) { cfg.token = randomBytes(18).toString('base64url'); saveConfig(cfg); console.log('Código nuevo generado. El anterior ya no sirve.'); }
const origin = arg('--origen');
if (origin) {
  const o = origin.replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+$/.test(o)) { console.error('El origen debe ser del tipo https://tu-usuario.github.io (sin ruta).'); process.exit(1); }
  if (!cfg.origins.includes(o)) { cfg.origins.push(o); saveConfig(cfg); }
  console.log(`Web permitida: ${o}`);
}
if (args.includes('--codigo')) { console.log(`Código de emparejamiento: ${cfg.token}`); process.exit(0); }
if (args.includes('--instalar')) { installStartup(); process.exit(0); }

function installStartup() {
  if (!IS_WIN) { console.log('El arranque automático solo está preparado para Windows. En Linux/macOS usa un servicio de usuario.'); return; }
  const startup = join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const self = fileURLToPath(import.meta.url);
  const file = join(startup, 'Cuaderno GSI - puente.cmd');
  writeFileSync(file, `@echo off\r\nstart "Cuaderno GSI - puente" /min node "${self}"\r\n`);
  console.log(`Listo: el puente se abrirá minimizado al iniciar sesión en Windows.\n(${file})`);
}

/* ---------------------------------------------------------------- Claude Code */
let claudeVersion = null;
function detectClaude() {
  return new Promise(resolve => {
    execFile(CLAUDE_BIN, ['--version'], { shell: IS_WIN, timeout: 20000 }, (err, out) => resolve(err ? null : String(out).trim()));
  });
}

/** Ejecuta una consulta en Claude Code (modo no interactivo) y devuelve el texto de la respuesta. */
function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const cwd = mkdtempSync(join(tmpdir(), 'cuaderno-gsi-')); // carpeta vacía: sin configuración de proyecto
    const argv = ['-p', '--output-format', 'json', '--max-turns', '2', '--permission-mode', 'dontAsk', '--disallowedTools', NO_TOOLS];
    if (cfg.model) argv.push('--model', cfg.model);
    const child = spawn(CLAUDE_BIN, argv, { cwd, shell: IS_WIN, windowsHide: true, env: { ...process.env, CI: '1' } });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Claude tardó demasiado en responder (más de 5 minutos).')); }, TIMEOUT_MS);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => { clearTimeout(timer); reject(new Error(e.code === 'ENOENT' ? 'No se encuentra Claude Code. Instálalo y ejecuta `claude` una vez para iniciar sesión.' : e.message)); });
    child.on('close', code => {
      clearTimeout(timer);
      try { rmSync(cwd, { recursive: true, force: true }); } catch { /* */ }
      let data = null;
      try { data = JSON.parse(out.trim().split('\n').filter(Boolean).pop() || 'null'); } catch { /* salida no JSON */ }
      if (data && typeof data.result === 'string' && !data.is_error) return resolve(data.result);
      const reason = (data && data.result) || err.trim() || `Claude Code terminó con el código ${code}.`;
      if (/login|auth|credential|401/i.test(reason)) return reject(new Error('Claude Code no tiene la sesión iniciada. Abre una terminal, ejecuta `claude` y escribe /login.'));
      if (/rate.?limit|usage limit|limit reached/i.test(reason)) return reject(Object.assign(new Error('Has alcanzado el límite de uso de tu suscripción. Espera a que se reinicie la sesión.'), { code: 'limit' }));
      reject(new Error(reason.slice(0, 400)));
    });
    child.stdin.end(prompt, 'utf8');
  });
}

// Una consulta cada vez: la suscripción tiene límites y así el orden es predecible.
let chain = Promise.resolve();
const enqueue = fn => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

/* ---------------------------------------------------------------- uso de la suscripción */
// El dato es el mismo que muestra /usage en Claude Code. Este servicio NO es una API oficial de Anthropic:
// puede cambiar o dejar de funcionar; en ese caso la app simplemente no muestra el uso.
// Anthropic limita mucho las consultas a este servicio (responde 429 si se pregunta a menudo, y además lo usa
// Claude Code). Por eso: el dato se reutiliza 5 minutos (1 tras una consulta de IA), y ante un 429 se espera lo que
// diga Retry-After o, si no lo dice, un tiempo que se duplica en cada intento (2, 4, 8… hasta 30 min), sin volver
// a preguntar mientras tanto. Entretanto se devuelve el último dato bueno, marcado como no actualizado.
const USAGE_FRESH_MS = 5 * 60_000, USAGE_AFTER_QUERY_MS = 60_000, USAGE_MAX_WAIT_MS = 30 * 60_000;
let usageCache = { at: 0, data: null, dirty: false, blockedUntil: 0, backoff: 2 * 60_000 };
const hhmm = t => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const stale = msg => (usageCache.data ? { ...usageCache.data, stale: true, note: msg } : { error: msg, retryAt: new Date(usageCache.blockedUntil || Date.now()).toISOString() });
async function readUsage() {
  const now = Date.now();
  if (usageCache.data && now - usageCache.at < (usageCache.dirty ? USAGE_AFTER_QUERY_MS : USAGE_FRESH_MS)) return usageCache.data;
  if (now < usageCache.blockedUntil) return stale(`Anthropic limita cuántas veces se puede consultar el uso. Se volverá a intentar a las ${hhmm(usageCache.blockedUntil)}.`);
  let token;
  try { token = JSON.parse(readFileSync(CREDENTIALS, 'utf8'))?.claudeAiOauth?.accessToken; } catch { /* */ }
  if (!token) return { error: 'No se encuentran las credenciales de Claude Code en este equipo (en macOS se guardan en el llavero y no se pueden leer).' };
  try {
    const r = await fetch(USAGE_URL, { headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': `cuaderno-gsi-puente/${VERSION}` }, signal: AbortSignal.timeout(10000) });
    if (r.status === 429) {
      const ra = Number(r.headers.get('retry-after'));
      const wait = Math.min(USAGE_MAX_WAIT_MS, Number.isFinite(ra) && ra > 0 ? ra * 1000 : usageCache.backoff);
      usageCache.blockedUntil = now + wait;
      usageCache.backoff = Math.min(USAGE_MAX_WAIT_MS, usageCache.backoff * 2);
      console.log(`${new Date().toLocaleTimeString('es-ES')}  uso: Anthropic pide esperar (429); siguiente intento a las ${hhmm(usageCache.blockedUntil)}`);
      return stale(`Anthropic limita cuántas veces se puede consultar el uso. Se volverá a intentar a las ${hhmm(usageCache.blockedUntil)}.`);
    }
    if (!r.ok) return usageCache.data ? stale(`El servicio de uso respondió ${r.status}; se muestra el último dato.`) : { error: r.status === 401 ? 'La sesión de Claude Code ha caducado: abre `claude` para renovarla.' : `El servicio de uso respondió ${r.status}.` };
    const j = await r.json();
    const win = w => (w && typeof w.utilization === 'number' ? { pct: w.utilization, resetsAt: w.resets_at ?? null } : null);
    const data = { fiveHour: win(j.five_hour), sevenDay: win(j.seven_day), fetchedAt: new Date().toISOString(), source: 'puente' };
    usageCache = { at: Date.now(), data, dirty: false, blockedUntil: 0, backoff: 2 * 60_000 };
    return data;
  } catch (e) { return usageCache.data ? stale(`No se pudo consultar el uso (${e.message}); se muestra el último dato.`) : { error: `No se pudo consultar el uso: ${e.message}` }; }
}

/* ---------------------------------------------------------------- servidor */
const okToken = h => {
  const given = Buffer.from(String(h || '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(cfg.token);
  return given.length === want.length && timingSafeEqual(given, want);
};
function cors(req, res) {
  const o = req.headers.origin;
  if (o && cfg.origins.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true'); // Chrome: web pública → localhost
    res.setHeader('Access-Control-Max-Age', '600');
  }
  return !o || cfg.origins.includes(o);
}
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };

const server = createServer(async (req, res) => {
  const allowed = cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(allowed ? 204 : 403); return res.end(); }
  if (!allowed) return send(res, 403, { error: 'Esta web no está permitida en el puente. Añádela con --origen.' });
  if (!okToken(req.headers.authorization)) return send(res, 401, { error: 'Código de emparejamiento incorrecto.' });
  const url = new URL(req.url, `http://${HOST}`);
  try {
    if (req.method === 'GET' && url.pathname === '/v1/estado') {
      return send(res, 200, { ok: true, version: VERSION, claude: claudeVersion, model: cfg.model || null });
    }
    if (req.method === 'GET' && url.pathname === '/v1/uso') return send(res, 200, await readUsage());
    if (req.method === 'POST' && url.pathname === '/v1/consulta') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > MAX_BODY) return send(res, 413, { error: 'Consulta demasiado grande.' }); }
      const { prompt } = JSON.parse(body || '{}');
      if (typeof prompt !== 'string' || !prompt.trim()) return send(res, 400, { error: 'Falta la consulta.' });
      const started = Date.now();
      const text = await enqueue(() => runClaude(prompt));
      usageCache.dirty = true; // el uso ha cambiado: se podrá volver a leer al cabo de un minuto
      console.log(`${new Date().toLocaleTimeString('es-ES')}  consulta respondida en ${((Date.now() - started) / 1000).toFixed(1)} s`);
      return send(res, 200, { text });
    }
    send(res, 404, { error: 'Ruta desconocida.' });
  } catch (e) {
    console.error(`${new Date().toLocaleTimeString('es-ES')}  error: ${e.message}`);
    send(res, e.code === 'limit' ? 429 : 502, { error: e.message, code: e.code });
  }
});

claudeVersion = await detectClaude();
server.listen(PORT, HOST, () => {
  console.log(`\nCuaderno GSI - puente ${VERSION}`);
  console.log(`Escuchando en http://${HOST}:${PORT} (solo este equipo)`);
  console.log(claudeVersion ? `Claude Code: ${claudeVersion}` : 'AVISO: no se encuentra Claude Code. Instálalo y ejecuta `claude` para iniciar sesión.');
  console.log(`Webs permitidas: ${cfg.origins.join(', ')}`);
  console.log(`Código de emparejamiento: ${cfg.token}\n`);
  console.log('Pega la dirección y el código en la app: Ajustes → Inteligencia artificial → Puente en tu PC.');
  console.log('Deja esta ventana abierta mientras uses la app. Ctrl+C para cerrar.\n');
});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `El puerto ${PORT} está ocupado: ¿ya hay un puente abierto?` : e.message); process.exit(1); });
