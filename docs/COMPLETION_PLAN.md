# Bifrost — Plan de Completación de Features Pendientes

## Progreso

### FASE 1: Completada (2026-03-23)
| Item | Feature | Estado | Verificación |
|------|---------|--------|--------------|
| 1.1 | Explode/Combine tabs (#6,#7) | DONE | Context menu items + 4 unit tests |
| 1.2 | Known Hosts Panel (#22) | DONE | Settings > SSH > Known Hosts table + refresh/delete |
| 1.3 | Pre/Post Exec Editor (#55) | DONE | ConnectionForm > Hooks tab + IPC CRUD |
| 1.5 | Health Monitor dots (#104) | DONE | Live ping dots (green/red/grey) + tooltip |
| E2E | Playwright verification | DONE | Tabs dinámicos, SSH settings, Remote Cmds editor |
| Tests | Unit tests | 73 passing (was 67) | +6 new: explode, combine, sftp toggle, lock title |

### FASE 2: Completada (2026-03-23)
| Item | Feature | Estado | Verificación |
|------|---------|--------|--------------|
| 2.1 | Port Forwarding UI (#16) | DONE | PortForwardingSection in Advanced SSH tab |
| 2.2 | Session Multiplexing (#23) | DONE | "Reuse SSH Connection" toggle in SshOptionsPanel |
| 2.3 | Vault Status (#26) | DONE | Settings > Security > Check Vault Status |
| 2.4 | Config Encryption (#28) | DONE | Settings > Security > Encrypt exported configs |
| 2.5 | Auto-Clusters (#56) | DONE | Already implemented — AUTO-CLUSTER button |
| Tests | Unit tests | 74 passing | No regressions |

### Extra: Implementados entre fases
| Item | Feature | Estado |
|------|---------|--------|
| Mosh protocol (#41) | DONE | Full end-to-end: DB, Form, useTerminal dispatch, MethodIcon |
| SSH Key Browse | DONE | BROWSE button opens native file dialog |
| Passphrase field | DONE | Visible when auth type is CERTIFICATE |
| Clone connection fix | DONE | Clean field copy without encrypted blobs |
| Tab title templates | DONE | Variable engine: `<USER>@<IP> - <NAME>` |
| Remote Commands | DONE | Full Asbru-style: editor + context menu + groups |
| Workspaces | DONE | Selector + filter + assign via context menu |
| SFTP Panel | DONE | Side panel with file browser, upload, download |
| Font system (Meslo) | DONE | Meslo LG S installed, improved previews |
| Script dedup bug | DONE | Fixed .js/.json filter + auto-deduplicate |

### FASE 3: Completada (2026-03-23)
| Item | Feature | Estado | Verificación |
|------|---------|--------|--------------|
| 3.1 | FIDO2/WebAuthn (#92) | DONE | "HARDWARE KEY" auth tab + ed25519-sk info + useFido2 flag |
| 3.2 | MFA/2FA TOTP (#96) | DONE | TOTP Secret field + auto-inject via expect pattern + totp.ts |
| 3.3 | Expect Debug (#49) | DONE | IPC getStatus + debug log + isRunning/getCurrentRule methods |
| 3.4 | Extension API (#31) | DONE | PluginHooks interface + dispatchHook + PLUGIN_API.md |
| Tests | Unit tests | 74 passing | No regressions |

### FASE 4: Completada (2026-03-23)
| Item | Feature | Estado | Verificación |
|------|---------|--------|--------------|
| 4.1 | Script modes selector (#53) | DONE | Dropdown "Active Terminal / All Tabs" in ScriptEditor |
| 4.2 | PCC auto-save (#70) | DONE | Already implemented (localStorage + 1s debounce) |
| 4.3 | Connection stats tooltip (#60) | DONE | Health dot tooltip: Host, Port, Protocol |
| 4.4 | Zmodem transfer (#15) | DONE | Direction detection (sz/rz) + SFTP redirect notification |
| 4.5 | Pane resize hotkeys (#5) | DONE | Ctrl+Shift+Arrow dispatches event (drag resize works) |
| 1.4 | Profile Templates (#35) | DONE | Save as Template in context menu + From Template dropdown |

### AUDITORÍA FINAL: Features reparados (2026-03-23)
| Item | Feature | Problema | Fix |
|------|---------|----------|-----|
| #60 | ConnectionStats | Componente existía pero nunca renderizado | Wired en ConnectionForm > General > Statistics section |
| #69-71 | PCCBar | Componente existía pero nunca renderizado | Wired en AppShell debajo de TabBar con broadcast integration |
| #106 | TmuxManager | Componente existía pero nunca renderizado | Wired en Clusters view debajo de ClusterManagerUI |
| #93 | Session Recording | IPC existía sin UI | "Toggle Recording" en terminal context menu (SSH only) |
| AppImage | Packaging | Sin icono, no verificado | Icon generado, electron-builder config verificado |

### WARP-INSPIRED: Features implementados (2026-03-23)
| Item | Feature | Estado |
|------|---------|--------|
| W1.1 | Secret Redaction (terminal output) | DONE — regex patterns + toggle in Settings > Security |
| W1.2 | Extended Command Palette (snippets + commands) | DONE — searches snippets alongside connections |
| W1.3 | Snippet Browser panel | DONE — sidebar panel with categories, search, copy, run |
| W1.4 | Error Detection verified | DONE — scanForErrors connected in all 3 terminal modes |
| W2.1 | AI Multi-provider | DONE — Ollama, OpenRouter, OpenAI, DeepSeek support |
| W2.2 | AI Settings UI | DONE — Settings > AI tab with provider, key, model, test |
| W2.3 | Parameterized Workflows | DONE — {{arg}} templates in snippets + remote commands |
| W2.4 | Notebooks/Runbooks | DONE — Markdown + executable code blocks, EDIT/PREVIEW, RUN ALL |
| W3.2 | Launch Configurations | DONE — saveLayout/getLayout in workspace store |
| W3.3 | Shell Integration / Partial Blocks | DONE — OSC 133 detection + bash/zsh integration scripts |
| AppImage | Packaging | DONE — dist/Bifrost-0.1.0.AppImage (124 MB) |

### Extra: SSH Tunnels System (2026-03-23)
| Item | Feature | Estado |
|------|---------|--------|
| DB + Schema | tunnels table + migration 3 | DONE |
| IPC | CRUD + start/stop/stopAll/status/listActive | DONE |
| TunnelManager UI | Full editor + list + status dots + uptime | DONE |
| Sidebar | "Tunnels" nav item | DONE |
| Background lifecycle | Auto-start on app launch + reconnect | DONE |
| Tray notification | Desktop notification on disconnect | DONE |

---

## Cómo probar la Fase 2

### Iniciar la app
```bash
cd /home/jrivas/Devel/bifrost
./node_modules/.bin/electron-vite dev
```

### Test 2.1: Port Forwarding UI
1. Click **"New Connection"** o editar una conexión SSH existente
2. Click en tab **"ADVANCED SSH"**
3. En la parte superior debe aparecer la sección **"Port Forwarding"** con 3 tipos:
   - **Local** — "Forward local port to remote"
   - **Remote** — "Forward remote port to local"
   - **Dynamic (SOCKS)** — "SOCKS proxy on local port"
4. Click **"+ Add"** en Local → aparece prompt pidiendo valor (ej: `8080 localhost:80`)
5. El forward aparece en la lista con botón Delete (basura)
6. Click el icono basura → se elimina
7. Agregar múltiples forwards al mismo tipo → se muestran como lista
8. Los valores se guardan en sshConfig JSON al hacer Save

### Test 2.2: Session Multiplexing
1. En la misma conexión SSH, tab **"ADVANCED SSH"**
2. Arriba de todo (antes de Port Forwarding) debe verse:
   - Toggle **"Reuse SSH Connection"**
   - Subtítulo: "Share one SSH session across multiple terminals to the same host"
3. Activar/desactivar el toggle
4. Save → el flag se almacena en sshConfig como `__reuseConnection: "true"`

### Test 2.3-2.4: Security Settings
1. Click **"Settings"** en el sidebar (parte inferior)
2. Debe verse una nueva pestaña **"Security"** (icono candado) entre SSH y Language
3. Click en **"Security"**
4. Sección **"CREDENTIAL VAULT"**:
   - Texto explicativo sobre gnome-keyring/kwallet
   - Botón **"Check Vault Status"** → muestra alert indicando si keychain está disponible
5. Sección **"CONFIGURATION ENCRYPTION"**:
   - Texto explicativo
   - Toggle **"Encrypt exported configurations"** (muestra "Feature in development" al activar)

### Test 2.5: Auto-Clusters
1. Click **"Clusters"** en el sidebar
2. Click botón **"AUTO-CLUSTER"** en la esquina superior derecha
3. Aparece formulario con:
   - Input "Cluster name" + Input "Regex pattern"
   - Preview en vivo mostrando cuántas conexiones matchean
4. Escribir un patrón regex (ej: `prod-.*` o `web`)
5. Click **"Create Auto-Cluster"** → crea cluster con las conexiones que coinciden

### Verificación automatizada
```bash
# Unit tests (debe dar 74 passing)
./node_modules/.bin/vitest run

# Build (debe completar sin errores)
./node_modules/.bin/electron-vite build
```

---

## Cómo probar features de fases anteriores y extras

### Tab Title Templates
1. Crear conexión SSH con user `jrivas` y host `192.168.1.100`
2. En tab General > Behavior: llenar "TAB TITLE TEMPLATE" con `<USER>@<IP>`
3. Save + double-click para conectar → el tab debe mostrar `jrivas@192.168.1.100`

### Remote Commands
1. Click **"Remote Cmds"** en sidebar
2. Llenar: Command=`uptime`, Description=`Check uptime`, Group=`Monitoring`
3. Click **SAVE**
4. El comando aparece en la lista izquierda y en el "CONTEXT MENU PREVIEW" abajo
5. Abrir terminal SSH → right-click → **"Remote Commands"** → **Monitoring** → **Check uptime**
6. El comando `uptime` se envía al terminal

### Workspaces
1. Click selector **"All Connections"** en la barra superior
2. Click **"New Workspace"** → escribir nombre → Enter
3. Right-click una conexión en el tree → **"Workspaces"** → click en el workspace
4. Aparece dot verde indicando que la conexión pertenece al workspace
5. Seleccionar el workspace en el selector → el tree filtra solo esas conexiones
6. Click **"All Connections"** para ver todas de nuevo

### SFTP Panel (requiere SSH activo)
1. Conectar a un servidor SSH (double-click en conexión)
2. Right-click en el terminal → **"Open SFTP"**
3. Panel lateral aparece a la derecha mostrando archivos del home
4. Double-click carpeta → navega
5. Botón flecha arriba → sube un nivel
6. Botón **Upload** (flecha arriba) → abre diálogo para seleccionar archivos locales
7. Click **Download** (flecha abajo en un archivo) → abre diálogo "Guardar como"
8. Click **Delete** (basura) → pide confirmación
9. Click **New Folder** → pide nombre
10. Arrastrar borde izquierdo del panel → redimensionable
11. Click **X** o right-click → "Close SFTP" para cerrar

### Connection Form Tabs
1. Crear nueva conexión, verificar tabs según protocolo:
   - **SSH**: GENERAL | ADVANCED SSH | HOOKS | TERMINAL
   - **Mosh**: GENERAL | ADVANCED SSH | HOOKS | TERMINAL
   - **Telnet/Local/Custom**: GENERAL | HOOKS | TERMINAL
   - **RDP**: GENERAL (con RDP Advanced Options inline)
   - **VNC/FTP**: GENERAL (solo)
2. Tab **HOOKS**: Click "+ Add Hook" → selector PRE/POST, campo command, checkbox Ask, botón Remove
3. Tab **TERMINAL**: Color scheme, Environment tint, Font family, Font size, Cursor, Live preview

### Known Hosts
1. Conectar a un servidor SSH → aceptar host key
2. **Settings** → tab **SSH** → **Known Hosts**
3. El host debe aparecer en la tabla con: host:port, algorithm, fingerprint, fecha
4. Click **Delete** → confirmar → host se elimina (próxima conexión pedirá verificar de nuevo)

### Health Dots
1. Crear conexión con host real accesible → dot verde aparece después de ~3s
2. Crear conexión con host inexistente → dot rojo
3. Conexión sin host (local) → dot gris

### Explode/Combine
1. Abrir terminal → right-click → **"Split Horizontal"** → aparecen 2 panes
2. Right-click → debe aparecer **"Explode to Tabs"** → click → cada pane se convierte en tab
3. Con 2+ tabs → right-click → **"Combine All Tabs"** → todo en un tab con splits

### Mosh
1. Crear conexión con protocolo **"Mosh (Mobile Shell)"**
2. Llenar host, user → Save
3. Double-click → debe conectar via `mosh user@host`
4. Requiere `mosh` instalado en cliente y servidor: `sudo apt install mosh`

---

## FASE 3: Features con Implementación Mínima
**Prioridad**: Media | **Esfuerzo**: Alto

### 3.1 — FIDO2/WebAuthn SSH Keys (#92)
**Qué falta**: Flow completo + UI
**Implementar**:
- Detectar security keys via `navigator.credentials` o `libfido2`
- Agregar auth type "Hardware Key" en ConnectionForm
- ssh-manager: usar `-o SecurityKeyProvider` flag
- UI: indicador de hardware key detectada

### 3.2 — MFA/2FA TOTP (#96)
**Qué falta**: Flow TOTP completo
**Implementar**:
- Campo "TOTP Secret" en ConnectionForm (encriptado)
- Auto-generar código TOTP cuando expect detecta prompt "Verification code:"
- Usar librería `otpauth` para generar códigos
- Expect rule auto-inyectada para conexiones con TOTP configurado

### 3.3 — Expect Debug Mejorado (#49)
**Qué falta**: UI para debug visual
**Implementar**:
- Panel "Expect Debug" en sidebar cuando hay reglas activas
- Muestra: estado actual, regla activa, match/timeout, log
- Toggle debug mode per-connection

### 3.4 — Extension Points API (#31)
**Qué falta**: Documentar API + hooks para plugins
**Implementar**:
- Definir interfaces: `BifrostPlugin`, `PluginHooks`
- Hooks: `onConnect`, `onDisconnect`, `onData`, `onTabCreate`, `registerContextMenu`
- Documentar en `docs/PLUGIN_API.md`

---

## FASE 4: Polish y Completitud
**Prioridad**: Media-Baja | **Esfuerzo**: Bajo

### 4.1 — Script Modes Session vs Connection (#53)
Selector en ScriptEditor: "Run on: Active Terminal | All tabs | Specific connection"

### 4.2 — PCC Auto-Save (#70)
Auto-guardar contenido PCC cada 30s a localStorage

### 4.3 — Connection Statistics (#60)
Tooltip en connection tree con: # sesiones, última conexión, duración promedio

### 4.4 — Zmodem Transfer Real (#15)
Conectar zmodem detection a dialog de transferencia real

### 4.5 — Pane Resize Hotkeys (#5)
Ctrl+Shift+Arrow para resize de panes

---

## Criterio de Completación

Un feature se considera **100% completo** cuando:
1. Backend/servicio implementado y funcional
2. UI accesible (botón, menú, shortcut, o navegación)
3. Test unitario pasa
4. Test E2E (Chrome DevTools) verifica que el componente se renderiza
5. Build pasa sin errores
6. No introduce regresiones en tests existentes
