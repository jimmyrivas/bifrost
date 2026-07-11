[← Índice de la guía](README.md)

# El terminal

El terminal de Bifrost es xterm.js con render WebGL. Los shells locales y las conexiones SSH conviven en el mismo sistema de pestañas: abre una pestaña local, conéctate a un servidor, divide cualquiera de las dos en paneles, haz broadcast a todos — el flujo es idéntico. Este capítulo cubre el terminal en sí; conectarse se explica en [Conexiones](02-connections.md) y [SSH](04-ssh.md).

> La interfaz de Bifrost está (por ahora) mayormente en inglés, así que los nombres de menús y opciones se citan en inglés tal como aparecen en pantalla.

## Shells locales y SSH en un mismo sistema de pestañas

- **Nueva pestaña local**: `Ctrl+T`, o el botón **+** de la barra de pestañas. El selector de shell junto a él lista los shells detectados en tu sistema (bash, zsh, fish, pwsh), así que cada pestaña puede ejecutar un shell distinto.
- **Las pestañas SSH** se abren desde la barra lateral o la paleta de comandos (`Ctrl+K`) y se comportan igual que las locales: mismos paneles, mismo menú contextual, mismos atajos.
- Las pestañas siguen vivas al cambiar de una a otra. Bifrost mantiene montado cada terminal, así que al volver a una pestaña encuentras su scrollback y su proceso en ejecución exactamente donde los dejaste.

## El menú de clic derecho

Todo lo de este capítulo es accesible desde el menú contextual del terminal. Su nivel superior:

| Elemento | Qué contiene |
| --- | --- |
| **Copy** | Copia la selección como texto plano |
| **Copy as ▸** | Markdown / CSV (ver [Copiar como Markdown o CSV](#copiar-como-markdown-o-csv)) |
| **Paste** | Pega el portapapeles (pasa por la seguridad de pegado) |
| **Find in Terminal** | Abre la barra de búsqueda (`Ctrl+Shift+F`) |
| **Layout ▸** | Split Horizontal / Split Vertical / Maximize Pane / Close Split Pane / Explode to Tabs / Combine All Tabs |
| **Automation ▸** | Scripts, Remote Commands, Runbooks, Explain Command, AI Assistant, toggle de Broadcast, Paste Image to Server, Enable cwd tracking |
| **Capture ▸** | Record Session, Save Session Log, Take Screenshot, Save as Note, Recordings…, Session Logs…, Open Recordings/Logs Folder |
| **Session ▸** | Rename Tab, Lock Title, Duplicate, Save as Connection, Open SFTP, Detach to Window |
| **Clear Terminal** | Limpia la pantalla y el scrollback |
| **Reset Terminal** | Reinicio completo del terminal (modos, charset, colores) |
| **Disconnect** | Termina la sesión y cierra la pestaña |

Algunas entradas solo aparecen cuando aplican: *Explode to Tabs* requiere una pestaña dividida, *Combine All Tabs* requiere más de una pestaña, y *Paste Image to Server*, *Save as Connection*, *Open SFTP* y *Enable cwd tracking* requieren una pestaña SSH.

## Paneles divididos y layout

Clic derecho → **Layout → Split Horizontal** (o **Split Vertical**) divide el panel actual. Cada panel es una sesión independiente.

- **Maximize Pane** (`Ctrl+Shift+M` o el menú Layout) hace que el panel con foco ocupe temporalmente toda la pestaña; vuelve a activarlo para restaurar el layout.
- **Close Split Pane** cierra el panel con foco.
- **Explode to Tabs** convierte cada panel de una pestaña dividida en su propia pestaña.
- **Combine All Tabs** hace lo contrario: fusiona todas las pestañas abiertas en una sola pestaña dividida.

## Separar a una ventana — y traerla de vuelta

**Session → Detach to Window** mueve la pestaña a su propia ventana. Es una transferencia en vivo, no una copia: la sesión sigue ejecutándose y su salida reciente se reproduce en la ventana nueva.

El viaje de ida y vuelta también funciona. Pulsa **Re-attach** en la ventana separada (o simplemente ciérrala) y la pestaña vuelve a la ventana principal, adoptando la misma sesión viva — scrollback reproducido, proceso aún en marcha. Sepárala para un segundo monitor y reincorpórala al terminar; nada se reinicia.

## Broadcast de escritura

Escribe una vez, envía a todas partes. `Ctrl+Shift+B` cicla el modo de broadcast: **off → panes → all tabs → off** (también disponible como el toggle de Broadcast en clic derecho → **Automation**).

- El modo **panes** envía tus pulsaciones a todos los paneles de la pestaña actual (banner ámbar).
- El modo **all tabs** las envía a todas las pestañas abiertas (banner rojo).
- El banner permanece visible mientras el broadcast esté activo, así siempre sabes que las pulsaciones van a muchos destinos.

También hay una barra de broadcast multilínea: compón un comando largo en un área de texto y envíalo con `Ctrl+Enter`; el borrador se autoguarda mientras escribes.

## Seguridad al pegar y Ctrl-C inteligente

- Pegar contenido **multilínea** muestra una confirmación con exactamente lo que se va a enviar.
- El contenido pegado se escanea contra patrones conocidos de **comandos peligrosos** (`rm -rf /` y compañía); las coincidencias se marcan y requieren confirmación explícita.
- `Ctrl+C` es inteligente: con selección **copia**; sin ella envía la interrupción (`^C`) como siempre. `Ctrl+Shift+C` / `Ctrl+Shift+V` siempre copian/pegan.

## Buscar en el terminal

Pulsa `Ctrl+Shift+F` (en el panel con foco), o clic derecho → **Find in Terminal**, para abrir una barra de búsqueda en la esquina superior derecha del panel. Las coincidencias se resaltan mientras escribes. `Ctrl+F` a secas se pasa intencionalmente al shell (readline).

| Tecla | Acción |
| --- | --- |
| `Enter` | Siguiente coincidencia |
| `Shift+Enter` | Coincidencia anterior |
| `Esc` | Cierra la barra y limpia todos los resaltados |

## Limpiar y reiniciar

- **Clear Terminal** (menú contextual) borra la pantalla y el scrollback.
- **Reset Terminal** hace un reinicio completo — úsalo cuando un programa deja el terminal en mal estado (charset incorrecto, pantalla alternativa atascada, colores rotos).

## Apariencia

- **Zoom por pestaña**: `Ctrl+=` / `Ctrl+-` / `Ctrl+0` (restablecer). El zoom aplica solo al terminal activo — las pestañas en segundo plano conservan su tamaño.
- **~50 esquemas de color integrados**, seleccionables globalmente y por conexión. Un **tinte de fondo** por conexión codifica los entornos de un vistazo — la convención: producción rojo, staging verde.
- **Ligaduras tipográficas**, **copiar al seleccionar** y soporte de portapapeles **OSC 52** (copiar desde tmux o vim dentro de la sesión llega a tu portapapeles del sistema).
- **Enlaces web clicables** en la salida se abren en tu navegador.
- **Títulos de pestaña dinámicos**: los shells que emiten secuencias de título OSC 0/2 actualizan el título en vivo. **Session → Lock Title** lo congela; **Session → Rename Tab** pone tu propio nombre (renombrar bloquea el título automáticamente).

## Archivos Markdown en la salida

Las rutas `.md` impresas en la salida SSH son clicables y se abren en el visor Markdown interno de Bifrost (render GitHub-flavored).

- **Las rutas relativas** necesitan conocer el directorio de trabajo remoto: ejecuta clic derecho → **Automation → Enable cwd tracking (relative .md links)** una vez por sesión, y el shell reportará su directorio a partir de entonces. Las rutas absolutas funcionan sin ello.
- El visor tiene sus propias herramientas de copia: clic derecho sobre el contenido renderizado para **Copy as text / Markdown / CSV** (actúan sobre tu selección, o sobre el documento completo si no hay nada seleccionado), o usa el desplegable **Copy** de la cabecera del visor, que siempre actúa sobre el documento completo. Copy as CSV extrae las tablas renderizadas como CSV RFC 4180.

## Copiar como Markdown o CSV

Clic derecho sobre una selección del terminal → **Copy as → Markdown** o **CSV**. Bifrost reconstruye tablas reales a partir del texto plano del terminal:

- Las tablas de pipes ASCII, tablas GFM y tablas con bordes de caja (`psql`, MySQL y CLIs similares) se convierten en una tabla Markdown limpia o en CSV RFC 4180 — las filas de borde y separador se descartan.
- Si la selección no es una tabla, Copy as CSV recurre a dividir columnas alineadas por espacios/tabuladores; Copy as Markdown devuelve el texto sin cambios.
- Las líneas de comandos de shell con pipes (`ps aux | grep ssh`) **no** se confunden con tablas.
- Un pequeño aviso confirma qué formato se copió; elegir cualquiera de las acciones sin nada seleccionado muestra en su lugar la pista "Select text first".

## Pegar una imagen al servidor

En una pestaña SSH, `Ctrl+Shift+I` (o clic derecho → **Automation → Paste Image to Server**) toma una imagen de tu portapapeles, la sube al servidor por SFTP — jump chains incluidas — y escribe la ruta remota en tu prompt, lista para usar. Las imágenes subidas se limpian al terminar la sesión.

## Captura

Todo bajo clic derecho → **Capture**:

- **Record Session** graba la entrada y salida de una sesión SSH como archivo asciicast `.cast` (solo sesiones SSH). Elige **Stop Recording** para finalizar; un aviso muestra la ruta del archivo. **Recordings…** abre el navegador de archivos de captura en su pestaña de grabaciones, y **Open Recordings Folder** lleva al directorio.
- **Save Session Log** vuelca la salida de la sesión a un archivo `.log` (nombrado según el patrón de log de la conexión); **Stop Session Log** lo termina. **Session Logs…** abre el navegador en su pestaña de logs; **Open Logs Folder** muestra el directorio.
- **Take Screenshot** guarda el terminal visible como PNG.
- **Save as Note** guarda la selección actual como nota de la conexión, etiquetada como Note, Evidence, Command, Error o AI Prompt — buscable después desde el panel de notas.

## Inteligencia del terminal

- **Badges de error**: cuando la salida coincide con un patrón de error conocido, aparece un badge descartable en la esquina con una sugerencia al pasar el cursor.
- **Notificación al terminar**: si un comando largo termina mientras estás en otra parte, Bifrost envía una notificación de escritorio.
- **Explain Command**: selecciona cualquier comando y clic derecho → **Automation → Explain Command** para obtener una explicación de la IA en el sitio.
- **Resumen de sesión inactiva**: cuando una sesión con salida relevante queda inactiva, se ofrece un resumen de IA — se colapsa a un icono en la esquina, se expande bajo demanda y puede guardarse como nota con un clic. Requiere un proveedor de IA configurado en Ajustes (ver [IA y MCP](10-ai-mcp.md)).

## Atajos de teclado

| Atajo | Acción |
| --- | --- |
| `Ctrl+T` | Nueva pestaña local |
| `Ctrl+W` | Cerrar pestaña activa |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Pestaña siguiente / anterior |
| `Ctrl+1` … `Ctrl+9` | Ir a la pestaña por número |
| `Ctrl+Shift+H` | Dividir horizontal |
| `Ctrl+\` | Dividir vertical |
| `Ctrl+Shift+M` | Maximizar / restaurar panel |
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | Copiar / pegar |
| `Ctrl+Shift+B` | Ciclar modo de broadcast |
| `Ctrl+Shift+F` | Buscar en el terminal con foco |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom más / menos / restablecer (solo pestaña activa) |
| `Ctrl+Shift+I` | Pegar imagen del portapapeles al servidor (SSH) |
| `Ctrl+Shift+D` | Desconectar / cerrar sesión |
| `Ctrl+Shift+A` | Mostrar/ocultar AI Assistant |
| `F11` | Pantalla completa |

## Aún no disponible

- **Redimensionar paneles con teclado** (`Ctrl+Shift+Flechas`) aún no está conectado — redimensiona dividiendo de otra forma o maximizando.
- El **terminal desplegable estilo Quake** aún no es funcional.
- El **editor de atajos personalizados** de Ajustes guarda tus combinaciones pero todavía no sobrescribe los atajos integrados.
- **Transferencias Zmodem** (`sz`/`rz`): se detectan pero no se ejecutan — Bifrost te dirige al panel SFTP en su lugar.

> Especificaciones fuente: `openspec/specs/terminal-ui/spec.md`, `openspec/specs/markdown-viewer/spec.md` — la documentación refleja la implementación a fecha de v0.3.x.
