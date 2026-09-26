# Cuaderno GSI: guía para agentes de Claude

App de estudio para la oposición GSI (A2) del Estado. Preact + TypeScript + esbuild. Todo el texto de la
interfaz está en español de España y se dirige al usuario de «tú».

## Comandos

- `npm run typecheck`: debe pasar siempre antes de dar un cambio por bueno.
- `npm run build`: genera `dist/index.html` (artifact de Claude, un único HTML).
- `npm run build:web`: genera `dist-web/` (PWA para GitHub Pages).
- `python3 scripts/check_updates.py --dry-run`: prueba el vigilante de novedades sin escribir nada.

## Arquitectura (ver README para el detalle)

- `src/core/domain/`: lógica pura (plan, repaso espaciado, exámenes, estadísticas). Sin DOM ni estado global.
- `src/core/store/actions.ts`: ÚNICO sitio que modifica el estado; los componentes leen con `useDocs()` y selectores.
- `src/core/services/`: IA (`ai.ts`, con modos claude / manual / apikey), prompts, plataforma, PWA.
- `src/ui/`: sistema de diseño propio (Button, Panel, Dropdown, DatePicker, NumberField, Modal, confirmDialog…).
- `src/features/<sección>/`: páginas y estado efímero de cada sección.
- `data/content.json`: contenido generado (no editar a mano); `data/live.json`: novedades (lo escribe el vigilante).

## Normas

- No usar controles nativos (`<select>`, `type="date"`, `type="number"`, `confirm()`, `prompt()`): usar los de `src/ui/`.
- Colores, tipografía y espaciado solo mediante las variables de `src/styles/tokens.css`; probar tema claro y oscuro.
- Todo debe funcionar en móvil (390 px) y en escritorio; nada puede salirse de la pantalla ni cortar texto.
- Mantener compatibles las claves de `localStorage` y el formato de los documentos (usar `normalize()` para campos nuevos).
- Cualquier estado en memoria debe limpiarse con `onReset()` (se llama al borrar o importar datos).
- Nunca incluir claves, tokens ni datos personales en el repositorio.
