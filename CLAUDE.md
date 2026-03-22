# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bifrost is a modern connection manager for Linux (future cross-platform), the spiritual successor to Asbru Connection Manager. It targets sysadmins, DevOps, and DevSecOps who manage dozens/hundreds of remote servers. 106/107 planned features implemented.

**License**: GPL | **Repo**: https://gitlab.com/jimmy.rivas/bifrost

## Tech Stack

- **Build**: electron-vite 5.x (alex8088), Electron 34.x
- **UI**: React 18 + TypeScript strict, Vite 6, Tailwind CSS v4, shadcn/ui (manual)
- **State**: Zustand 5.x (renderer only, IPC on-demand — NO @zubridge)
- **Terminal**: @xterm/xterm 6.x + addon-webgl + addon-fit + addon-search + addon-web-links
- **SSH**: ssh2 1.17+ (pure JS, no rebuild), node-pty 1.1+ (needs @electron/rebuild)
- **Database**: better-sqlite3 + Drizzle ORM
- **Design**: "Spectral Command" system (docs/reference/DESIGN.md)
- **Testing**: Vitest (67 tests), Playwright (E2E)

## Commands

```bash
npm run dev          # Electron + Vite dev with HMR
npm run build        # Production build (electron-vite build)
npm run test         # Vitest unit tests
npm run package      # electron-builder (deb, rpm, AppImage)
```

## Critical Lessons Learned

### Zustand Selectors — NEVER subscribe to arrays/objects
**Problem**: `useSessionsStore((s) => s.tabs)` creates a new array reference on every store update, causing infinite re-render loops (React error #185) in production builds.
**Fix**: Use `getState()` for reads inside callbacks/effects. Use individual field selectors (`s => s.activeTabId`) not object selectors (`s => s.terminal`).
**Files affected**: App.tsx, XTerminal.tsx, useTerminal.ts

### Preload outputs .mjs not .js
electron-vite generates `out/preload/index.mjs`. The main process preload path must reference `.mjs`:
```ts
preload: join(__dirname, '../preload/index.mjs')
```

### PostCSS must NOT be overridden in electron.vite.config.ts
Tailwind v4 uses `@tailwindcss/postcss` configured in `postcss.config.js`. If electron.vite.config.ts has `css: { postcss: { plugins: [] } }`, it overrides and breaks all Tailwind utilities.

### safeStorage fallback for Linux
`electron.safeStorage` may not be available on Linux without gnome-keyring/kwallet. The `credential-store.ts` falls back to base64 encoding with a warning.

### Terminal persistence across tabs
All tabs must be mounted simultaneously in the DOM. Use `visibility: hidden` + `z-index` to show/hide — NOT conditional rendering which destroys PTY sessions.

### Detach/Reattach — PTY proxy pattern
When detaching a terminal to a separate window:
1. Mark tab as "detaching" so useTerminal cleanup skips `terminal.destroy()`
2. `window-router.ts` redirects IPC output to the new window owner
3. Buffer last 5000 output lines for replay on the new window
4. Pass `sessionId` via URL query params so detached window claims ownership

### fs.globSync doesn't exist in Electron's Node
Electron 34 uses Node 20 which lacks `fs.globSync` (Node 22+). Use manual regex-based directory listing instead.

### Context menus via Radix UI
Radix ContextMenu works in Electron but dispatching `contextmenu` events programmatically via CDP doesn't reliably trigger React's synthetic event handling.

## Architecture

```
src/main/                     # Electron main process
  index.ts                    # Entry, IPC registration, window management
  db/                         # SQLite + Drizzle ORM (14 tables)
  ipc/                        # 17 IPC handler modules
    terminal.ipc.ts            # PTY lifecycle + window routing
    ssh.ipc.ts                 # SSH connect/shell/forwarding + window routing
    connections.ipc.ts         # Connection CRUD
    credentials.ipc.ts         # Encrypt/decrypt + vault management
    expect.ipc.ts              # Expect engine lifecycle
    cluster.ipc.ts             # Cluster CRUD + sessions
    import.ipc.ts              # SSH config, Ansible, export/import
    discovery.ipc.ts           # AWS/GCP/Azure/Docker/K8s discovery
    password-manager.ipc.ts    # 1Password, Bitwarden, Vault, AWS SM, Azure KV
    snippets.ipc.ts            # Command snippets CRUD
    scripts.ipc.ts             # Script engine CRUD
    ai.ipc.ts                  # Ollama LLM integration
    plugins.ipc.ts             # Plugin management
    fonts.ipc.ts               # System monospace font scanning
    protocols.ipc.ts           # RDP/VNC/Telnet/FTP/Mosh/SSM/3270/WebDAV
    sftp.ipc.ts                # SFTP operations
    system.ipc.ts              # WOL, session logging, KeePass
  services/                    # 20+ service modules
    window-router.ts            # Routes IPC to correct window (detach/reattach)
    ssh-manager.ts              # SSH2: connect, shell, forwarding, host keys, MFA
    expect-engine.ts            # Regex state machine with enabled/disabled rules
    variable-engine.ts          # <IP>, <ENV:>, <GV:>, <ASK:>, <CMD:>
    credential-store.ts         # safeStorage + base64 fallback
    cloud-discovery.ts          # AWS/GCP/Azure/Docker/K8s/Podman
    password-manager.ts         # 1Password/Bitwarden/Vault/AWS SM/Azure KV
    snippet-manager.ts          # 20+ DevOps snippets
    script-engine.ts            # JavaScript scripts (replaces Ásbrú Perl)
    ai-assistant.ts             # Ollama + fallback suggestion library
    font-scanner.ts             # fc-list monospace fonts
    session-recorder.ts         # asciicast v2 recording
    audit-log.ts                # JSON Lines, 30-day rotation
    ssh-config-parser.ts        # ~/.ssh/config parser
    ansible-parser.ts           # INI + YAML inventory
    terraform-parser.ts         # .tfstate parser
    ssh-ca.ts                   # Vault API + local CA signing
    connection-health.ts        # Ping latency monitor
    config-sync.ts              # Git-based config sync

src/renderer/                  # React app
  stores/
    sessions.store.ts           # Tabs, panes, broadcast, detaching
    connections.store.ts        # Connections, groups, favorites, recents
    preferences.store.ts        # Terminal prefs, color scheme, paste warning
    workspace.store.ts          # Multiple workspaces
  hooks/
    useTerminal.ts              # PTY/SSH dual mode, zoom, paste warning, broadcast,
                                # auto-reconnect, error detection, per-tab styles
  components/
    layout/                     # AppShell, Sidebar, TabBar, StatusBar, CommandPalette, WorkspaceSelector
    terminal/                   # XTerminal, TerminalPane, TerminalContextMenu, DetachedTerminal,
                                # PasteWarning, SftpPanel, AIAssistant, TmuxManager
    connections/                # ConnectionTree (with context menus), ConnectionForm (full editor),
                                # QuickConnect, ConnectionStats, SshOptionsPanel
    cluster/                    # ClusterManagerUI, PCCBar
    automation/                 # ExpectEditor, MacroEditor, VariableManager, ScriptEditor, VariableWizard
    settings/                   # Preferences (7 tabs), KeyBindings, ColorSchemeSelector, PluginManager, ConfigSync
    ui/                         # 12 shadcn/ui primitives (Button, Input, Dialog, Select, etc.)
  lib/
    color-schemes.ts            # 50+ terminal color schemes
    dangerous-commands.ts       # 15+ patterns (rm -rf, chmod 777, etc.)
    error-patterns.ts           # 16 terminal error patterns
    script-runner.ts            # Sandboxed JS execution with ctx API
    zmodem-handler.ts           # Zmodem detection
    pcc-highlight.ts            # PCC syntax highlighting
    command-suggestions.ts      # Fallback AI suggestions
```

## Design System: Spectral Command

Full spec in `docs/reference/DESIGN.md`. Key rules:
- **No 1px borders** — use tonal background shifts (#131316 → #1b1b1e → #2a2a2d → #39393c)
- **Ghost borders**: `rgba(199,196,215,0.15)` only on input fields
- **Spectral thread**: rainbow gradient focus indicator on inputs
- **0.25rem rounding** everywhere
- **JetBrains Mono** for terminal/code, **Inter** for UI
- `on_surface_variant` (#c7c4d7) for labels

## Reference Docs

- `docs/prompt.md` — Original architectural spec (Ásbrú successor vision)
- `docs/IMPLEMENTATION_PLAN.md` — 107-feature plan (Tabby + Ásbrú + DevOps analysis)
- `docs/STATUS.md` — Feature-by-feature implementation status
- `docs/reference/DESIGN.md` — Spectral Command design system
- `docs/stitch-design-brief.md` — Design brief for Google Stitch
