[← Índice de la guía](README.md)

# Gestión de conexiones

El árbol de conexiones de la barra lateral es la fuente de verdad de Bifrost: cada sesión, túnel y función de automatización lee de él. Este capítulo cubre cómo crear y organizar conexiones, plantillas, workspaces, notas, estadísticas, credenciales guardadas, TOTP, variables y la sincronización de tu configuración vía git.

## Crear una conexión

Haz clic en el botón de nueva conexión en la barra lateral (o usa la paleta de comandos) para abrir el formulario de conexión. Rellena al menos un **nombre** y un **host**; **puerto** y **usuario** según necesites, y guarda. La conexión aparece en el árbol, y el formulario valida los campos obligatorios antes de persistir nada.

> **Métodos de conexión:** el desplegable de protocolo del formulario lista varios métodos, pero **hoy solo SSH y Mosh conectan**. RDP, VNC, Telnet y el resto son visibles en el formulario y se conectarán a sus lanzadores de backend (ya construidos) en una versión futura — seleccionarlos todavía no hace nada útil. Ver [SSH, Mosh y jump hosts](04-ssh.md).

Para editar más tarde, clic derecho en la conexión → **Edit Connection**. Para borrar, usa el mismo menú contextual.

## Grupos y el árbol

Las conexiones se organizan en **grupos jerárquicos** (carpetas dentro de carpetas), que es lo que mantiene a Bifrost usable con cientos de destinos.

- Crea subgrupos bajo cualquier grupo existente; el anidamiento persiste.
- Clic derecho en un grupo → **Open All Connections** para abrir una sesión por cada conexión de ese grupo y sus subgrupos.
- Los **badges de tags** muestran las etiquetas de cada conexión directamente en el árbol.

## Favoritos, recientes y búsqueda

- Activa **Add to Favorites** desde el menú contextual de una conexión (o la estrella) — los favoritos tienen su propia sección y el estado persiste.
- La sección **Recent** lista las últimas 10 conexiones que abriste, con marcas de tiempo.
- El cuadro de **búsqueda en vivo** filtra el árbol mientras escribes — también encuentra por **tags**, no solo por nombre.

## Clonar y plantillas

- Clic derecho en una conexión → **Clone Connection** para crear una copia con ajustes idénticos y un nombre editable.
- Clic derecho → **Save as Template** para guardar los ajustes de una conexión como plantilla reutilizable.
- Al crear una conexión nueva, el desplegable **From Template…** en la parte superior del formulario la rellena a partir de cualquier plantilla guardada.

## Workspaces

Los workspaces son **filtros de conexiones con nombre** que acotan la barra lateral a lo que estás trabajando ahora mismo. Crea uno desde el selector de workspaces de la barra de navegación, elige qué conexiones pertenecen a él, y cambia entre workspaces para intercambiar la vista completa de la barra lateral. El árbol completo siempre está a un cambio de distancia.

## Notas por conexión

Bifrost mantiene un registro de notas ligado a las conexiones:

- En una sesión, selecciona salida del terminal, clic derecho → **Save as Note** y elige una etiqueta: **note**, **evidence**, **command** o **error**.
- Abre la vista **Notes** en la barra lateral para explorarlo todo: **búsqueda** de texto completo, filtrado por etiqueta, copiar al portapapeles y borrar. Cada nota muestra de qué conexión (o pestaña) salió.

## Estadísticas y salud

- Cada conexión del árbol muestra un **punto de salud**: verde (alcanzable), rojo (inalcanzable) o gris (desconocido), refrescado con un ping periódico. Pasa el cursor por encima para ver host/puerto/protocolo.
- Abre **Edit Connection** para ver las **estadísticas** de la conexión — conexiones totales, última conexión y tiempo de sesión acumulado — derivadas del log de auditoría de solo anexado.

## Wake-on-LAN

Si una conexión tiene una **dirección MAC** configurada en su formulario, puedes hacer clic derecho → **Wake On LAN** para difundir un paquete mágico a ese host. Sin dirección MAC la acción no tiene nada que enviar.

## Credenciales guardadas

- Las contraseñas y passphrases de clave que guardas se **cifran con el keychain del sistema operativo** (`safeStorage` de Electron).
- En Linux **sin keyring** (gnome-keyring/kwallet), Bifrost cae a un almacenamiento ofuscado (base64) y te avisa — instala un keyring para tener cifrado real.
- Cuando editas una conexión con contraseña guardada, el campo aparece **prellenado y enmascarado** (puntos) con un botón de ojo para revelarla.
- **Vaciar un campo de credencial prellenado y guardar elimina el valor almacenado** del vault. (Bifrost se protege contra borrados accidentales: un guardado que ocurra antes de que el valor almacenado termine de cargar deja el vault intacto.)

## TOTP / 2FA

Puedes guardar un **secreto TOTP en Base32** por conexión. Cuando aparece un prompt de código de verificación durante una sesión, Bifrost calcula el código actual y **lo teclea automáticamente** por ti.

## Variables en títulos de pestaña y comandos remotos

Los títulos de pestaña y los comandos remotos expanden variables de sustitución en el momento de uso:

| Token | Se expande a |
| --- | --- |
| `<IP>` | El host de la conexión |
| `<PORT>` | El puerto de la conexión |
| `<USER>` | El usuario de la conexión |
| `<NAME>` | El nombre de la conexión |
| `<ENV:name>` | Una variable de entorno |
| `<GV:name>` | Una variable global (ver nota abajo) |
| `<DATE_Y>` `<DATE_M>` `<DATE_D>` | Año / mes / día actuales |
| `<TIME_H>` `<TIME_M>` `<TIME_S>` | Hora / minuto / segundo actuales |
| `<TIMESTAMP>` | Timestamp Unix actual |

> **Variables globales:** el resolutor de `<GV:name>` funciona, pero **todavía no hay UI para definir variables globales** — un valor solo se resuelve si ya existe en la base de datos de Bifrost (por ejemplo, traído por una configuración importada). Hasta que llegue el editor, prefiere `<ENV:name>`.

## Sincronización de configuración vía git

Ajustes → **Git Config Sync** te permite mantener tu inventario de conexiones en un repositorio git que tú indicas:

1. Introduce la **ruta del repositorio** (un clon local).
2. Usa **Export** para escribir tus conexiones ahí, **Import** para cargar las nuevas desde él, o **Sync** para hacer ambas cosas.

Las conexiones se exportan **sin contraseñas ni claves privadas** — las credenciales se quedan en tu vault local.

## Aún no disponible

- **Importación** desde `~/.ssh/config`, inventarios de Ansible, estado de Terraform o archivos JSON (los parsers existen en el backend; ninguna UI llega a ellos).
- **Descubrimiento en la nube** (AWS EC2, GCP, Azure, Docker, Podman, Kubernetes) — los escáneres están construidos, pero no hay panel.
- **Gestores de contraseñas externos** (1Password, Bitwarden, HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, KeePassXC).
- **Opciones SSH avanzadas por conexión** (reenvío X11, reenvío de agente, selección de cifrados/KEX/MACs, proxy HTTP): el formulario las guarda, pero el camino de conexión todavía no las aplica.
- **Editor de variables globales** — ver la nota bajo Variables más arriba.

> Specs de origen: `openspec/specs/connection-management/spec.md`, `openspec/specs/variable-expansion/spec.md` — la documentación refleja la implementación a fecha de v0.3.x.
