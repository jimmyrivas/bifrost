<p align="center">
  <img src="resources/icon.png" alt="Bifrost" width="96" />
</p>

<h1 align="center">Bifrost</h1>

<p align="center">
  <strong>Gestor de conexiones moderno para Linux — el sucesor espiritual de Ásbrú Connection Manager.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="Licencia: GPL-3.0-or-later" src="https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg" /></a>
  <img alt="Plataforma: Linux" src="https://img.shields.io/badge/Platform-Linux-informational" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-34-9feaf9" />
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>Español</strong>
</p>

Bifrost es un gestor de conexiones de escritorio para sysadmins, DevOps y equipos
DevSecOps que administran decenas o cientos de servidores remotos — SSH primero,
con una experiencia de terminal moderna.

> **Estado: alpha (v0.3.0), solo Linux.** Este README es honesto por diseño: la
> sección **Features** solo lista lo que funciona de punta a punta en la UI hoy,
> verificado contra el código. Lo que está construido en el backend pero aún no
> es alcanzable desde la UI vive en [su propia sección](#construido-en-el-backend-ui-pendiente),
> y los huecos conocidos están en [limitaciones](#limitaciones-conocidas-alpha).
> Si encuentras aquí una afirmación que no sea cierta, es un bug — abre un issue.

📖 **Guía de usuario**: [docs/guide/es](docs/guide/es/README.md) — documentación capítulo
a capítulo derivada de las especificaciones OpenSpec del proyecto y verificada contra el
código (también [in English](docs/guide/README.md)).

## Features

### Conexiones y organización
- CRUD de conexiones con grupos jerárquicos, favoritos, recientes, búsqueda en vivo (también por etiquetas) y badges de tags
- Plantillas: guarda cualquier conexión como plantilla y aplícala al crear
- Notas por conexión (etiquetadas: nota/evidencia/comando/error), con panel de notas buscable
- Estadísticas por conexión (conexiones totales, última conexión, tiempo de sesión — derivadas del log de auditoría) y puntos de salud en vivo (ping periódico)
- Wake-on-LAN desde el menú contextual de la conexión
- Workspaces: filtros de conexiones con nombre para acotar la barra lateral a lo que estás trabajando

### Terminal
- xterm.js con render WebGL; shells locales (con selector: bash/zsh/fish/pwsh) y SSH en el mismo sistema de pestañas
- Paneles divididos (menú contextual; horizontal/vertical), maximizar panel, explotar paneles a pestañas, combinar pestañas
- Broadcast de escritura a todos los paneles o todas las pestañas (con aviso visible), más una barra de broadcast multilínea con autoguardado del borrador
- Seguridad al pegar: confirmación de pegado multilínea con escaneo de comandos peligrosos; Ctrl-C copia si hay selección, interrumpe si no
- Zoom por pestaña, ligaduras, copiar al seleccionar, portapapeles OSC 52 (copiar desde tmux/vim funciona), enlaces web clicables
- Las rutas `.md` en la salida SSH son clicables y abren un visor Markdown interno — las rutas relativas se resuelven contra el directorio de trabajo rastreado
- **Copiar como CSV / Markdown**: clic derecho en cualquier selección — tablas de pipes ASCII, GFM y bordes de caja (`psql`, MySQL, etc.) se reconstruyen como CSV RFC 4180 o Markdown limpio; funciona en el terminal, el visor Markdown y las respuestas de la IA
- Pega una imagen del portapapeles directo al servidor (Ctrl+Shift+I): se sube por SFTP (jump chains incluidas), la ruta se escribe en el terminal y se limpia al salir
- ~50 esquemas de color integrados, esquema y tinte de fondo por conexión (producción = rojo, staging = verde), títulos dinámicos (OSC 0/2) con bloqueo de título
- Separa una pestaña a su propia ventana — y reincorpórala manteniendo la misma sesión viva (scrollback y proceso en marcha intactos)
- Buscar en el terminal (`Ctrl+Shift+F` o menú contextual) con coincidencias resaltadas; acciones Clear/Reset del terminal
- Captura del terminal a PNG, pantalla completa F11, notificación de escritorio al terminar procesos largos
- Badges de detección de errores en comandos fallidos, "Explain Command" con IA sobre cualquier selección, resumen IA de sesión inactiva guardable como nota

### Sesiones que sobreviven
- Persistencia de sesiones locales con integración real de multiplexores: **dtach, tmux, zellij, rmux** — sondeo, selector de attach y argumentos personalizados por conexión (config, layout de zellij, flags extra)
- Restauración de sesión: al relanzar, Bifrost ofrece reabrir tus pestañas anteriores y reconectarlas
- Reconexión automática SSH con backoff exponencial (3s → 60s)

### SSH y redes
- Autenticación: contraseña, archivo de clave (con passphrase), agente SSH; los prompts de MFA keyboard-interactive se te reenvían
- Contraseñas guardadas cifradas con el keychain del SO (`safeStorage`); el formulario las muestra enmascaradas con botón de revelar, y vaciar el campo las elimina
- TOTP/2FA: guarda un secreto Base32 por conexión y Bifrost teclea el código automáticamente cuando aparece un prompt de verificación en la sesión
- Verificación de host keys (TOFU, huellas SHA-256) con panel de known hosts en Ajustes
- **Cadenas de jump hosts** (ProxyJump multi-salto) con editor visual — usadas por SSH, Mosh y túneles; las contraseñas inline de los saltos se cifran en reposo
- **Túneles**: reenvío de puertos local, remoto y **dinámico (SOCKS5)** con UI completa de gestión, credenciales por túnel y autoarranque al iniciar
- **Mosh** como método de conexión de primera clase (via PTY, con jump chains)
- **Más métodos de conexión** desde el terminal: **Telnet** (en el terminal), **RDP** y **VNC** (lanzan el cliente externo) y **Comando personalizado** (ejecuta cualquier comando como sesión) — junto a SSH y Mosh
- **Opciones SSH avanzadas**: selección por conexión de cifrados / KEX / MACs / algoritmos de host-key y reenvío X11 se aplican al conectar

### SFTP y archivos
- Panel SFTP por pestaña SSH: navegar, subir (multi-archivo), descargar, borrar, mkdir
- Subida de imágenes del portapapeles (ver Terminal arriba)

### Automatización
- **Comandos remotos**: paletas de comandos por conexión o globales con grupos, confirmación, atajos, expansión de `<VAR>` y prompts `{{param}}` — ejecutables desde el menú contextual del terminal
- **Runbooks**: pega un runbook Markdown, elige la pestaña destino, ejecuta los bloques paso a paso con estado por paso, modo dry-run y avisos de comandos peligrosos
- **Scripts**: JavaScript aislado (worker sandbox) con `send`/`log`/`sleep`, editable en la app, ejecutado contra el terminal vivo desde el menú contextual
- Navegador de snippets con categorías, búsqueda, copiar o ejecutar en el terminal, prompts `{{param}}`
- Expansión de variables (`<IP>`, `<USER>`, `<ENV:name>`, `<GV:name>`, fechas) en títulos de pestaña y comandos remotos
- **Hooks pre/post-conexión**: comandos guardados en la conexión se ejecutan localmente al conectar/desconectar, con confirmación opcional por comando — cada ejecución queda en el log de auditoría

### Observabilidad y seguridad
- **Grabación de sesiones** (asciicast v2 `.cast`, entrada + salida) desde el menú Capture del terminal: punto rojo pulsante en la pestaña, indicador REC parpadeante en la barra de estado, aviso con la ruta al detener y un gestor de grabaciones (comando de reproducción, revelar, borrar) — reproduce con `asciinema play`
- **Logs de sesión**: transcripciones en texto plano por sesión (nombres de archivo con patrones), iniciar/detener desde el menú Capture, carpetas expuestas en Preferencias → Session Capture
- Log de auditoría de solo anexado (JSON Lines) de conexiones, eventos de credenciales, inicio/fin de capturas y ejecución de hooks — también alimenta las estadísticas por conexión
- **Vista Activity** (barra lateral): el log de auditoría como línea de tiempo agrupada por día con filtros por categoría, búsqueda, rangos 24h/7d/30d, refresco en vivo, drill-down por conexión, contadores de insights, rotación del log y export CSV/JSONL de los eventos filtrados — más una pestaña Captures sobre grabaciones y logs de sesión
- Filtro de redacción de secretos en la salida del terminal (interruptor en Ajustes, persistente entre reinicios; desactivado por defecto)
- Almacenamiento cifrado de credenciales en todo el producto: conexiones, túneles y saltos
- Detección de inactividad con resúmenes IA; notificaciones de escritorio al terminar comandos largos

### IA y MCP
- Panel de Asistente IA (Ctrl+Shift+A), acoplado o en su propia ventana, con respuestas en streaming de **Ollama, OpenRouter, OpenAI o DeepSeek** (proveedor/modelo/clave configurables en Ajustes)
- Explicación de comandos, conciencia de errores, resúmenes de inactividad y copiar-como-CSV/Markdown en las respuestas
- **Servidor MCP** para agentes IA (p. ej. Claude): **42 herramientas, 9 recursos, 8 plantillas de prompt**, stdio o HTTP con auth Bearer, filtro de comandos destructivos, acceso a BD de solo lectura — ver [`docs/MCP_ARCHITECTURE.md`](docs/MCP_ARCHITECTURE.md)

### Shell de la aplicación
- Paleta de comandos (Ctrl+K) sobre conexiones y comandos; conjunto fijo de atajos globales
- Sistema de plugins: instala/activa/desactiva plugins npm desde Ajustes, contra un API de hooks documentado ([`docs/PLUGIN_API.md`](docs/PLUGIN_API.md))
- Sincronización de configuración vía git: exporta/importa/sincroniza tu configuración a un repositorio que tú indicas
- Persistencia del estado de ventana, bandeja del sistema, sistema de diseño "Spectral Command" ([`docs/reference/DESIGN.md`](docs/reference/DESIGN.md))
- UI en inglés; traducción al español iniciada (~30 cadenas — se agradece ayuda)

## Construido en el backend, UI pendiente

Esto existe como implementación real y probada en el proceso main, con IPC listo,
pero **ninguna UI llega ahí todavía** — seleccionarlo no hace nada (o cae a SSH).
Es lo primero de la hoja de ruta, y cada punto es una contribución bien acotada:

- **Lanzadores de protocolos** sin entrada en el menú: FTP (lftp), TN3270, WebDAV, sesiones AWS SSM — el backend existe pero el formulario solo ofrece SSH/Mosh/RDP/VNC/Telnet/Custom
- **Importación**: parser de `~/.ssh/config`, inventarios Ansible, estado de Terraform, exportar/importar JSON
- **Descubrimiento en la nube**: AWS EC2, GCP, Azure VMs, Docker, Podman, Kubernetes — escáneres por CLI listos, sin panel
- **Gestores de contraseñas externos**: 1Password, Bitwarden, HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, puente KeePassXC
- **SSH CA**: firma de certificados vía HashiCorp Vault o CA local
- **Motor Expect** (automatización patrón → respuesta con reglas de salto) y **macros**
- **Clústeres**: backend persistente (crear/miembros/broadcast) — el panel actual es un borrador visual aún no conectado
- **Editor de variables globales** (el resolutor `<GV:>` funciona; falta la UI para definirlas)
- **Opciones SSH avanzadas — parcial**: la selección de cifrados/KEX/MACs/algoritmos de host-key y el reenvío X11 ya los consume el connect; **reenvío de agente y proxy HTTP** los guarda el formulario pero aún no se aplican
- **Recifrado del vault** (cambiar la contraseña del vault sobre los secretos existentes)
- Cifrado de la base de datos en reposo (AES-256-GCM; falta la mitad de descifrado al arranque + UI)

## Limitaciones conocidas (alpha)

- Los atajos de **redimensionado de paneles por teclado** no están conectados aún (redimensiona con splits/maximizar)
- **Zmodem** sz/rz se detecta y te redirige a SFTP — no hay transferencia en el terminal
- La pestaña **FIDO2** existe pero ssh2 aún no usa llaves sk directamente (solo funciona a través de ssh-agent)
- El **editor de atajos** todavía no reemplaza los atajos integrados; los menús de conexiones de la bandeja están vacíos
- La **grabación de sesiones** cubre solo sesiones SSH (en paneles locales/mosh la opción aparece deshabilitada)

## Hoja de ruta

Además de conectar las secciones de arriba: soporte Windows ([plan](docs/WINDOWS_COMPAT_PLAN.md)),
empaquetado macOS, CI multi-SO, importación desde Ásbrú, transferencias ZMODEM
reales, rename/chmod/panel dual en SFTP, tests E2E en CI, documentación de
usuario derivada de las specs en inglés y español, y completar la traducción al
español de la UI.

## Instalación

Descarga el último AppImage desde la [página de releases](https://github.com/jimmyrivas/bifrost/releases) y luego:

```bash
chmod +x Bifrost-*.AppImage
./Bifrost-*.AppImage
```

Verifica la descarga:

```bash
sha256sum -c SHA256SUMS
```

> En Linux sin keyring (gnome-keyring/kwallet), las credenciales caen a un
> almacenamiento ofuscado con una advertencia — instala un keyring para tener
> cifrado real.

## Compilar desde el código fuente

Requisitos: Node.js 20+, [pnpm](https://pnpm.io) 10.x y herramientas de
compilación para módulos nativos (`python3`, `make`, `g++`).

```bash
git clone https://github.com/jimmyrivas/bifrost.git
cd bifrost
pnpm install
pnpm rebuild        # recompila módulos nativos contra el ABI de Electron
pnpm dev            # desarrollo con HMR
pnpm package        # produce AppImage / deb / rpm en dist/
```

Scripts útiles:

| Comando | Descripción |
| --- | --- |
| `pnpm lint` | ESLint (con `--fix`) |
| `pnpm typecheck` | TypeScript `--noEmit` |
| `pnpm test` | Tests unitarios con Vitest |
| `pnpm test:e2e` | Tests E2E con Playwright |
| `pnpm mcp:dev` | Ejecuta el servidor MCP (stdio) |

## Arquitectura

Aplicación Electron de tres procesos más un servidor MCP independiente:

- **Main** (`src/main/`) — SQLite (Drizzle), PTY/SSH, keychain, bandeja, ~26 módulos IPC
- **Preload** (`src/preload/`) — puente IPC tipado
- **Renderer** (`src/renderer/`) — React 18 + TypeScript, Zustand, Tailwind v4, xterm.js
- **Servidor MCP** (`src/mcp/`) — proceso Node separado, acceso a BD de solo lectura vía sql.js

El comportamiento previsto está especificado en [`openspec/specs/`](openspec/specs/).
Ten en cuenta que algunas specs describen capacidades cuya UI sigue pendiente
(ver la sección de arriba) — las specs son la meta; este README es el estado actual.

## Contribuir

Los issues y pull requests son bienvenidos — la sección
["backend construido, UI pendiente"](#construido-en-el-backend-ui-pendiente) es
un gran punto de partida: la mitad difícil ya está hecha y probada. Antes de
enviar:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Los cambios significativos pasan por el flujo [OpenSpec](openspec/) — mira
`openspec/changes/archive/` para ejemplos reales.

## Licencia

Bifrost es software libre, licenciado bajo la
[Licencia Pública General GNU v3.0 o posterior](LICENSE) (GPL-3.0-or-later).

Nombrado en honor al puente arcoíris ardiente de la mitología nórdica que conecta
los mundos — y construido en memoria de
[Ásbrú Connection Manager](https://www.asbru-cm.net/), cuyo nombre se refiere al
mismo puente.
