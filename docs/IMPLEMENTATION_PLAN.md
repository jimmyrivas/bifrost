# Bifrost — Plan de Implementación Detallado

## Análisis de Referencia

Basado en el análisis del código fuente de:
- **Tabby** (github.com/Eugeny/tabby) — 200K+ LOC, 15 módulos, plugin architecture
- **Ásbrú CM** (github.com/asbru-cm/asbru-cm) — 50+ features, 15 protocolos, scripting Perl

---

## PARTE 1: Features de Tabby que Bifrost necesita

### P1.1 — Terminal Avanzado
| # | Feature | Tabby Source | Bifrost Status | Prioridad |
|---|---------|-------------|----------------|-----------|
| 1 | Broadcast input a todos los panes de un tab | `multifocus.service.ts` | No tiene | Alta |
| 2 | Broadcast input a TODOS los tabs | `multifocus.service.ts` | No tiene | Alta |
| 3 | Warning overlay visual durante broadcast | Split components | No tiene | Media |
| 4 | Pane maximize (fullscreen un solo pane) | Split components | No tiene | Media |
| 5 | Pane resize con hotkeys (increase/decrease) | Split components | No tiene | Media |
| 6 | "Explode" tabs (splits → tabs separados) | Tab components | No tiene | Baja |
| 7 | "Combine" tabs (tabs → splits en uno) | Tab components | No tiene | Baja |
| 8 | Dynamic tab titles (desde output del shell) | Tab components | No tiene | Media |
| 9 | Zoom in/out/reset en terminal | Terminal components | No tiene | Alta |
| 10 | Font ligatures support | Terminal settings | No tiene | Baja |
| 11 | Copy-on-select option | Terminal settings | No tiene | Media |
| 12 | Intelligent Ctrl-C (copy si hay selección) | Terminal middleware | No tiene | Alta |
| 13 | Multiline paste warning | Middleware | No tiene | Alta |
| 14 | Progress detection (notify on process end) | Terminal features | No tiene | Media |
| 15 | Zmodem file transfer protocol | `zmodem.ts` | No tiene | Baja |

### P1.2 — SSH Avanzado (de Tabby)
| # | Feature | Tabby Source | Bifrost Status | Prioridad |
|---|---------|-------------|----------------|-----------|
| 16 | Port forwarding UI (local/remote/dynamic) | `sshPortForwarding` | Solo backend | Alta |
| 17 | Algorithm selection (cipher, kex, hmac) | `algorithms.ts` | No tiene | Media |
| 18 | X11 forwarding toggle | `interfaces.ts` | No tiene | Baja |
| 19 | HTTP proxy support (CONNECT method) | `interfaces.ts` | No tiene | Media |
| 20 | SSH agent forwarding config | `interfaces.ts` | Parcial | Media |
| 21 | Host key verification modal | SSH components | No tiene | Alta |
| 22 | Known hosts management | SSH service | No tiene | Alta |
| 23 | Session multiplexing/reuse | `sshMultiplexer.service.ts` | No tiene | Media |
| 24 | Connection retry with timeout | SSH service | No tiene | Alta |

### P1.3 — Vault y Seguridad (de Tabby)
| # | Feature | Tabby Source | Bifrost Status | Prioridad |
|---|---------|-------------|----------------|-----------|
| 25 | Encrypted credential vault con passphrase | `vaultSettingsTab` | Parcial (safeStorage) | Alta |
| 26 | Vault password change | Vault service | No tiene | Media |
| 27 | File secret storage (certs, keys en vault) | Vault service | No tiene | Media |
| 28 | Configuration encryption option | Config service | No tiene | Media |

### P1.4 — Plugin System (de Tabby)
| # | Feature | Tabby Source | Bifrost Status | Prioridad |
|---|---------|-------------|----------------|-----------|
| 29 | NPM-based plugin architecture | `tabby-plugin-manager` | No tiene | Baja |
| 30 | Plugin manager UI (browse, install, remove) | Plugin manager | No tiene | Baja |
| 31 | Extension points (hotkeys, themes, menus, profiles) | API interfaces | No tiene | Baja |

### P1.5 — UX (de Tabby)
| # | Feature | Tabby Source | Bifrost Status | Prioridad |
|---|---------|-------------|----------------|-----------|
| 32 | Command palette (Ctrl+Shift+P) | Command selector | No tiene | Alta |
| 33 | Multi-chord hotkeys | `hotkeys.ts` | No tiene | Media |
| 34 | Profile groups/folders | Profile service | Parcial | Media |
| 35 | Profile inheritance (defaults + overrides) | Profile service | No tiene | Media |
| 36 | 50+ color schemes incluidos | `community-color-schemes` | No tiene | Alta |
| 37 | Color scheme preview/selector | Color scheme components | No tiene | Alta |
| 38 | Save current session as profile | Context menu | No tiene | Media |
| 39 | Window state persistence | Electron app | No tiene | Media |
| 40 | Clickable links (URL, file paths) | `tabby-linkifier` | Parcial (addon) | Media |

---

## PARTE 2: Features de Ásbrú que Bifrost necesita

### P2.1 — Protocolos Adicionales
| # | Feature | Ásbrú Source | Bifrost Status | Prioridad |
|---|---------|-------------|----------------|-----------|
| 41 | Mosh (mobile shell) | `PACMethod_mosh.pm` | No tiene | Media |
| 42 | FTP client | `PACMethod_ftp.pm` | No tiene | Baja |
| 43 | 3270 terminal (TN3270E) | `PACMethod_3270.pm` | No tiene | Baja |
| 44 | TigerVNC / RealVNC alternativas | `PACMethod_tigervnc.pm` | No tiene | Baja |
| 45 | WebDAV (Cadaver) | `PACMethod_cadaver.pm` | No tiene | Baja |
| 46 | Generic command (usuario define el comando) | `PACMethod_generic.pm` | No tiene | Media |
| 47 | RDP avanzado (clipboard, drives, printers, audio) | `PACMethod_xfreerdp.pm` | Parcial | Media |

### P2.2 — Automatización Avanzada (Corazón de Ásbrú)
| # | Feature | Ásbrú Source | Bifrost Status | Prioridad |
|---|---------|-------------|----------------|-----------|
| 48 | Expect rules activo/inactivo toggle | `PACExpectEntry.pm` | No tiene | Alta |
| 49 | Expect debug con screenshot preview | `PACExpectEntry.pm` | Parcial | Alta |
| 50 | Expect jump a regla específica (by index) | `PACExpectEntry.pm` | Existe | - |
| 51 | Custom scripts engine (Perl-based) | `PACScripts.pm` (1000+ LOC) | No tiene | Alta |
| 52 | Script editor con syntax highlighting | `PACScripts.pm` | No tiene | Alta |
| 53 | Script modes: SESSION vs CONNECTION | `PACScripts.pm` | No tiene | Alta |
| 54 | Script access to %TERMINAL (commands) | `PACScripts.pm` | No tiene | Alta |
| 55 | Pre/post exec con confirmación ASK | `PACPrePostEntry.pm` | Parcial | Media |
| 56 | Auto-clusters (agrupar por patrón) | `PACCluster.pm` | No tiene | Media |

### P2.3 — Gestión de Conexiones Avanzada
| # | Feature | Ásbrú Source | Bifrost Status | Prioridad |
|---|---------|-------------|----------------|-----------|
| 57 | Favoritos/bookmarks | `PACUtils.pm` | No tiene | Alta |
| 58 | Historial de conexiones recientes | `PACMain.pm` | No tiene | Alta |
| 59 | Búsqueda incremental en tree | `PACMain.pm` | No tiene | Alta |
| 60 | Estadísticas por conexión (# usos, tiempo) | `PACStatistics.pm` | No tiene | Media |
| 61 | Screenshots de sesiones | `PACUtils.pm` | No tiene | Baja |
| 62 | Import/export YAML config | `PACConfig.pm` | No tiene | Alta |
| 63 | Connection validation pre-launch | `PACUtils.pm` | No tiene | Media |

### P2.4 — Context Menus (Diferenciador Ásbrú)
| # | Feature | Ásbrú Source | Bifrost Status | Prioridad |
|---|---------|-------------|----------------|-----------|
| 64 | Right-click en conexión: Connect, Edit, Clone, Delete, Favorite, WOL | `PACMain.pm` | No tiene | Alta |
| 65 | Right-click en terminal: Copy, Paste, Find, Send to cluster, Save as, Disconnect | `PACTerminal.pm` | No tiene | Alta |
| 66 | Right-click en grupo: Open all, Close all, Create sub-group | `PACMain.pm` | No tiene | Alta |
| 67 | SSH options context menu (140+ opciones) | `PACMethod_ssh.pm` | No tiene | Media |
| 68 | Right-click en input fields: Variable substitution wizard | `PACVarEntry.pm` | No tiene | Alta |

### P2.5 — PCC y Utilidades
| # | Feature | Ásbrú Source | Bifrost Status | Prioridad |
|---|---------|-------------|----------------|-----------|
| 69 | PCC multi-line editor con syntax highlighting | `PACPCC.pm` (800+ LOC) | Parcial | Media |
| 70 | PCC auto-save a archivo | `PACPCC.pm` | No tiene | Baja |
| 71 | PCC 60+ lenguajes highlighting | `PACPCC.pm` | No tiene | Baja |
| 72 | Tab/Window mode toggle | `PACTerminal.pm` | No tiene | Media |
| 73 | Fullscreen mode (F11) | `PACTerminal.pm` | No tiene | Media |
| 74 | Auto-reconnect con max retries (50) | `PACTerminal.pm` | No tiene | Alta |
| 75 | Tray icon con favorites, clusters, history menus | `PACTray.pm` | Parcial | Media |

---

## PARTE 3: Nuevas Funcionalidades DevOps/DevSecOps

### P3.1 — Integración con Password Managers
| # | Feature | Descripción | Esfuerzo | Valor |
|---|---------|-------------|----------|-------|
| 76 | 1Password CLI (op) integration | SSH agent de 1Password auto-fill passwords/keys. `op item get` para credenciales | M | 5/5 |
| 77 | Bitwarden CLI integration | `bw get password` para auto-fill SSH credentials | S | 4/5 |
| 78 | HashiCorp Vault SSH engine | Certificate signing para SSH ephemeral keys via Vault API | L | 5/5 |
| 79 | AWS Secrets Manager | Fetch SSH keys/passwords desde AWS SM via SDK | M | 4/5 |
| 80 | Azure Key Vault | Fetch secrets desde Azure KV | M | 3/5 |

### P3.2 — Cloud Infrastructure Auto-Discovery
| # | Feature | Descripción | Esfuerzo | Valor |
|---|---------|-------------|----------|-------|
| 81 | AWS EC2 auto-discovery | `aws ec2 describe-instances` → auto-create connections | M | 5/5 |
| 82 | GCP instance discovery | `gcloud compute instances list` → connections | M | 4/5 |
| 83 | Azure VM discovery | `az vm list` → connections | M | 3/5 |
| 84 | Ansible inventory import | Parse YAML/INI inventory → connection groups | S | 5/5 |
| 85 | Terraform state import | Read `.tfstate` → extract host IPs, create connections | M | 4/5 |
| 86 | SSH config import | Parse `~/.ssh/config` → create connections | S | 5/5 |

### P3.3 — Container & Kubernetes
| # | Feature | Descripción | Esfuerzo | Valor |
|---|---------|-------------|----------|-------|
| 87 | kubectl exec integration | List pods, exec into container terminal | M | 5/5 |
| 88 | Docker exec integration | List containers, exec shell | M | 4/5 |
| 89 | AWS SSM Session Manager | `aws ssm start-session` para acceso sin SSH | L | 4/5 |
| 90 | Podman exec integration | Alternativa a Docker | S | 3/5 |

### P3.4 — Seguridad DevSecOps
| # | Feature | Descripción | Esfuerzo | Valor |
|---|---------|-------------|----------|-------|
| 91 | SSH Certificate Authority (CA) | Short-lived SSH certificates via CA signing | L | 5/5 |
| 92 | FIDO2/WebAuthn SSH keys | Hardware key support (YubiKey, etc.) | M | 4/5 |
| 93 | Session recording for compliance | Record terminal sessions, playback, audit trail | L | 5/5 |
| 94 | Audit log (quién conectó dónde, cuándo) | Structured logging de todas las conexiones | M | 5/5 |
| 95 | Smart paste (detect dangerous commands) | Warn antes de pegar rm -rf, DROP TABLE, etc. | S | 4/5 |
| 96 | MFA/2FA para SSH | TOTP integration para acceso SSH | M | 3/5 |

### P3.5 — AI & Inteligencia
| # | Feature | Descripción | Esfuerzo | Valor |
|---|---------|-------------|----------|-------|
| 97 | AI command suggestions (local LLM) | Sugerencias de comandos via Ollama/local LLM | L | 4/5 |
| 98 | Command explanation | Explain complex commands via AI | M | 4/5 |
| 99 | Error detection & suggestions | Detect errors en output, suggest fixes | L | 3/5 |
| 100 | Command snippets/palette | Library de comandos frecuentes con búsqueda | M | 5/5 |

### P3.6 — Modern UX
| # | Feature | Descripción | Esfuerzo | Valor |
|---|---------|-------------|----------|-------|
| 101 | Fuzzy search global | Search across connections, commands, history | M | 5/5 |
| 102 | Tags/labels en conexiones | Categorización flexible (prod, staging, db, web) | S | 4/5 |
| 103 | Last-connected timestamps | Mostrar cuándo fue la última conexión | S | 4/5 |
| 104 | Connection health monitoring | Ping periódico, latency display | M | 4/5 |
| 105 | Multiple workspaces | Separar conjuntos de conexiones por proyecto | M | 3/5 |
| 106 | tmux session management | List/attach tmux sessions en host remoto | M | 4/5 |
| 107 | Git-based config sync | Sync configuración via Git repo | M | 3/5 |

---

## PLAN DE IMPLEMENTACIÓN POR FASES

### FASE A: Paridad Crítica (Features esenciales de Tabby + Ásbrú)
**Objetivo**: Llegar a paridad funcional con lo que los usuarios esperan

| Sprint | Features | Duración |
|--------|----------|----------|
| A.1 | Context menus completos (#64-68), búsqueda en tree (#59), favoritos (#57), historial (#58) | Sprint 1 |
| A.2 | Broadcast input panes/tabs (#1-3), zoom terminal (#9), Ctrl-C inteligente (#12), paste warning (#13) | Sprint 2 |
| A.3 | SSH host key verification (#21-22), port forwarding UI (#16), connection retry (#24), auto-reconnect (#74) | Sprint 3 |
| A.4 | Command palette Ctrl+Shift+P (#32), 50+ color schemes (#36-37), import/export config (#62) | Sprint 4 |
| A.5 | SSH config import (#86), expect active/inactive toggle (#48), expect debug mejorado (#49) | Sprint 5 |

### FASE B: Automatización (Diferenciador de Ásbrú modernizado)
**Objetivo**: Superar a Ásbrú en automatización con UX moderna

| Sprint | Features | Duración |
|--------|----------|----------|
| B.1 | Custom scripts engine con editor + highlighting (#51-54), script templates | Sprint 6 |
| B.2 | Variable substitution wizard mejorado (#68), pre/post exec con ASK (#55) | Sprint 7 |
| B.3 | Auto-clusters (#56), PCC multi-line editor (#69), fullscreen mode (#73) | Sprint 8 |
| B.4 | Connection statistics (#60), session recording básico (#93), audit log (#94) | Sprint 9 |

### FASE C: DevOps Cloud Native
**Objetivo**: Features que ningún terminal tiene — el diferenciador de Bifrost

| Sprint | Features | Duración |
|--------|----------|----------|
| C.1 | SSH config import (#86), Ansible inventory import (#84), tags/labels (#102) | Sprint 10 |
| C.2 | AWS EC2 auto-discovery (#81), GCP discovery (#82), fuzzy search (#101) | Sprint 11 |
| C.3 | kubectl exec integration (#87), Docker exec (#88) | Sprint 12 |
| C.4 | 1Password CLI integration (#76), Bitwarden CLI (#77) | Sprint 13 |

### FASE D: Seguridad DevSecOps
**Objetivo**: Features de seguridad enterprise

| Sprint | Features | Duración |
|--------|----------|----------|
| D.1 | Smart paste / dangerous command detection (#95), encrypted vault mejorado (#25-28) | Sprint 14 |
| D.2 | HashiCorp Vault SSH engine (#78), SSH CA (#91) | Sprint 15 |
| D.3 | FIDO2/WebAuthn SSH keys (#92), session recording completo (#93) | Sprint 16 |
| D.4 | AWS SSM integration (#89), Terraform state import (#85) | Sprint 17 |

### FASE E: AI & Polish
**Objetivo**: Inteligencia artificial y pulido final

| Sprint | Features | Duración |
|--------|----------|----------|
| E.1 | Command snippets/palette (#100), tmux session management (#106) | Sprint 18 |
| E.2 | AI command suggestions via Ollama (#97), command explanation (#98) | Sprint 19 |
| E.3 | Plugin system básico (#29-31), community color schemes | Sprint 20 |
| E.4 | Connection health monitoring (#104), Git config sync (#107), performance audit | Sprint 21 |

---

## RESUMEN EJECUTIVO

| Categoría | Total Features | Ya implementadas | Pendientes |
|-----------|---------------|------------------|------------|
| Tabby (terminal) | 40 | 5 | 35 |
| Ásbrú (gestión) | 35 | 8 | 27 |
| DevOps nuevo | 32 | 0 | 32 |
| **TOTAL** | **107** | **13** | **94** |

### Diferenciadores únicos de Bifrost (no existen en Tabby ni Ásbrú):
1. **Cloud auto-discovery** (AWS/GCP/Azure)
2. **1Password / Bitwarden / Vault integration**
3. **kubectl / docker exec** embedded
4. **AI command suggestions** (local LLM)
5. **Smart paste** (dangerous command detection)
6. **SSH Certificate Authority** integration
7. **Session recording** for compliance
8. **Ansible / Terraform** inventory import
9. **AWS SSM** Session Manager
10. **FIDO2/WebAuthn** SSH keys
