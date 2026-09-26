#!/usr/bin/env node
/**
 * Importa la batería de exámenes A2 (Cuerpo de Gestión de Sistemas e Informática, AGE) de PreparaTIC
 * y la deja en data/preparatic.json, que build.mjs añade al banco de preguntas de la app.
 *
 * Fuente: https://www.preparatic.org/tests/ (grupo altruista de preparación de las oposiciones TIC).
 * Solo se toman los exámenes cuyo título empieza por «A2 AGE»: nada del temario A1 ni de otros cuerpos.
 *
 * Qué hace:
 *   1. Lee el catálogo de la app de PreparaTIC y localiza los módulos de cada examen A2.
 *   2. Interpreta cada módulo como literal de datos (sin ejecutar código de terceros).
 *   3. Descarta las preguntas mal formadas y las que ya están en la app (p. ej. los oficiales INAP 2022 y 2024),
 *      y avisa si la clave de PreparaTIC no coincide con la oficial.
 *   4. Asigna cada pregunta a un tema GSI: data/preparatic-map.json da los candidatos según el tema A1 de
 *      PreparaTIC y se elige el que más se parece al texto de la pregunta (TF-IDF contra los apuntes).
 *
 * Uso:
 *   npm run preparatic                 # descarga e importa
 *   npm run preparatic -- --dry-run    # solo informa, no escribe
 *   npm run preparatic -- --cache .cache/preparatic   # guarda/reutiliza las descargas (útil para ajustar el mapa)
 *
 * Requiere Node 18 o superior (fetch nativo). No tiene dependencias.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://www.preparatic.org/tests/';
const OUT = join(ROOT, 'data', 'preparatic.json');
const INCLUDE = /^A2 AGE\b/i;           // solo exámenes del Cuerpo de Gestión de Sistemas e Informática (A2) de la AGE
const OLD_AFTER_YEARS = 6;              // a partir de esta antigüedad se avisa de que la norma o la técnica pueden haber cambiado
const UA = 'CuadernoGSI/1.0 (importador de estudio personal; https://github.com)';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const CACHE = args.includes('--cache') ? args[args.indexOf('--cache') + 1] : null;

/* ------------------------------------------------------------------ descarga */
async function get(url) {
  const file = CACHE && join(CACHE, url.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_'));
  if (file && existsSync(file)) return readFile(file, 'utf8');
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      if (file) { await mkdir(CACHE, { recursive: true }); await writeFile(file, text); }
      return text;
    } catch (e) {
      if (attempt >= 3) throw new Error(`No se pudo descargar ${url}: ${e.message}`);
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
}

/* ------------------------------------------------ literal de JavaScript → datos */
/**
 * Los módulos de PreparaTIC son `const a="…",s=[{id:"1",text:"…",right:!0,…}];export{…}`.
 * En vez de ejecutarlos, se interpreta el literal: objetos, listas, cadenas, números, !0/!1, true/false/null.
 */
function parseLiteral(src, start) {
  let i = start;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const fail = msg => { throw new Error(`${msg} en la posición ${i}: «${src.slice(i, i + 40)}»`); };
  function str() {
    const q = src[i++]; let out = '';
    while (i < src.length && src[i] !== q) {
      if (src[i] !== '\\') { out += src[i++]; continue; }
      const c = src[++i]; i++;
      if (c === 'n') out += '\n'; else if (c === 't') out += '\t'; else if (c === 'r') out += '\r';
      else if (c === 'u') { const hex = src[i] === '{' ? src.slice(i + 1, src.indexOf('}', i)) : src.slice(i, i + 4); out += String.fromCodePoint(parseInt(hex, 16)); i += src[i] === '{' ? hex.length + 2 : 4; }
      else if (c === 'x') { out += String.fromCharCode(parseInt(src.slice(i, i + 2), 16)); i += 2; }
      else if (c === '\n') { /* continuación de línea */ } else out += c;
    }
    if (q === '`' && out.includes('${')) fail('Plantilla con expresiones no admitida');
    i++; return out;
  }
  function value() {
    ws(); const c = src[i];
    if (c === '[') { i++; const arr = []; ws(); if (src[i] === ']') { i++; return arr; } for (;;) { arr.push(value()); ws(); if (src[i] === ',') { i++; ws(); if (src[i] === ']') { i++; return arr; } continue; } if (src[i] === ']') { i++; return arr; } fail('Se esperaba «,» o «]»'); } }
    if (c === '{') {
      i++; const obj = {}; ws(); if (src[i] === '}') { i++; return obj; }
      for (;;) {
        ws(); let key;
        if (src[i] === '"' || src[i] === "'") key = str();
        else { const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(src.slice(i, i + 64)); if (!m) fail('Clave no válida'); key = m[0]; i += key.length; }
        ws(); if (src[i++] !== ':') fail('Se esperaba «:»');
        obj[key] = value(); ws();
        if (src[i] === ',') { i++; ws(); if (src[i] === '}') { i++; return obj; } continue; }
        if (src[i] === '}') { i++; return obj; }
        fail('Se esperaba «,» o «}»');
      }
    }
    if (c === '"' || c === "'" || c === '`') return str();
    if (src.startsWith('!0', i)) { i += 2; return true; }
    if (src.startsWith('!1', i)) { i += 2; return false; }
    for (const [w, v] of [['true', true], ['false', false], ['null', null], ['void 0', undefined]]) if (src.startsWith(w, i)) { i += w.length; return v; }
    const num = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(src.slice(i, i + 32));
    if (num) { i += num[0].length; return Number(num[0]); }
    fail('Valor no admitido');
  }
  const v = value();
  return v;
}

/** Valor de una constante exportada con un nombre (`export{s as questions}` → `s=[…]`). */
function exported(src, name) {
  const exp = [...src.matchAll(/export\s*\{([^}]*)\}/g)].at(-1); // el último: una pregunta de JS podría contener «export{»
  if (!exp) throw new Error('Módulo sin export');
  const local = exp[1].split(',').map(x => x.trim().split(/\s+as\s+/)).find(([, n]) => n === name)?.[0];
  if (!local) return undefined;
  const decl = new RegExp(`(?:^|[\\s,;])(?:const |let |var )?${local.replace('$', '\\$')}=(?=[\\[{"'\`])`).exec(src);
  if (!decl) throw new Error(`No se encontró la declaración de ${name}`);
  return parseLiteral(src, decl.index + decl[0].length);
}

/* ------------------------------------------------------------------ catálogo */
async function catalogue() {
  const html = await get(BASE);
  const indexFile = /assets\/(index-[\w]+\.js)/.exec(html)?.[1];
  if (!indexFile) throw new Error('No se encontró el script principal de la app de PreparaTIC');
  const index = await get(BASE + 'assets/' + indexFile);
  const tests = [];
  for (const m of index.matchAll(/\{[^{}]*?hash:"([0-9a-f]{32})"[^{}]*\}/g)) {
    const title = /title:"([^"]*)"/.exec(m[0])?.[1];
    const date = /date:"([^"]*)"/.exec(m[0])?.[1];
    if (title) tests.push({ hash: m[1], title, date: date?.slice(0, 10) ?? null });
  }
  // El mapa hash → módulo está en uno de los fragmentos que carga el script principal.
  const chunks = [...new Set([...index.matchAll(/["'/]((?:[\w]+-)?[\w]+-[0-9a-f]{8}\.js)["']/g)].map(m => m[1]))]
    .sort((a, b) => (b.startsWith('Filters') ? 1 : 0) - (a.startsWith('Filters') ? 1 : 0));
  for (const c of chunks) {
    const js = await get(BASE + 'assets/' + c).catch(() => '');
    if (!js.includes('data/tests/')) continue;
    const modules = {};
    for (const m of js.matchAll(/data\/tests\/([0-9a-f]{32})\.json"\s*:\s*\(\)\s*=>[^"]*import\("\.\/([^"]+)"\)/g)) modules[m[1]] = m[2];
    return { tests, modules, version: tests.map(t => t.date).filter(Boolean).sort().at(-1) ?? null };
  }
  throw new Error('No se encontró el índice de módulos de tests (¿ha cambiado la app de PreparaTIC?)');
}

/* -------------------------------------------------------------- normalización */
/**
 * Los textos se muestran como texto plano. Solo se sustituyen los saltos <br>; el resto se conserva tal cual,
 * porque hay preguntas sobre HTML, XML o genéricos (<article>, <svg>, IEnumerable<T>…).
 */
const clean = s => String(s ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
const fold = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const signature = (stmt, answers) => [stmt, ...[...answers].sort()].map(x => fold(x).replace(/[^a-z0-9]+/g, '')).join('|');

function examMeta(title) {
  const years = [...title.matchAll(/\b(19|20)\d{2}\b/g)].map(m => m[0]);
  const year = years[0] ?? '';
  const internal = /promoci[oó]n interna|\binterna\b/i.test(title);
  const reserve = /reserva/i.test(title);
  const yearLabel = years.length > 1 ? `${years[0]}-${years.at(-1)}` : year;
  const id = 'gsi-' + (years.length > 1 ? `${years[0]}-${years.at(-1)}` : year) + (internal ? '-pi' : '-li') + (reserve ? '-reserva' : '');
  const label = `GSI ${yearLabel}, ${internal ? 'promoción interna' : 'acceso libre'}${reserve ? ' (preguntas de reserva)' : ''}`;
  return { id, year, label, turno: internal ? 'PI' : 'LI', reserve };
}

/* ------------------------------------------------------------- clasificador */
const STOP = new Set(('a al algo algunas algunos ante antes como con contra cual cuales cuando de del desde donde dos el ella ellas ellos en entre era es esa esas ese eso esos esta estas este esto estos fue ha han hay la las le les lo los mas me mi muy no nos o otra otras otro otros para pero por que se segun ser si sin sobre son su sus tambien te tiene tienen todo todos tu un una unas uno unos y ya siguiente siguientes correcta correcto incorrecta incorrecto verdadera falsa respuesta opcion afirmacion afirmaciones ninguna todas anteriores cierta cierto indique senale puede pueden debe deben dicha dicho mediante cuya cuyo podemos podria entre respecto relacion caso forma parte').split(' '));
const tokens = s => fold(s).split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w) && !/^\d$/.test(w));

function buildClassifier(content) {
  const docs = content.topics.map(t => {
    const body = (content.content[t.id] ?? '').replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
    return { id: t.id, toks: [...tokens(t.title), ...tokens(t.title), ...tokens(t.title), ...tokens(body)] };
  });
  const df = new Map();
  for (const d of docs) for (const w of new Set(d.toks)) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = w => Math.log((docs.length + 1) / ((df.get(w) ?? 0) + 1)) + 1;
  const vecs = new Map(docs.map(d => {
    const tf = new Map(); for (const w of d.toks) tf.set(w, (tf.get(w) ?? 0) + 1);
    const v = new Map([...tf].map(([w, n]) => [w, (1 + Math.log(n)) * idf(w)]));
    const norm = Math.hypot(...v.values()) || 1; for (const [w, x] of v) v.set(w, x / norm);
    return [d.id, v];
  }));
  return text => {
    const tf = new Map(); for (const w of tokens(text)) tf.set(w, (tf.get(w) ?? 0) + 1);
    const q = new Map([...tf].filter(([w]) => df.has(w)).map(([w, n]) => [w, (1 + Math.log(n)) * idf(w)]));
    const norm = Math.hypot(...q.values()) || 1;
    const scores = {};
    for (const [id, v] of vecs) { let s = 0; for (const [w, x] of q) s += x * (v.get(w) ?? 0); scores[id] = s / norm; }
    return scores;
  };
}

/* ------------------------------------------------------------------- principal */
async function main() {
  const content = JSON.parse(await readFile(join(ROOT, 'data', 'content.json'), 'utf8'));
  const map = JSON.parse(await readFile(join(ROOT, 'data', 'preparatic-map.json'), 'utf8')).topics;
  const topicIds = new Set(content.topics.map(t => t.id));
  const classify = buildClassifier(content);
  const existing = new Map(content.questions.map(q => [signature(q.s, q.a), q]));
  // Las transcripciones de PreparaTIC y las de los PDF del INAP difieren en detalles (comillas, guiones, erratas):
  // además de la coincidencia exacta, se busca la pregunta oficial con casi las mismas palabras.
  const official = content.questions.filter(q => q.o === 'O').map(q => ({ q, w: new Set(tokens(`${q.s} ${q.a.join(' ')}`)) }));
  const jaccard = (a, b) => { let inter = 0; for (const x of a) if (b.has(x)) inter++; return inter / (a.size + b.size - inter || 1); };
  const findExisting = (stmt, texts, right) => {
    const exact = existing.get(signature(stmt, texts));
    if (exact) return exact;
    const w = new Set(tokens(`${stmt} ${texts.join(' ')}`));
    let best = null, bestJ = 0;
    for (const o of official) { const j = jaccard(w, o.w); if (j > bestJ) { bestJ = j; best = o.q; } }
    if (bestJ < 0.75) return null;
    // Dos preguntas parecidas pueden preguntar cosas distintas (p. ej. funciones de dos capas OSI): solo es la misma
    // si la respuesta correcta de PreparaTIC es, de las cuatro opciones oficiales, la más parecida a la oficial correcta.
    const mine = new Set(tokens(texts[right]));
    const closest = best.a.map(x => jaccard(mine, new Set(tokens(x))));
    return closest.indexOf(Math.max(...closest)) === best.c ? best : null;
  };
  /** Misma respuesta salvo erratas o recortes (p. ej. «Infrastructure» / «Infraestructure»). */
  const sameAnswer = (a, b) => { const x = fold(a).replace(/[^a-z0-9]+/g, ''), y = fold(b).replace(/[^a-z0-9]+/g, ''); return x === y || jaccard(new Set(tokens(a)), new Set(tokens(b))) >= 0.6; };

  console.log(`Leyendo el catálogo de ${BASE}…`);
  const { tests, modules, version } = await catalogue();
  const selected = tests.filter(t => INCLUDE.test(t.title) && modules[t.hash]);
  const missing = tests.filter(t => INCLUDE.test(t.title) && !modules[t.hash]);
  if (!selected.length) throw new Error('No se encontró ningún examen A2 AGE en PreparaTIC');
  console.log(`  ${tests.length} tests en el catálogo · ${selected.length} exámenes A2 AGE${missing.length ? ` (${missing.length} sin módulo)` : ''}`);

  const thisYear = new Date().getFullYear();
  const exams = [], questions = [], seen = new Map(), ids = new Set();
  const report = { invalid: 0, dupExisting: 0, dupInternal: 0, keyMismatch: [], reassigned: 0, perExam: [], check: { n: 0, ok: 0 } };

  /** Tema GSI de una pregunta: el candidato del mapa más parecido al texto; si no encaja ninguno, el más parecido de todo el programa. */
  function assignTopic(a1Topic, stmt, texts, right) {
    const candidates = (map[String(a1Topic)] ?? []).filter(id => topicIds.has(id));
    const scores = classify(`${stmt} ${texts.join(' ')} ${texts[right]}`);
    const bonus = id => (id === candidates[0] ? 0.01 : 0); // en caso de empate, el primero del mapa
    let topic = candidates.reduce((best, id) => (scores[id] + bonus(id) > scores[best] + bonus(best) ? id : best), candidates[0]);
    const global = Object.keys(scores).reduce((x, y) => (scores[y] > scores[x] ? y : x));
    if (!topic || (scores[topic] < 0.03 && scores[global] >= 0.1 && !candidates.includes(global))) return { topic: global, reassigned: true };
    return { topic, reassigned: false };
  }

  // Los más recientes primero: si una pregunta se repite, se queda en el examen más reciente.
  const recency = t => examMeta(t.title).year + (examMeta(t.title).turno === 'LI' ? '1' : '0');
  for (const t of [...selected].sort((a, b) => recency(b).localeCompare(recency(a)))) {
    const src = await get(BASE + 'assets/' + modules[t.hash]);
    const raw = exported(src, 'questions');
    if (!Array.isArray(raw)) throw new Error(`Formato inesperado en «${t.title}»`);
    const meta = examMeta(t.title);
    const old = meta.year && thisYear - Number(meta.year) >= OLD_AFTER_YEARS;
    // Primera pasada: validar y buscar cada pregunta en la app.
    const items = raw.map((q, k) => {
      const answers = [...(q.answers ?? [])].sort((a, b) => String(a.letter).localeCompare(String(b.letter)));
      const texts = answers.map(a => clean(a.answer));
      const right = answers.map((a, j) => (a.right ? j : -1)).filter(j => j >= 0);
      const stmt = clean(q.text);
      const valid = answers.length === 4 && right.length === 1 && !!stmt && texts.every(Boolean);
      return { q, n: k + 1, stmt, texts, right: right[0], valid, found: valid ? findExisting(stmt, texts, right[0]) : null };
    });
    const valid = items.filter(x => x.valid);
    report.invalid += items.length - valid.length;
    for (const it of valid.filter(x => x.found)) {
      const off = it.found;
      if (off.o === 'O') { report.check.n++; if (assignTopic(it.q.topic, it.stmt, it.texts, it.right).topic === off.t) report.check.ok++; }
      if (!sameAnswer(off.a[off.c], it.texts[it.right]))
        report.keyMismatch.push(`${t.title} #${it.n}: PreparaTIC «${it.texts[it.right].slice(0, 70)}» · app «${off.a[off.c].slice(0, 70)}» (${off.i})`);
    }
    // Si la mayoría ya está en la app, es un examen oficial ya incorporado (p. ej. INAP 2022 o 2024): no se añade nada.
    const already = valid.filter(x => x.found).length >= valid.length / 2;
    let kept = 0;
    const order = []; // el examen completo, en su orden, aunque alguna pregunta viva en otro examen o sea oficial
    for (const it of valid) {
      if (already || it.found) { report.dupExisting++; order.push(it.found?.i); continue; }
      const sig = signature(it.stmt, it.texts);
      if (seen.has(sig)) { report.dupInternal++; order.push(seen.get(sig)); continue; }
      const { topic, reassigned } = assignTopic(it.q.topic, it.stmt, it.texts, it.right);
      if (reassigned) report.reassigned++;
      let id = `PTIC-${it.q.id}`;
      if (ids.has(id)) id = `PTIC-${meta.id}-${it.n}`;
      ids.add(id); seen.set(sig, id); order.push(id);
      questions.push({
        i: id, t: topic, o: 'P', s: it.stmt, a: it.texts, c: it.right,
        f: `Respuesta según PreparaTIC: opción ${'ABCD'[it.right]}. No incluye explicación; si dudas, repasa el tema o pide la explicación a la IA.` +
          (old ? ` Es de ${meta.year}: pudo ser correcta entonces y la normativa o la técnica haber cambiado desde entonces.` : ''),
        p: `PreparaTIC, examen ${meta.label}, pregunta ${it.n}`,
        e: meta.year, x: meta.id, n: it.n,
      });
      kept++;
    }
    if (already) report.perExam.push(`  ${t.title.padEnd(34)} ${String(raw.length).padStart(4)} preguntas · ya está en la app (examen oficial)`);
    else report.perExam.push(`  ${t.title.padEnd(34)} ${String(raw.length).padStart(4)} preguntas · ${String(kept).padStart(4)} nuevas`);
    if (!already) exams.push({ id: meta.id, title: t.title, label: meta.label, year: meta.year, turno: meta.turno, q: order.filter(Boolean) });
  }

  exams.sort((a, b) => b.year.localeCompare(a.year) || a.turno.localeCompare(b.turno) || a.id.localeCompare(b.id));
  const out = {
    source: {
      name: 'PreparaTIC', url: BASE,
      note: 'Exámenes A2 (Gestión de Sistemas e Informática, AGE) recopilados por PreparaTIC. Claves de PreparaTIC; temas GSI asignados automáticamente.',
      version, imported: new Date().toISOString().slice(0, 10),
    },
    exams,
    questions,
  };

  console.log(report.perExam.join('\n'));
  console.log(`\n  Nuevas: ${questions.length} · ya en la app: ${report.dupExisting} · repetidas entre exámenes: ${report.dupInternal} · mal formadas: ${report.invalid} · reasignadas por texto: ${report.reassigned}`);
  if (report.check.n) console.log(`  Comprobación del tema asignado con las ${report.check.n} preguntas oficiales ya clasificadas: ${Math.round((100 * report.check.ok) / report.check.n)} % coinciden`);
  if (report.keyMismatch.length) console.log(`\n  ⚠ Claves distintas de las oficiales (${report.keyMismatch.length}):\n    ` + report.keyMismatch.join('\n    '));
  const perBlock = {}; for (const q of questions) { const b = q.t.slice(0, 2); perBlock[b] = (perBlock[b] ?? 0) + 1; }
  console.log('  Por bloque: ' + Object.entries(perBlock).sort().map(([b, n]) => `${b} ${n}`).join(' · '));

  if (DRY) { console.log('\n(--dry-run: no se escribe nada)'); return; }
  await writeFile(OUT, JSON.stringify(out, null, 0).replace(/\},\{"i"/g, '},\n{"i"') + '\n');
  console.log(`\n✓ ${OUT.replace(ROOT + '/', '').replace(ROOT + '\\', '')} (${questions.length} preguntas de ${out.exams.length} exámenes)`);
}

export { parseLiteral, exported, examMeta, signature, buildClassifier, clean };

// Solo se ejecuta al lanzarlo como script (así las funciones se pueden importar para probarlas).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
}
