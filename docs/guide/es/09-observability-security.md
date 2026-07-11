[← Índice de la guía](README.md)

# Observabilidad y seguridad

Bifrost mantiene un rastro verificable de lo que ocurre en tus sesiones: grabaciones completas del terminal que puedes reproducir, transcripciones en texto plano, un log de auditoría de solo anexado, salud de hosts en vivo, detección de errores y resúmenes IA de sesiones inactivas. En el lado de la seguridad, las credenciales se cifran con el llavero del sistema operativo y un filtro de redacción puede enmascarar secretos en la salida del terminal.

## Grabación de sesiones (asciicast)

Bifrost graba sesiones SSH en formato [asciicast v2](https://docs.asciinema.org/manual/asciicast/v2/) — los archivos `.cast` se reproducen en `asciinema` con la temporización real, exactamente como ocurrió la sesión. Se capturan tanto tu entrada como la salida del servidor.

Para grabar:

1. Clic derecho dentro de un terminal SSH → **Capture ▸ Record Session**.
2. Mientras se graba, un punto rojo pulsante aparece en la pestaña y junto al submenú **Capture**, y el elemento de menú cambia a **Stop Recording**.
3. Clic derecho → **Capture ▸ Stop Recording**. Un toast muestra la ruta del `.cast` guardado con acciones **Reveal in folder** y **Copy path**.

Las grabaciones se guardan bajo la carpeta de datos de usuario de Bifrost en `recordings/` (en Linux típicamente `~/.config/bifrost/recordings/`). La grabación está disponible solo para sesiones SSH — en paneles locales o Mosh el elemento aparece deshabilitado con la pista "SSH only". Mientras haya cualquier captura activa, una cámara **REC** roja parpadeante se muestra además en la barra de estado junto al indicador MCP.

### Reproducir una grabación

```bash
asciinema play ~/.config/bifrost/recordings/rec-1720620000000-abc123.cast
```

Necesitas [asciinema](https://asciinema.org/) instalado (`sudo apt install asciinema` o equivalente). También puedes subir un `.cast` con `asciinema upload <file>` para compartirlo.

### El navegador de archivos de captura

Clic derecho en un terminal → **Capture ▸ Recordings…** (o **Session Logs…**) abre un navegador compartido con dos pestañas — **Recordings** y **Session Logs** — que lista cada archivo capturado con su fecha y tamaño (más la duración en las grabaciones). Por fila:

- Grabaciones: copiar el comando `asciinema play "<ruta>"` listo para ejecutar, revelar el archivo en tu gestor de archivos, o eliminarlo
- Logs de sesión: abrir el archivo en tu visor por defecto, revelarlo, o eliminarlo — un log aún en escritura muestra la insignia *logging…* y no puede borrarse hasta que lo detengas

Un botón **Open folder** abre el directorio de la pestaña activa. El mismo navegador se abre desde **Settings → Terminal → Session Capture** con los botones **Browse…** de cada carpeta. El inicio y fin de cada grabación también se registran en el [log de auditoría](#log-de-auditoría).

## Logs de sesión (transcripciones en texto plano)

Independientemente de la grabación, puedes registrar la salida de una sesión en un archivo de texto plano — útil como evidencia, para tickets de cambio o para hacer grep después. Funciona tanto en sesiones SSH como locales.

- Clic derecho → **Capture ▸ Save Session Log** inicia el registro. Un toast muestra la ruta del archivo (con acciones Reveal/Copy), el elemento de menú se convierte en **Stop Session Log**, y un glifo de log discreto aparece en la pestaña mientras el registro está activo.
- Los archivos de log se guardan en la carpeta `session-logs/` de datos de usuario. Cada archivo empieza con una cabecera con la hora de inicio y la conexión, y termina con un marcador de fin de sesión.

El nombre del archivo proviene del campo **Log pattern** de la conexión si lo configuras; si no, el patrón por defecto es `%N_%Y%M%D_%H%m%s` (los terminales locales usan `local_%Y%M%D_%H%m%s`). Tokens disponibles:

| Token | Se expande a |
| --- | --- |
| `%Y` | Año (4 dígitos) |
| `%M` | Mes (01–12) |
| `%D` | Día (01–31) |
| `%H` | Hora (00–23) |
| `%m` | Minuto (00–59) |
| `%s` | Segundo (00–59) |
| `%N` | Nombre de la conexión |
| `%h` | Host |
| `%U` | Nombre de usuario |

El menú **Capture** también ofrece **Session Logs…** (el [navegador de archivos de captura](#el-navegador-de-archivos-de-captura) en su pestaña de logs), **Open Logs Folder** y **Open Recordings Folder**; **Settings → Terminal → Session Capture** muestra ambas rutas de carpeta con botones **Browse…** y **Open**.

## Log de auditoría

Bifrost anexa cada evento significativo a un archivo JSON Lines de solo anexado (`audit.jsonl` en la carpeta de datos de usuario). Los eventos registrados incluyen:

- Conexión / desconexión, autenticación exitosa / fallida, prompts MFA
- Clave de host verificada / rechazada / cambiada
- Inicio / parada de reenvío de puertos
- Inicio / parada de grabación y de logs de sesión
- Eventos de credenciales: contraseña del vault cambiada, archivo de clave almacenado
- Ejecuciones de hooks pre/post-conexión (ejecutado, omitido o fallido — ver [Automatización](08-automation.md))

Las entradas de más de 30 días se rotan. El log de auditoría es también lo que alimenta las estadísticas por conexión que ves en la barra lateral (conexiones totales, última conexión, tiempo de sesión acumulado).

## La vista Activity

La sección **Activity** de la barra lateral es el log de auditoría hecho visible — una línea de tiempo de todo lo que pasó, más acceso rápido a tus archivos de captura.

- **Pestaña Timeline**: eventos agrupados por día, los más recientes primero, cada uno con un punto de color por categoría, el tipo de evento, la conexión y el host. Haz clic en una fila para expandir su detalle completo; haz clic en el nombre de una conexión para filtrar la línea de tiempo a ella (el panel de estadísticas por conexión tiene un enlace **View activity** equivalente).
- **Filtros**: chips por categoría (Sessions, Auth, Security, Tunnels, Captures, Automation, Errors), búsqueda de texto libre por conexión/host, y un rango temporal de 24h / 7d / 30d. Un toggle **live** refresca la línea de tiempo cada pocos segundos mientras observas.
- **Cabecera de insights**: conexiones de hoy, fallos de autenticación de los últimos 7 días, capturas activas ahora mismo y el tamaño del archivo de auditoría — más **Rotate** (descarta entradas de más de 30 días) y **Export** de los eventos filtrados actuales como **CSV** o **JSONL** (un aviso te da la ruta del archivo).
- **Pestaña Captures**: las mismas listas de grabaciones y logs de sesión que el [navegador de archivos de captura](#el-navegador-de-archivos-de-captura), embebidas en la vista.

## Monitorización de salud

Bifrost hace ping periódicamente a tus hosts y muestra un punto de salud en vivo junto a cada conexión en la barra lateral, junto con la latencia medida. Los puntos se actualizan en segundo plano — un punto rojo antes de conectar te ahorra un timeout.

## Detección de errores

La salida del terminal se compara contra una biblioteca de patrones de error conocidos (comando no encontrado, permiso denegado, conexión rechazada y muchos más). Cuando un comando falla, aparece un badge en el terminal identificando el error; puedes descartarlo. Los errores detectados también alimentan las funciones IA descritas abajo.

## Resumen IA de sesión inactiva

Cuando una sesión lleva inactiva más de un umbral *y* produjo salida significativa, Bifrost ofrece un resumen generado por IA de lo que ocurrió:

- El aviso aparece brevemente y luego se colapsa a un pequeño icono en la esquina del panel — nunca se queda como un banner persistente.
- Expandir el icono genera el resumen bajo demanda (funciona en sesiones locales, SSH y Mosh — resume el búfer de salida real).
- Puedes guardar el resumen como nota de la conexión, o descartarlo hasta que la sesión vuelva a quedar inactiva.
- Si no hay nada que valga la pena resumir, no aparece ninguna UI.

Los resúmenes usan el proveedor de IA que configures en Settings — ver [IA y MCP](10-ai-mcp.md).

## Notificaciones de escritorio

Si un comando de larga duración termina mientras estás fuera de la pestaña, Bifrost envía una notificación de escritorio para que no tengas que estar comprobando.

## Redacción de secretos

**Settings → Security → Redact secrets in terminal output** activa un filtro de visualización que enmascara patrones de secretos conocidos antes de que se rendericen en el terminal: claves de acceso/secretas de AWS, tokens de GitHub y GitLab, claves API `sk-…`, cabeceras `Bearer`/`Authorization`, contraseñas embebidas en URLs, asignaciones tipo `password=`/`token=`, bloques de claves privadas y tokens de Slack.

- El interruptor está **desactivado por defecto** — debes activarlo tú.
- Tu elección ahora **persiste entre reinicios** (antes se reiniciaba por sesión).
- La redacción afecta a lo que se *muestra*; es una protección para compartir pantalla o miradas indiscretas, no cifrado. Los datos siguen llegando a tu aplicación de terminal.

## Seguridad de credenciales

- Los secretos almacenados se cifran con el **llavero del sistema operativo** vía `safeStorage` de Electron.
- En Linux **sin llavero** (sin gnome-keyring ni kwallet), Bifrost recurre a ofuscación base64 y te avisa. Esto *no* es cifrado — instala un llavero para tener protección real.
- El almacenamiento cifrado cubre contraseñas de conexión y passphrases de claves, credenciales de túneles, contraseñas de saltos de jump hosts y secretos TOTP.
- El formulario de edición muestra las contraseñas guardadas enmascaradas con un control para revelarlas; vaciar el campo elimina el secreto almacenado.

## Aún no disponible

Por honestidad, esto **no** funciona en esta versión:

- **Gestores de contraseñas externos** (1Password, Bitwarden, HashiCorp Vault, AWS Secrets Manager, Azure Key Vault): el código de backend existe pero ninguna UI llega a él.
- Firma con **autoridad certificadora SSH**: sin UI.
- **Re-cifrado del vault** (cambiar la contraseña del vault): sin UI.
- **Cifrado de la base de datos en reposo**: incompleto.

> Especificaciones fuente: `openspec/specs/session-observability/spec.md`, `openspec/specs/secrets-management/spec.md` — la documentación refleja la implementación a fecha de v0.3.x.
