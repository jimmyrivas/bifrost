> **⚠️ Archived (2026-07-11).** Historical planning document — not an accurate description of the current app. See [docs/guide](../guide/README.md) and [openspec/specs](../../openspec/specs/) for the verified state.

# BIFROST — Modern Connection Manager

## Prompt para Claude Code

---

Eres el arquitecto y desarrollador principal de **Bifrost**, un connection manager moderno para Linux (y eventualmente cross-platform) que es el sucesor espiritual de Ásbrú Connection Manager (https://www.asbru-cm.net/). El nombre viene de Bifröst, el puente arcoíris de la mitología nórdica que conecta Midgard con Asgard — la misma referencia que inspiró a Ásbrú.

## Visión del Producto

Bifrost toma **todas las capacidades de automatización de Ásbrú** (que ningún otro terminal moderno ofrece) y las empaqueta en una aplicación moderna construida con tecnologías actuales. NO es un terminal genérico — es una herramienta de gestión de conexiones remotas y automatización para sysadmins, DevOps y DevSecOps que manejan decenas o cientos de servidores.

**La diferencia clave con Tabby/Electerm/otros terminales modernos:** Bifrost tiene un motor de automatización (Expect), cluster management, variables globales/locales con sustitución, macros pre/post conexión, y scripting estilo SecureCRT. Esas features son las que no existen en ningún terminal moderno y son la razón de ser de este proyecto.

---

## Stack Tecnológico (NO negociable)

Usamos las **mismas librerías probadas** que usa Tabby, pero con arquitectura limpia en React:

### Core
- **Electron** — shell de aplicación de escritorio
- **React 18+ con TypeScript** — UI (NO Angular, NO Vue)
- **Vite** — build tool
- **Tailwind CSS + shadcn/ui** — sistema de diseño
- **Zustand** — state management (ligero, sin boilerplate)

### Terminal & Conexiones
- **xterm.js** — emulador de terminal (el mismo que usa VS Code y Tabby)
- **@xterm/addon-fit** — auto-resize del terminal
- **@xterm/addon-search** — búsqueda en terminal
- **@xterm/addon-web-links** — links clickeables
- **ssh2** — cliente SSH puro en JS (shell interactivo, SFTP, port forwarding, agent forwarding, jump hosts)
- **node-pty** — pseudo-terminal para shells locales

### Almacenamiento & Seguridad
- **better-sqlite3** — base de datos local para conexiones, grupos, configuración
- **electron safeStorage** — encriptación de credenciales usando el keychain del SO
- **keytar** (fallback) — acceso al keychain del sistema

### Protocolos adicionales (via child process, como hace Ásbrú)
- **FreeRDP (xfreerdp)** — conexiones RDP
- **vncviewer** — conexiones VNC
- **telnet** — conexiones Telnet

---

## Arquitectura de la Aplicación

```
bifrost/
├── electron/
│   ├── main.ts                    # Proceso principal de Electron
│   ├── preload.ts                 # Bridge seguro entre main y renderer
│   ├── ipc/                       # Handlers IPC organizados por dominio
│   │   ├── connections.ipc.ts     # CRUD de conexiones
│   │   ├── sessions.ipc.ts        # Gestión de sesiones activas
│   │   ├── ssh.ipc.ts             # Operaciones SSH (ssh2)
│   │   ├── sftp.ipc.ts            # Operaciones SFTP
│   │   ├── expect.ipc.ts          # Motor Expect
│   │   ├── credentials.ipc.ts     # Encriptación/desencriptación
│   │   └── system.ipc.ts          # Operaciones del sistema (WOL, etc.)
│   ├── services/
│   │   ├── ssh-manager.ts         # Pool de conexiones SSH
│   │   ├── expect-engine.ts       # Motor de Expect (regex + state machine)
│   │   ├── cluster-manager.ts     # Gestión de clusters
│   │   ├── variable-engine.ts     # Motor de sustitución de variables
│   │   ├── credential-store.ts    # Almacén seguro de credenciales
│   │   ├── macro-executor.ts      # Ejecutor de macros pre/post
│   │   ├── keepass-bridge.ts      # Integración con KeePassXC-CLI
│   │   └── session-logger.ts      # Logging de sesiones
│   └── db/
│       ├── schema.ts              # Schema SQLite
│       ├── migrations/            # Migraciones de BD
│       └── repositories/          # Acceso a datos
├── src/                           # Renderer (React)
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx       # Layout principal (sidebar + content)
│   │   │   ├── Sidebar.tsx        # Panel lateral con tree de conexiones
│   │   │   ├── TabBar.tsx         # Barra de tabs de terminales
│   │   │   └── StatusBar.tsx      # Barra de estado inferior
│   │   ├── connections/
│   │   │   ├── ConnectionTree.tsx # Tree view de conexiones y grupos
│   │   │   ├── ConnectionForm.tsx # Formulario de edición de conexión
│   │   │   ├── GroupForm.tsx      # Formulario de grupos
│   │   │   └── QuickConnect.tsx   # Conexión rápida desde barra
│   │   ├── terminal/
│   │   │   ├── TerminalTab.tsx    # Tab individual de terminal
│   │   │   ├── TerminalSplit.tsx  # Split pane de terminales
│   │   │   ├── SftpPanel.tsx      # Panel SFTP integrado
│   │   │   └── TerminalToolbar.tsx
│   │   ├── cluster/
│   │   │   ├── ClusterManager.tsx # UI de gestión de clusters
│   │   │   ├── ClusterBar.tsx     # Barra de input compartido
│   │   │   └── PCC.tsx            # Power Cluster Controller
│   │   ├── automation/
│   │   │   ├── ExpectEditor.tsx   # Editor visual de reglas Expect
│   │   │   ├── MacroEditor.tsx    # Editor de macros
│   │   │   └── VariableManager.tsx # Gestor de variables globales/locales
│   │   ├── settings/
│   │   │   ├── Preferences.tsx    # Preferencias generales
│   │   │   ├── GlobalVariables.tsx
│   │   │   ├── KeyBindings.tsx
│   │   │   ├── Networking.tsx     # Proxy global, SOCKS
│   │   │   └── KeePassConfig.tsx
│   │   └── ui/                    # shadcn/ui components
│   ├── stores/
│   │   ├── connections.store.ts   # Estado de conexiones
│   │   ├── sessions.store.ts      # Sesiones activas
│   │   ├── clusters.store.ts      # Estado de clusters
│   │   ├── variables.store.ts     # Variables globales/locales
│   │   └── preferences.store.ts   # Preferencias
│   ├── hooks/
│   │   ├── useTerminal.ts         # Hook para gestión de terminal
│   │   ├── useSSH.ts              # Hook para conexiones SSH
│   │   ├── useSFTP.ts             # Hook para operaciones SFTP
│   │   ├── useExpect.ts           # Hook para motor Expect
│   │   └── useCluster.ts          # Hook para clusters
│   ├── lib/
│   │   ├── ipc-client.ts          # Cliente IPC tipado
│   │   ├── substitution.ts        # Parser de variables de sustitución (renderer side)
│   │   └── utils.ts
│   └── types/
│       ├── connection.ts          # Tipos de conexión
│       ├── expect.ts              # Tipos de Expect
│       ├── cluster.ts             # Tipos de cluster
│       └── variables.ts           # Tipos de variables
├── package.json
├── electron-builder.yml
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.ts
```

---

## Features Requeridas (Paridad con Ásbrú)

### F1: Connection Manager (CORE)

**GUI para organizar conexiones:**
- Tree view jerárquico con grupos y subgrupos (drag & drop)
- Cada conexión almacena: método (SSH/RDP/VNC/Telnet/Local), host, puerto, credenciales, opciones de terminal
- Templates: crear conexiones basadas en templates predefinidos
- Búsqueda/filtrado rápido en el tree
- Iconos de estado (conectado/desconectado/error)
- Right-click context menu con acciones rápidas
- Tray icon para lanzamiento rápido de conexiones

**Autenticación:**
- Usuario + contraseña
- Clave privada (con passphrase opcional)
- Clave privada + contraseña
- Manual (sin automatización de login)
- Soporte para `<<ASK_PASS>>` — prompt interactivo para passphrase
- Integración KeePassXC vía keepassxc-cli

**Opciones de conexión:**
- Launch on startup (auto-conectar al abrir Bifrost)
- Reconnect on disconnection (reconexión automática)
- Run with sudo
- Use autossh
- Tab/Window title personalizable
- Auto-save session logs con patrón de nombre configurable
- Send string periódicamente (keep-alive configurable, idle-only)

### F2: Motor Expect (DIFERENCIADOR CLAVE)

Este es el corazón de Bifrost. El motor Expect permite automatizar secuencias de login y acciones post-login.

**Funcionamiento:**
1. El motor intercepta el stream de output del terminal (datos que llegan de ssh2/node-pty)
2. Compara contra una cola ordenada de reglas Expect
3. Cada regla tiene: regex pattern + timeout + acción (send string) + on_match/on_fail (ir a regla N)
4. Cuando hay match, envía el string configurado al terminal
5. Si hay timeout sin match, ejecuta la acción de fail

**Reglas globales predefinidas (configurables):**
- PASSWORD prompt: `(?mi)(pass(word|phrase)|contraseña).*?:\s*$`
- USERNAME prompt: `([lL]ogin|[uU]suario|([uU]ser-?)*[nN]ame.*|[uU]ser)\s*:\s*$`
- Command prompt: `[#%\$>]|\:\/\s*$`
- Host key changed: `.*ffending .*key in (.+?)\:(\d+).*`
- Host key verification: `^.+ontinue connecting \(([^/]+)\/([^/]+)(?:[^)]+)?\)\?\s*$`
- Press any key: `.*(any key to continue|tecla para continuar).*`

**Reglas por conexión:**
- Cada conexión puede tener N reglas Expect adicionales ejecutadas en secuencia
- Cada regla: Expect (regex) + Send (string) + Return (añadir CR) + Hide (campo password) + Timeout
- On MATCH → ir a Expect N / On FAIL → ir a Expect N
- Override de reglas globales por conexión
- Debug mode que imprime toda la comunicación (cuidado: revela passwords)

**Secuencia de eventos:**
1. Conexión inicia
2. Expect espera por: key change, new key, password, username, prompt
3. Si NO recibe prompt o hay timeout → DISCONNECT
4. Si hay prompt → ejecutar Expects del usuario hasta timeout o fin de secuencia

**Implementación técnica:**
```typescript
// electron/services/expect-engine.ts
interface ExpectRule {
  id: string;
  pattern: RegExp;         // regex compilado
  sendText: string;        // texto a enviar cuando match
  sendReturn: boolean;     // añadir \r\n
  hideFromLog: boolean;    // es password
  timeout: number;         // ms
  onMatch: string | null;  // id de la siguiente regla en match
  onFail: string | null;   // id de la siguiente regla en fail
}

// El motor es una state machine que opera sobre el stream del terminal
```

### F3: Cluster Management (DIFERENCIADOR CLAVE)

**Clusters:**
- Crear clusters nombrados con N conexiones seleccionadas
- Al abrir un cluster: todas las conexiones se abren simultáneamente
- El teclado se vincula a TODOS los terminales del cluster
- Lo que se escribe en uno se replica en todos

**Power Cluster Controller (PCC):**
- Para terminales abiertos sin cluster formal
- Activar "send keys to all open terminals"
- Permite escribir un comando en un terminal sin pasarlo a los otros
- Barra de input separada para enviar a todos
- Útil cuando un terminal del cluster se reconecta y pierde vinculación

### F4: Sistema de Variables y Sustitución (DIFERENCIADOR CLAVE)

**Variables internas** (formato `<VARIABLE>`):
- `<IP>`, `<PORT>`, `<USER>`, `<PASS>`, `<UUID>`, `<NAME>`, `<TITLE>`
- `<SOCKS5_PORT>`, `<TIMESTAMP>`
- `<DATE_Y>`, `<DATE_M>`, `<DATE_D>`, `<TIME_H>`, `<TIME_M>`, `<TIME_S>`
- `<command prompt>` — regex del prompt configurado

**Variables de entorno** (formato `<ENV:nombre>`):
- `<ENV:HOME>`, `<ENV:LANG>`, `<ENV:DISPLAY>`, etc.

**Variables globales** (formato `<GV:nombre>`):
- Definidas en Preferences → Global Variables
- Ejemplo: `<GV:db_password>` → se usa en CUALQUIER conexión
- Centraliza passwords y valores reutilizables

**Variables de usuario por conexión:**
- Cada conexión puede tener sus propias variables locales

**ASK — Prompt interactivo** (formato `<ASK:parámetros>`):
- `<ASK:descripción|opt1|opt2|opt3>` → muestra select box
- `<ASK:descripción>` → muestra textbox vacío
- Ejemplo en host: `<ASK:Select host|prod.server.com|staging.server.com>`

**CMD — Ejecución de comando** (formato `<CMD:comando>`):
- `<CMD:date>` → ejecuta `date` y usa el output como valor
- Permite valores dinámicos basados en output de comandos

**KeePass** (formato `<field|path>`):
- `<title|/banks/tdc/0000>` — acceso a campos de KeePass

**Wizard de sustitución:** right-click en cualquier campo de input para abrir el wizard que ayuda a construir masks de sustitución.

### F5: Macros Pre/Post Conexión

**Pre-Exec:**
- Lista ordenada de comandos locales ejecutados ANTES de iniciar la conexión
- Cada comando: texto + ask (confirmar antes de ejecutar) + default (propuesto por defecto)
- Soporta sustitución de variables
- La conexión espera a que el comando termine o se demonice

**Post-Exec:**
- Lista ordenada de comandos locales ejecutados DESPUÉS de cerrar la conexión
- Misma configuración que Pre-Exec

**Remote Macros:**
- Comandos enviados al terminal remoto
- Disponibles en context menu de cada conexión
- Globales (para todas las conexiones) + por conexión

**Local Macros:**
- Comandos ejecutados localmente
- Disponibles en context menu de cada conexión
- Globales + por conexión

### F6: Networking

**Proxy global:**
- Configuración de proxy SOCKS que aplica a todas las conexiones
- Override por conexión (usar proxy global / conexión directa / proxy específico)

**Jump Server:**
- Configurar servidor de salto para conexiones SSH
- Soporte para certificado + user/password en el jump server
- Modo "Pseudo Jump Server": no usa `-J` de SSH, sino que hace SSH al jump server y luego envía el string de conexión SSH (útil cuando las claves están en el jump server)

**SSH Tunnels:**
- Port forwarding local y remoto
- Tunneling automático con clusters

### F7: Terminal

**Emulador:**
- xterm.js con soporte completo VT220+
- Split panes (horizontal y vertical, anidados)
- Tabs para múltiples sesiones
- Quake-style dropdown terminal (hotkey global)
- Búsqueda en terminal (addon-search)
- Links clickeables (addon-web-links)
- Selección con mouse, copy/paste

**Personalización por conexión:**
- Color scheme override (ej: rojo para producción, verde para staging)
- Font, tamaño
- Cursor style
- Scrollback buffer size
- Encoding (UTF-8, etc.)

**SFTP integrado:**
- Panel SFTP split con el terminal
- File browser remoto
- Upload/download con drag & drop
- Edición directa de archivos remotos pequeños

### F8: Funcionalidades Adicionales

- **Wake On LAN:** enviar magic packet para despertar máquinas
- **Screenshots y estadísticas** de conexiones
- **Import/Export** de configuración
- **Session logging** automático con patrones de nombre
- **Tray icon** con menú de conexiones rápidas
- **Command line interface** para abrir conexiones desde terminal
- **Configurable keybindings** completos

---

## Modelo de Datos (SQLite)

```sql
-- Grupos jerárquicos
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES groups(id),
  sort_order INTEGER DEFAULT 0,
  icon TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conexiones
CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  group_id TEXT REFERENCES groups(id),
  name TEXT NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('ssh','rdp','vnc','telnet','local','ftp')),
  host TEXT,
  port INTEGER,
  auth_type TEXT CHECK(auth_type IN ('userpass','key','key_pass','manual')),
  username TEXT,
  -- password se almacena encriptado via electron safeStorage
  encrypted_password BLOB,
  private_key_path TEXT,
  encrypted_passphrase BLOB,
  
  -- Opciones
  launch_on_startup BOOLEAN DEFAULT 0,
  reconnect_on_disconnect BOOLEAN DEFAULT 0,
  run_with_sudo BOOLEAN DEFAULT 0,
  use_autossh BOOLEAN DEFAULT 0,
  tab_title TEXT,
  auto_save_log BOOLEAN DEFAULT 0,
  log_pattern TEXT,
  
  -- Keep-alive
  send_string TEXT,
  send_interval_seconds INTEGER,
  send_idle_only BOOLEAN DEFAULT 0,
  
  -- Networking override
  network_mode TEXT DEFAULT 'global' CHECK(network_mode IN ('global','direct','socks','jump')),
  proxy_config TEXT, -- JSON
  jump_server_config TEXT, -- JSON
  
  -- Terminal override
  terminal_override BOOLEAN DEFAULT 0,
  terminal_config TEXT, -- JSON (colors, font, encoding, etc.)
  
  -- SSH específico
  ssh_config TEXT, -- JSON (tunnels, X11 forwarding, etc.)
  
  sort_order INTEGER DEFAULT 0,
  template_id TEXT REFERENCES connection_templates(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Expect rules por conexión
CREATE TABLE expect_rules (
  id TEXT PRIMARY KEY,
  connection_id TEXT REFERENCES connections(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  pattern TEXT NOT NULL,         -- regex
  send_text TEXT NOT NULL,
  send_return BOOLEAN DEFAULT 1,
  hide_from_log BOOLEAN DEFAULT 0,
  timeout_ms INTEGER DEFAULT 10000,
  on_match_rule_id TEXT,         -- siguiente regla en match
  on_fail_rule_id TEXT           -- siguiente regla en fail
);

-- Macros
CREATE TABLE macros (
  id TEXT PRIMARY KEY,
  connection_id TEXT REFERENCES connections(id) ON DELETE CASCADE, -- NULL = global
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('remote','local')),
  sort_order INTEGER DEFAULT 0,
  confirm_before_exec BOOLEAN DEFAULT 0
);

-- Pre/Post exec
CREATE TABLE exec_commands (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK(phase IN ('pre','post')),
  command TEXT NOT NULL,
  ask BOOLEAN DEFAULT 0,
  is_default BOOLEAN DEFAULT 1,
  sort_order INTEGER NOT NULL
);

-- Variables globales
CREATE TABLE global_variables (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  is_password BOOLEAN DEFAULT 0
);

-- Variables por conexión
CREATE TABLE connection_variables (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  is_password BOOLEAN DEFAULT 0,
  UNIQUE(connection_id, name)
);

-- Clusters
CREATE TABLE clusters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cluster_members (
  cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  PRIMARY KEY (cluster_id, connection_id)
);

-- Templates
CREATE TABLE connection_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config TEXT NOT NULL -- JSON con configuración base
);

-- Preferencias globales
CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Global Expect overrides (regex globales)
CREATE TABLE global_expect_patterns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, -- 'password_prompt', 'username_prompt', etc.
  pattern TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1
);
```

---

## Fases de Desarrollo

### Fase 1: Terminal Base (MVP)
1. Setup Electron + React + Vite + TypeScript + Tailwind + shadcn/ui
2. Terminal local funcional con xterm.js + node-pty
3. Tabs de terminales (abrir, cerrar, renombrar)
4. Split panes (horizontal/vertical)
5. Layout base: sidebar + tab bar + terminal area + status bar
6. Preferencias básicas (font, colors, keybindings)

### Fase 2: SSH Connection Manager
1. Base de datos SQLite con schema completo
2. Connection tree con grupos (CRUD completo, drag & drop)
3. Formulario de conexión SSH completo
4. Integración ssh2: shell interactivo, autenticación (password, key, key+pass)
5. Almacenamiento seguro de credenciales con electron safeStorage
6. Panel SFTP integrado
7. Quick connect bar
8. Tray icon con menú de conexiones

### Fase 3: Motor de Automatización (El Diferenciador)
1. Motor Expect completo (regex + state machine sobre stream del terminal)
2. Reglas Expect globales (login automático)
3. Editor visual de reglas Expect por conexión
4. Sistema de variables y sustitución completo (internals, ENV, GV, ASK, CMD)
5. Wizard de sustitución (right-click en inputs)
6. Macros pre/post exec
7. Remote macros y Local macros (globales + por conexión)
8. Debug mode para Expect

### Fase 4: Clusters y Networking
1. Cluster manager (crear, editar, eliminar clusters)
2. Ejecución de clusters (abrir N terminales + vincular teclado)
3. Power Cluster Controller (PCC)
4. Proxy SOCKS global y por conexión
5. Jump Server (estándar y pseudo)
6. SSH tunnels (local y remote port forwarding)

### Fase 5: Features Adicionales
1. Integración KeePassXC (via keepassxc-cli)
2. Conexiones RDP (via xfreerdp child process)
3. Conexiones VNC (via vncviewer child process)
4. Conexiones Telnet
5. Wake On LAN
6. Session logging con patrones
7. Import/Export de configuración
8. Templates de conexión
9. CLI para abrir conexiones desde terminal
10. Quake-style dropdown terminal

### Fase 6: Polish y Extras Modernos
1. Integración AI (sugerencias de comandos, explicación de output)
2. Sincronización de configuración (GitHub Gist o servidor propio)
3. Temas y personalización avanzada
4. Documentación completa
5. Build pipeline (deb, rpm, AppImage, snap)
6. Tests (unit + integration)

---

## Principios de Desarrollo

1. **TypeScript strict mode siempre** — no `any`, no `ts-ignore`
2. **Cada feature en su propio branch** — merge a main cuando funciona
3. **IPC tipado end-to-end** — types compartidos entre main y renderer
4. **Seguridad primero** — credenciales NUNCA en plaintext, usar safeStorage
5. **Separación clara main/renderer** — toda operación de sistema (SSH, FS, DB) en main process
6. **Componentes pequeños y reutilizables** — max 200 líneas por componente
7. **Estado centralizado con Zustand** — no prop drilling
8. **Accesibilidad** — keyboard navigation completa, ARIA labels
9. **i18n ready** — strings en archivos de traducción desde el inicio (español + inglés mínimo)
10. **Documentación inline** — JSDoc en funciones públicas

---

## Para Empezar

Configura el monorepo con Electron + React + Vite + TypeScript. Asegúrate de que el terminal local funcione (xterm.js + node-pty) con tabs y split panes antes de avanzar a la Fase 2.

**Referencia visual:** La UI debería sentirse como una versión moderna de Ásbrú — sidebar izquierdo con tree de conexiones, área principal con tabs de terminales, status bar inferior. Piensa en VS Code pero enfocado en gestión de conexiones remotas. Usa un tema oscuro por defecto con acentos en color puente arcoíris (gradientes sutiles como identidad de marca).
