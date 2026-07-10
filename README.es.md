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
DevSecOps que administran decenas o cientos de servidores remotos. Combina las
herramientas SSH profundas de Ásbrú/PAC con una experiencia de terminal moderna —
y su comportamiento está especificado capacidad por capacidad en
[`openspec/specs/`](openspec/specs/), la fuente de verdad de la lista de features
de abajo.

> **Estado:** v0.3.0 (alpha). Linux primero; el soporte Windows/macOS está en la
> [hoja de ruta](#hoja-de-ruta--todo).

## Features

Todo lo listado aquí está implementado y cubierto por una spec de capacidad.

### Conexiones y organización
- CRUD de conexiones con grupos jerárquicos, favoritos, historial, búsqueda difusa, etiquetas y validación
- Plantillas de conexión reutilizables ("Guardar como plantilla", "Guardar sesión como perfil")
- Importar/exportar — Ásbrú Connection Manager, parser de `~/.ssh/config`, inventarios Ansible, estado de Terraform
- Wake-on-LAN
- Estadísticas por conexión (número de conexiones, última conexión) y puntos de salud en vivo (ping)

### Terminal
- xterm.js con render WebGL; terminales de doble modo: PTY local y SSH
- Paneles divididos (horizontal/vertical), maximizar, atajos de redimensión, explotar paneles a pestañas, combinar pestañas
- Separa cualquier pestaña a su propia ventana y reincorpórala — la sesión sobrevive el movimiento
- Broadcast de entrada a paneles o a todas las pestañas, con aviso visual mientras está activo
- Seguridad al pegar: aviso de pegado multilínea, detección de comandos peligrosos, Ctrl-C inteligente
- Zoom (limitado a la pestaña activa), ligaduras tipográficas, copiar al seleccionar, enlaces clicables, títulos dinámicos (OSC 0/2)
- Más de 50 esquemas de color, colores y tintes de fondo por conexión (producción = rojo, staging = verde…)
- Terminal desplegable estilo Quake y pantalla completa con F11
- **Copiar como CSV / Markdown**: clic derecho sobre cualquier tabla o selección — tablas de pipes ASCII, GFM y bordes de caja (psql incluido) se reconstruyen como CSV limpio (RFC 4180) o Markdown GFM
- Visor Markdown interno: las rutas `.md` en la salida SSH son clicables (rutas relativas resueltas con seguimiento de cwd) y se renderizan dentro de la app

### Sesiones que sobreviven
- Persistencia de sesiones locales vía multiplexores: dtach, tmux, zellij, rmux — con config/layout/argumentos extra personalizables por multiplexor
- Restauración de sesión: reabre la app y recibe un aviso para restaurar tus pestañas anteriores, reconectadas
- Reconexión automática con backoff exponencial; reutilización/multiplexación de conexiones SSH

### SSH y redes
- Autenticación: contraseña, archivo de clave, certificado, agente SSH, llaves hardware FIDO2, MFA/TOTP con autoinyección
- Verificación de host keys (TOFU, huellas SHA-256) con panel de gestión de known hosts
- Selección de algoritmos (cifrados/KEX/HMAC/host keys), reenvío X11, proxy HTTP, reenvío de agente
- **Jump hosts**: cadenas ProxyJump multi-salto para SSH, Mosh y túneles
- **Túneles**: reenvío de puertos local, remoto y dinámico (SOCKS) con autoarranque y ciclo de vida en la bandeja
- Protocolos alternativos: Mosh, RDP (opciones de portapapeles/discos/impresora/audio/resolución) y comandos personalizados arbitrarios

### Clústeres y automatización
- Clústeres: agrupa conexiones, abre todos los miembros a la vez, broadcast al clúster; auto-clústeres por regex
- Motor Expect (activable por conexión, depurador, reglas de salto) para automatizar prompts
- Motor de scripts JavaScript aislado (sandbox) con editor, modos de ejecución y contexto de terminal
- Macros, paletas de comandos remotos por conexión, hooks pre/post-conexión con prompts `ASK`
- Expansión de variables en todas partes: `<IP>`, `<USER>`, `<ENV:…>`, `<GV:…>`, `<ASK:…>`, `<CMD:…>` con resolución de ámbito global/conexión
- Runbooks (parsea y ejecuta comandos con estado por paso), workflows parametrizados (`{{arg}}`), navegador de snippets, configuraciones de lanzamiento

### Secretos y seguridad
- Vault de credenciales cifrado (keychain del SO vía `safeStorage`), recifrado del vault, cifrado de configuración AES-256-GCM, almacenamiento cifrado de archivos de clave
- Contraseñas guardadas visibles (enmascaradas, con botón de revelar) y eliminables desde el editor de conexión
- Gestores de contraseñas externos: 1Password, Bitwarden, HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, KeePassXC
- Soporte de autoridad certificadora SSH y generación/detección de llaves FIDO2
- Redacción de secretos en la salida, log de auditoría (JSON Lines de solo anexado), grabación de sesiones (asciicast v2), logs de sesión, capturas del terminal

### Descubrimiento de infraestructura
- Nube: AWS EC2, GCP, Azure VMs, AWS SSM
- Contenedores y orquestación: Docker, Podman, `kubectl exec`
- Un clic convierte los objetivos descubiertos en conexiones de Bifrost

### IA y MCP
- Panel de Asistente IA (multiproveedor: Ollama, OpenRouter, OpenAI, DeepSeek): explicación de comandos, detección de errores con sugerencias, resúmenes de sesión inactiva, ventana separable, copiar respuestas como texto/Markdown/CSV
- **Servidor MCP** para agentes IA (p. ej. Claude): 42 herramientas, 9 recursos y 8 plantillas de prompt sobre stdio o HTTP+Bearer; lee la BD de Bifrost en solo lectura vía sql.js y filtra comandos destructivos — ver [`docs/MCP_ARCHITECTURE.md`](docs/MCP_ARCHITECTURE.md)

### Shell de la aplicación
- Workspaces, paleta de comandos (Ctrl+K), atajos multi-acorde, bandeja del sistema con menús dinámicos, persistencia del estado de ventana, sincronización de configuración vía git
- Sistema de diseño "Spectral Command" — [`docs/reference/DESIGN.md`](docs/reference/DESIGN.md)

## Hoja de ruta / TODO

Lo que Bifrost **no** tiene todavía, y quiere tener. Las contribuciones son
bienvenidas — los cambios grandes pasan por el flujo [OpenSpec](openspec/).

**Soporte de plataformas**
- [ ] Soporte Windows (utilidades de plataforma, detección de shells incl. PowerShell/WSL, RDP nativo vía mstsc, empaquetado) — plan en [`docs/WINDOWS_COMPAT_PLAN.md`](docs/WINDOWS_COMPAT_PLAN.md)
- [ ] Empaquetado macOS (dmg)
- [ ] Matriz de CI multi-SO (hoy solo Linux)

**Sistema de plugins**
- [ ] Arquitectura completa de plugins (cargar/aislar plugins de terceros — el API de hooks en [`docs/PLUGIN_API.md`](docs/PLUGIN_API.md) ya existe)
- [ ] UI de gestión de plugins (explorar/instalar/activar)

**Protocolos**
- [ ] FTP
- [ ] WebDAV
- [ ] TN3270 (mainframe)
- [ ] Visores VNC adicionales (TigerVNC/RealVNC)

**Terminal y UX**
- [ ] Transferencias ZMODEM reales en el terminal (hoy: la detección de sz/rz deriva a SFTP)
- [ ] Resaltado de sintaxis en la barra de broadcast (PCC)
- [ ] Herencia de perfiles (las plantillas existen; las cadenas de herencia no)

**Estabilidad y calidad**
- [ ] Erradicar el crash de re-render restante en build de producción (cascada de selectores de objeto de Zustand — parcialmente corregido)
- [ ] Suite E2E (Playwright) integrada en CI
- [ ] Documentación de usuario generada desde las specs de capacidades, en inglés y español

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

Cada capacidad está especificada en [`openspec/specs/`](openspec/specs/) — 20
capacidades con requisitos verificables y escenarios BDD. Empieza ahí para
entender el comportamiento esperado antes de sumergirte en el código.

## Contribuir

Los issues y pull requests son bienvenidos. Antes de enviar:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Los cambios significativos pasan por el flujo [OpenSpec](openspec/) — mira
`openspec/changes/archive/` para ejemplos reales de propuesta → tareas → deltas
de spec.

## Licencia

Bifrost es software libre, licenciado bajo la
[Licencia Pública General GNU v3.0 o posterior](LICENSE) (GPL-3.0-or-later).

Nombrado en honor al puente arcoíris ardiente de la mitología nórdica que conecta
los mundos — y construido en memoria de
[Ásbrú Connection Manager](https://www.asbru-cm.net/), cuyo nombre se refiere al
mismo puente.
