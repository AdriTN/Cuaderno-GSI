/**
 * Responde las consultas pendientes de requests/ con Claude Code (modo no interactivo).
 * Claude se ejecuta sin herramientas y en una carpeta vacía: solo puede devolver texto.
 * Nunca escribe en el registro el contenido de las consultas ni de las respuestas.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NO_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,NotebookEdit,Task,TodoWrite,Agent,Skill';
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const ID = /^[a-z0-9-]{8,64}$/;
const pending = readdirSync('requests').filter(f => f.endsWith('.json'));
console.log(`Consultas pendientes: ${pending.length}`);

function ask(prompt) {
  const cwd = mkdtempSync(join(tmpdir(), 'cgsi-'));
  const r = spawnSync(CLAUDE, ['-p', '--output-format', 'json', '--max-turns', '2', '--permission-mode', 'dontAsk', '--disallowedTools', NO_TOOLS],
    { cwd, input: prompt, encoding: 'utf8', timeout: 6 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 });
  rmSync(cwd, { recursive: true, force: true });
  let data = null;
  try { data = JSON.parse((r.stdout || '').trim().split('\n').filter(Boolean).pop() || 'null'); } catch { /* */ }
  if (data && typeof data.result === 'string' && !data.is_error) return { text: data.result };
  const reason = (data && data.result) || (r.error && r.error.message) || (r.stderr || '').trim() || `código ${r.status}`;
  if (/rate.?limit|usage limit|limit reached/i.test(reason)) return { error: 'Has alcanzado el límite de uso de tu suscripción. Espera a que se reinicie la sesión.', code: 'limit' };
  if (/login|auth|credential|401|token/i.test(reason)) return { error: 'El token de Claude no es válido o ha caducado. Genera otro con `claude setup-token` y actualiza el secreto CLAUDE_CODE_OAUTH_TOKEN.', code: 'auth' };
  return { error: `Claude no pudo responder: ${reason.slice(0, 300)}` };
}

for (const f of pending) {
  const path = join('requests', f);
  let req;
  try { req = JSON.parse(readFileSync(path, 'utf8')); } catch { rmSync(path); continue; }
  const id = String(req.id || f.replace(/\.json$/, ''));
  if (!ID.test(id) || typeof req.prompt !== 'string') { rmSync(path); continue; }
  const started = Date.now();
  const out = ask(req.prompt);
  writeFileSync(join('responses', `${id}.json`), JSON.stringify({ id, ...out, at: new Date().toISOString() }));
  rmSync(path);
  console.log(`${id}: ${out.error ? 'error' : 'respondida'} en ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

// Uso de la suscripción (servicio no oficial: si el token no lo permite, simplemente no se guarda).
try {
  const r = await fetch('https://api.anthropic.com/api/oauth/usage', { headers: { Authorization: `Bearer ${process.env.CLAUDE_CODE_OAUTH_TOKEN}`, 'anthropic-beta': 'oauth-2025-04-20' }, signal: AbortSignal.timeout(10000) });
  if (r.ok) {
    const j = await r.json(), win = w => (w && typeof w.utilization === 'number' ? { pct: w.utilization, resetsAt: w.resets_at ?? null } : null);
    writeFileSync(join('responses', '_uso.json'), JSON.stringify({ fiveHour: win(j.five_hour), sevenDay: win(j.seven_day), fetchedAt: new Date().toISOString(), source: 'agente' }));
    console.log('Uso de la suscripción actualizado');
  } else console.log(`Uso no disponible con este token (${r.status})`);
} catch { console.log('Uso no disponible'); }

// Limpieza: respuestas de más de un día que la app no llegó a recoger.
for (const f of readdirSync('responses')) {
  if (!f.endsWith('.json') || f.startsWith('_')) continue;
  const p = join('responses', f);
  if (Date.now() - statSync(p).mtimeMs > 24 * 3600 * 1000) rmSync(p);
}
