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

async function assemble(result) {
  const js = result.outputFiles.find(f => f.path.endsWith('.js')).text;
  const css = result.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? '';
  const content = await readFile('data/content.json', 'utf8');
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
