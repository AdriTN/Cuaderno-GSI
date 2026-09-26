# Cuaderno GSI

App de estudio para la oposición al Cuerpo de Gestión de Sistemas e Informática del Estado (GSI, A2).

## Secciones

- **Hoy**: agenda del día según el plan, progreso del temario, fases y minutos por día.
- **Temario**: 57 temas con subrayado persistente, notas, esquema con IA y tarjetas desde el texto.
- **Tarjetas**: 221 automáticas + propias + generadas con IA, con repaso espaciado.
- **Entrenamiento**: por bloques y temas, no vistas, últimos errores o puntos débiles (adaptativo);
  corrección inmediata con explicación y procedencia; temas a reforzar al terminar.
- **Refuerzo**: errores y dudas programados con repetición espaciada.
- **Examen**: oficiales INAP 2022 y 2024, simulacro aleatorio, examen a medida, corrección de tu
  examen de 2025 con la plantilla provisional y biblioteca de PDF oficiales.
- **Supuestos**: 6 oficiales del INAP (2022-2025), 8 del material y generados con IA, con
  cronómetro por pregunta y corrección con la rúbrica del tribunal.
- **Cuadernos prácticos**, **Progreso**, **Plan** reprogramable y **Ajustes**.

Se publica como un único archivo HTML (requisito de los artifacts de Claude), pero el código fuente
está organizado en módulos con TypeScript y Preact, y un script de build lo empaqueta.

## Comandos

```bash
npm install
npm run build        # dist/index.html: un único HTML para publicar como artifact de Claude
npm run build:web    # dist-web/: versión web instalable (PWA) para GitHub Pages
npm run preview      # compila la versión web y la sirve en http://localhost:8080
npm run dev          # recompila al guardar
npm run typecheck    # comprobación de tipos (tsc --noEmit)
npm run content -- ../Preparacion-GSI   # regenera data/content.json desde el repositorio del temario
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube este proyecto a la rama `main`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push a `main` ejecuta `.github/workflows/deploy.yml`: comprueba tipos, compila la versión web
   y la publica en `https://<tu-usuario>.github.io/<repositorio>/`.

La versión web incluye manifiesto, iconos y un service worker: se puede instalar en el móvil como una
app y funciona sin conexión. Cada publicación cambia la versión del service worker, así que la app
instalada se actualiza sola la siguiente vez que se abre con conexión.

### Instalar en el móvil

- **Android (Chrome):** abre la web → menú ⋮ → *Instalar aplicación*. También hay un botón en Ajustes.
- **iPhone (Safari):** abre la web → *Compartir* → *Añadir a pantalla de inicio*.

### Datos y privacidad en la versión web

- El progreso se guarda en el navegador del dispositivo (no hay nube fuera de Claude). Para moverlo,
  *Ajustes → Exportar copia* e *Importar copia*.
- El repositorio y la web publicada no contienen ninguna clave ni dato personal.

## Inteligencia artificial

| Dónde abres la app | Cómo funciona la IA | Qué gasta |
|---|---|---|
| Dentro de Claude (artifact, también en la app de Claude del móvil) | Automática | La suscripción de Claude de quien la abre |
| Versión web, modo «Mi suscripción de Claude» (por defecto) | La app prepara la consulta, la pegas en claude.ai y pegas la respuesta | Tu suscripción de Claude |
| Versión web, modo «Clave de la API» (opcional) | Automática | Créditos de la API de Anthropic (aparte de la suscripción) |

No existe una forma oficial de que una web externa use una suscripción de Claude: por eso fuera de Claude
se usa el puente de copiar y pegar, o la API con clave propia (guardada solo en el navegador).

## Agente de Claude con tu suscripción

`.github/workflows/claude.yml` usa la GitHub Action oficial de Claude Code con tu suscripción Pro o Max
(sin API ni pagos extra; el uso cuenta en los límites de tu plan):

1. Instala Claude Code en tu equipo y ejecuta `claude setup-token`; copia el token que genera.
2. En el repositorio: *Settings → Secrets and variables → Actions → New repository secret*, con nombre
   `CLAUDE_CODE_OAUTH_TOKEN` y el token como valor.
3. Instala la app de GitHub de Claude en el repositorio: https://github.com/apps/claude
4. Escribe `@claude` en un issue o comentario con lo que quieras («añade…», «corrige…»). Solo responde al
   propietario del repositorio.

Con el mismo secreto, el aviso diario de novedades incluye una explicación de Claude sobre qué supone cada
una. `CLAUDE.md` resume la arquitectura y las normas para que el agente trabaje con el contexto correcto.

## Novedades automáticas de la oposición

`.github/workflows/novedades.yml` se ejecuta cada mañana y lanza `scripts/check_updates.py`, que revisa:

- **El BOE**, mediante su API de datos abiertos: convocatorias, listas, tribunales, nombramientos… que
  mencionen los cuerpos configurados.
- **Las páginas del INAP** de cada convocatoria: documentos nuevos (cuestionarios, plantillas, notas…).

Si hay novedades: guarda `data/live.json`, vuelve a publicar la app (la instalada en el móvil se actualiza
sola) y abre un *issue* con la etiqueta `novedades`. La primera ejecución solo toma nota de lo que ya existe.

### Recibirlas por correo

- **Sin configurar nada:** GitHub envía por correo los *issues* nuevos de tus repositorios. Comprueba en
  GitHub → *Settings → Notifications* que tienes activado *Email* para *Watching*, y que el repositorio
  está en *Watch → All Activity* (es lo predeterminado para tus propios repositorios).
- **A cualquier dirección (opcional):** crea estos secretos en *Settings → Secrets and variables → Actions*:
  `MAIL_SERVER` (p. ej. `smtp.gmail.com`), `MAIL_PORT` (`465`), `MAIL_USERNAME` (tu correo),
  `MAIL_PASSWORD` (en Gmail, una *contraseña de aplicación*, no tu contraseña normal) y `MAIL_TO`.

### Vigilar otras oposiciones

Edita `data/sources.json`: añade cuerpos a `boe.keywords` y páginas a `pages` (nombre, dirección y año).
Para lanzar una comprobación en el momento: pestaña *Actions → Novedades de la oposición → Run workflow*.

La app publicada como artifact de Claude no puede consultar webs externas: allí las novedades son las
del momento en que se publicó. La versión web de GitHub Pages es la que se mantiene sola.

## Arquitectura

```
src/
├── main.tsx              Arranque: plan inicial, cronómetro, render y capacidades (sync, IA)
├── index.html            Plantilla; build.mjs inyecta CSS, contenido y JS
├── app/
│   ├── App.tsx           Tabla de rutas → páginas
│   └── router.ts         Enrutado por hash (#seccion/parametro) con signals
├── core/                 Sin interfaz: todo lo que no es visual
│   ├── types.ts          Modelo de contenido y de estado persistido
│   ├── content.ts        Acceso tipado e índices del contenido incrustado
│   ├── domain/           Lógica pura y testeable (sin DOM ni estado global)
│   │   ├── srs.ts        Repaso espaciado de preguntas y tarjetas
│   │   ├── plan.ts       Semanas, fases, reparto y reprogramación de temas
│   │   ├── exam.ts       Selección de preguntas, test adaptativo, simulacros
│   │   ├── stats.ts      Estadísticas, netos y análisis de confianza
│   │   └── cards.ts      Tarjetas automáticas y propias
│   ├── store/
│   │   ├── store.ts      Documentos del usuario + revision (signal) + commit()
│   │   ├── defaults.ts   Valores por defecto y normalización (migraciones)
│   │   ├── actions.ts    ÚNICO punto que modifica el estado
│   │   ├── selectors.ts  Lecturas derivadas
│   │   └── sync.ts       Sincronización con la base de datos del artifact
│   ├── services/
│   │   ├── platform.ts   Acceso seguro a las capacidades del visor de Claude
│   │   ├── ai.ts         Envoltorio de la IA (texto, JSON, errores)
│   │   └── prompts.ts    Plantillas de prompts centralizadas
│   └── utils/            Fechas, formato, aleatoriedad y texto
├── ui/                   Sistema de diseño: componentes propios con su CSS
│   ├── Button, Panel, PageHeader, Figures, Modal, toast, charts, Icon
│   └── controls.tsx      Meter, Tag, Segmented, Tabs, Checkbox, Field, Row, Callout…
├── features/             Una carpeta por sección, con sus páginas, estado efímero y CSS
│   ├── layout/           Shell (menú lateral, barra inferior) y cronómetro de estudio
│   ├── today/  syllabus/  cards/  test/  review/  mocks/  cases/  practice/  progress/  plan/  settings/
└── styles/               tokens.css (paleta y escala), base.css, reading.css
```

### Principios

- **Capas con dependencias en un solo sentido**: `features → ui/core`, `core/store → core/domain`.
  El dominio no conoce la interfaz ni el almacenamiento, así que se puede probar de forma aislada.
- **Mutaciones centralizadas**: los componentes leen con `useDocs()` y selectores, y escriben solo
  mediante `actions.ts`. Cada acción llama a `commit()`, que guarda en local, marca para sincronizar
  y repinta.
- **Diseño por tokens**: colores, tipografía, espaciado y radios en `styles/tokens.css`, con modo
  oscuro. Los componentes usan clases con prefijo (`c-` componentes, `l-` layout, `p-`/`t-`/`s-`… páginas).
- **Compatibilidad de datos**: las claves de `localStorage` y el formato de los documentos se mantienen
  entre versiones; `normalize()` completa los campos nuevos.
- **Reinicio coherente**: borrar o importar datos emite `onReset`, y cada módulo con estado en memoria
  (cronómetro, test en curso, tarjetas, supuesto) lo descarta sin volver a escribir.
- **Sin pérdidas**: el test o examen en curso se guarda en el navegador y se recupera al recargar.
- **Degradación elegante**: fuera de Claude (abriendo `dist/index.html` en local) no hay sincronización
  ni IA, y la app funciona igual guardando en el navegador.

### Datos del usuario

Seis documentos JSON (`core`, `srs`, `notes`, `cases`, `cards`, `gen`), cada uno por debajo de 250 KB:
se guardan en `localStorage` y, dentro de Claude, en `data/users/<id>/…` de la base de datos del artifact.

## Créditos del contenido

El temario, las preguntas, los supuestos del material y los cuadernos prácticos proceden de
**Preparación GSI**, creado por AngeldelaCalleFernandez
(https://github.com/AngeldelaCalleFernandez/Preparacion-GSI), con licencia de uso gratuito y no
comercial con atribución (texto completo en `CONTENT_LICENSE.txt`). Este proyecto es una adaptación
modificada: interfaz y código nuevos, plan, repaso espaciado, tarjetas, sincronización e IA. No es el
proyecto original ni está respaldado por su creador. Los supuestos, cuestionarios y plantillas
oficiales proceden del INAP.
