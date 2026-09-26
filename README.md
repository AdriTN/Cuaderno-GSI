# Cuaderno GSI

App de estudio para la oposición al Cuerpo de Gestión de Sistemas e Informática del Estado (GSI, A2).

## Secciones

- **Hoy**: agenda del día según el plan, progreso del temario, fases y minutos por día.
- **Temario**: 57 temas con subrayado persistente, notas, esquema con IA y tarjetas desde el texto.
- **Tarjetas**: 221 automáticas + propias + generadas con IA, con repaso espaciado.
- **Entrenamiento**: por bloques y temas, no vistas, últimos errores o puntos débiles (adaptativo);
  corrección inmediata con explicación y procedencia; temas a reforzar al terminar.
- **Refuerzo**: errores y dudas programados con repetición espaciada.
- **Examen**: oficiales INAP 2022 y 2024, exámenes anteriores de GSI (PreparaTIC), simulacro aleatorio,
  examen a medida, corrección de tu examen de 2025 con la plantilla provisional y biblioteca oficial
  (exámenes, aprobados, notas de corte, nombramientos y listas de interinos).
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
npm run preparatic   # actualiza data/preparatic.json con los exámenes A2 de PreparaTIC
```

## Contenido propio de este repositorio

`data/content.json` se genera desde el repositorio del temario y no se edita a mano. `build.mjs` le añade:

- **`data/preparatic.json`**: exámenes anteriores del Cuerpo de Gestión de Sistemas e Informática (A2) de la
  AGE, acceso libre y promoción interna, recopilados por [PreparaTIC](https://www.preparatic.org/tests/).
  Solo se importan los exámenes cuyo título empieza por «A2 AGE»: nada del temario A1 ni de otros cuerpos.
  Los exámenes que ya están en la app como oficiales del INAP (2022 y 2024) se detectan y no se duplican.
  Las preguntas aparecen en Entrenamiento con el origen *PreparaTIC* y cada examen se puede hacer completo
  desde *Examen → Exámenes anteriores*.
- **`data/preparatic-map.json`**: equivalencias entre los 133 temas de PreparaTIC (temario A1) y los temas
  GSI. El importador elige entre los candidatos el que más se parece al texto de cada pregunta y comprueba la
  asignación con las preguntas oficiales ya clasificadas. Si una pregunta cae en un tema que no toca, ajusta
  aquí sus candidatos y vuelve a ejecutar `npm run preparatic` (con `-- --cache .cache/preparatic` no se
  vuelve a descargar nada).
- **`data/library-extra.json`**: documentos de la biblioteca oficial que no vienen del temario: aprobados de
  cada ejercicio, notas de corte, relación definitiva, nombramientos y listas de interinos (resolución de la
  Comisión Permanente de Selección y listas de Las Palmas y Santa Cruz de Tenerife).

`npm run preparatic` necesita Node 18 o superior y conexión con preparatic.org. Muestra un resumen: preguntas
nuevas, repetidas, claves que no coinciden con las oficiales y el porcentaje de acierto del tema asignado.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube este proyecto a su rama principal (`master` o `main`).
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push a esa rama ejecuta `.github/workflows/deploy.yml`: comprueba tipos, compila la versión web
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

## Inteligencia artificial con tu suscripción de Claude (sin API)

| Dónde usas la app | Cómo funciona la IA |
|---|---|
| Dentro de Claude (artifact) | Automática, con la suscripción de quien la abre |
| Versión web (GitHub Pages) | Por orden: **puente del PC** → **agente de GitHub** → copiar y pegar en claude.ai |

Las tres vías de la versión web usan tu suscripción. La clave de la API queda como opción avanzada.

### 1. Puente en tu PC (`bridge/`): respuestas en segundos

Un pequeño programa (Node, sin dependencias) que recibe las consultas de la web y las pasa a Claude Code
(`claude -p`), que responde con tu suscripción. También lee cuánto uso te queda.

```bash
node bridge/cuaderno-bridge.mjs --origen https://tu-usuario.github.io   # primera vez
node bridge/cuaderno-bridge.mjs --instalar                              # arranque automático con Windows
```

Copia el código de emparejamiento que muestra en *Ajustes → Inteligencia artificial → Puente en tu PC*.
La primera vez, el navegador puede pedir permiso para que la web acceda a tu red local: acéptalo.

### 2. Agente en GitHub (`agente/`): desde el móvil o fuera de casa

Plantilla para un repositorio **privado** aparte: la app sube la consulta, un workflow la responde con
Claude Code y la app recoge la respuesta (1-3 minutos). Instrucciones en `agente/README.md`.

### Uso de la suscripción

*Ajustes* y la barra lateral muestran cuánto te queda de la sesión (5 horas) y de la semana. El dato viene
de un servicio no oficial de Anthropic (el mismo que usa `/usage`): si deja de funcionar, la IA sigue
funcionando y solo desaparece el indicador.

### Seguridad: nadie más puede usar tu suscripción

- **Este repositorio público no contiene ningún token de Claude.** Tu token está solo en los secretos
  (cifrados) del repositorio privado del agente, que nadie más ve.
- **La web no lleva credenciales.** Para usar el puente o el agente hacen falta dos llaves que se guardan
  solo en tu navegador: el código del puente y un token de GitHub limitado al repositorio privado.
- **El puente solo escucha en tu propio ordenador** (127.0.0.1), exige el código y solo acepta tu web.
- **Claude se ejecuta sin herramientas** y en una carpeta vacía: solo puede devolver texto.
- La app **se niega a usar un repositorio de agente público**.

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
