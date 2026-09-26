# Agente de IA de Cuaderno GSI

Plantilla para un repositorio **privado** que responde las consultas de IA de la app con tu suscripción
de Claude, cuando el puente de tu PC no está disponible (por ejemplo, desde el móvil fuera de casa).

## Puesta en marcha (una sola vez)

1. En GitHub, crea un repositorio nuevo **privado** llamado `cuaderno-gsi-agente` y sube el contenido
   de esta carpeta (incluida la carpeta oculta `.github`).
2. En tu PC, con Claude Code instalado, ejecuta `claude setup-token` y copia el token que muestra.
3. En el repositorio: *Settings → Secrets and variables → Actions → New repository secret*.
   Nombre: `CLAUDE_CODE_OAUTH_TOKEN`. Valor: el token.
4. Crea un token de GitHub para la app: *Settings (de tu cuenta) → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token*:
   - *Repository access*: **Only select repositories** → `cuaderno-gsi-agente` (solo ese).
   - *Permissions → Repository permissions → Contents*: **Read and write**. Nada más.
   - Caducidad: la que prefieras (por ejemplo, un año).
5. En la app: *Ajustes → Inteligencia artificial → Agente en GitHub*: tu usuario, el nombre del repositorio
   y ese token. Pulsa «Guardar y probar».

## Cómo funciona

La app sube la consulta a `requests/`, este workflow arranca, Claude Code responde (sin herramientas y en
una carpeta vacía) y la respuesta queda en `responses/`, donde la app la recoge y la borra. Cada consulta
tarda de 1 a 3 minutos por el arranque de GitHub Actions. Los repositorios privados tienen 2.000 minutos
de Actions gratis al mes en cuentas gratuitas; cada consulta gasta alrededor de un minuto.

## Seguridad

- El repositorio es privado: nadie más ve las consultas, las respuestas ni los registros.
- El token de Claude está cifrado en los secretos de GitHub; nunca se muestra (ni a ti) ni sale en los registros.
- El token de la app solo puede leer y escribir archivos de este repositorio; no da acceso a nada más de tu cuenta.
