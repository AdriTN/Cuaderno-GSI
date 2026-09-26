// Empaqueta la app en un único HTML autocontenido (requisito para publicarla como artifact).
import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

/*
 * Dos destinos:
 *  - por defecto → dist/index.html: un único HTML para publicar como artifact de Claude.
 *  - --web      → dist-web/: el mismo HTML + manifiesto, iconos y service worker (PWA para GitHub Pages).
 */
const watch = process.argv.includes('--watch');
const web = process.argv.includes('--web');
const OUT_DIR = web ? 'dist-web' : 'dist';
const OUT = `${OUT_DIR}/index.html`;
const PWA_TAGS = `<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Cuaderno GSI">`;

const readJson = async (path, fallback = null) => { try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw new Error(`${path}: ${e.message}`); } };

/**
 * El contenido base (data/content.json) se genera desde el repositorio del temario y no se edita a mano.
 * Aquí se le añade lo propio de este repositorio:
 *  - data/preparatic.json: exámenes A2 de PreparaTIC (scripts/import_preparatic.mjs).
 *  - data/library-extra.json: aprobados, notas de corte, nombramientos e interinos de la biblioteca oficial.
 */
async function loadContent() {
  const content = await readJson('data/content.json');
  const topics = new Set(content.topics.map(t => t.id));
  const ids = new Set(content.questions.map(q => q.i));
  const ptic = await readJson('data/preparatic.json');
  content.pastExams = [];
  if (ptic) {
    const fresh = ptic.questions.filter(q => topics.has(q.t) && !ids.has(q.i));
    if (fresh.length < ptic.questions.length) console.warn(`  aviso: ${ptic.questions.length - fresh.length} preguntas de PreparaTIC descartadas (tema desconocido o id repetido)`);
    for (const q of fresh) { content.questions.push(q); ids.add(q.i); }
    content.pastExams = ptic.exams.map(e => ({ id: e.id, label: e.label, year: e.year, turno: e.turno, q: e.q.filter(id => ids.has(id)) })).filter(e => e.q.length);
    content.preparatic = { url: ptic.source.url, version: ptic.source.version, imported: ptic.source.imported };
  }
  const extra = await readJson('data/library-extra.json');
  for (const [year, docs] of Object.entries(extra?.years ?? {})) {
    let entry = content.library.find(l => String(l.year) === year);
    if (!entry) content.library.push((entry = { year: Number(year), status: '', page: '', docs: [] }));
    const known = new Set(entry.docs.map(d => d.url));
    entry.docs.push(...docs.filter(d => !known.has(d.url)).map(({ kind, label, url }) => ({ kind, label, url })));
  }
  content.library.sort((a, b) => b.year - a.year);
  return JSON.stringify(content);
}

async function assemble(result) {
  const js = result.outputFiles.find(f => f.path.endsWith('.js')).text;
  const css = result.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? '';
  const content = await loadContent();
  // Novedades y documentos detectados por scripts/check_updates.py (se incrustan sin la lista interna «known»).
  let live = '{}';
  try { const l = JSON.parse(await readFile('data/live.json', 'utf8')); delete l.known; live = JSON.stringify(l); } catch { /* aún no hay comprobaciones */ }
  const shell = await readFile('src/index.html', 'utf8');
  // "</" dentro de un <script> cerraría la etiqueta antes de tiempo.
  const safe = s => s.replaceAll('</', '<\\/');
  const html = shell
    .replace('<!--__PWA__-->', () => (web ? PWA_TAGS : ''))
    .replace('/*__CSS__*/', () => css)
    .replace('__CONTENT__', () => safe(content))
    .replace('__LIVE__', () => safe(live))
    .replace('/*__JS__*/', () => safe(js));
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, html);
  if (web) {
    // Estáticos de la PWA; la versión del service worker es el hash del HTML, así cada build fuerza la actualización.
    await cp('public', OUT_DIR, { recursive: true });
    const version = createHash('sha256').update(html).digest('hex').slice(0, 12);
    const sw = await readFile('public/sw.js', 'utf8');
    await writeFile(`${OUT_DIR}/sw.js`, sw.replace('__VERSION__', version));
    await writeFile(`${OUT_DIR}/.nojekyll`, '');
  }
  console.log(`✓ ${OUT} (${(html.length / 1e6).toFixed(2)} MB)${web ? ' + PWA' : ''}`);
}

const options = {
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: !watch,
  sourcemap: false,
  write: false,
  outdir: `${OUT_DIR}/tmp`,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  alias: { '@': './src' },
  logLevel: 'warning',
  plugins: [{ name: 'assemble', setup(b) { b.onEnd(r => r.errors.length ? null : assemble(r)); } }],
};

if (web) await rm(OUT_DIR, { recursive: true, force: true });
if (watch) { const ctx = await esbuild.context(options); await ctx.watch(); console.log('Vigilando cambios…'); }
else await esbuild.build(options);
