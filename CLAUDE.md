# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bifrost is a modern connection manager for Linux (Windows compat in progress), the spiritual successor to Ásbrú Connection Manager. It targets sysadmins, DevOps, and DevSecOps managing dozens to hundreds of remote servers. Current release: **v0.2.0**. Feature coverage tracked in `docs/STATUS.md` (~107 planned features).

**License**: GPL-3.0-or-later | **Repo**: https://gitlab.com/jimmy.rivas/bifrost

## Tech Stack

- **Build**: electron-vite 5.x (alex8088), Electron 34.x, Vite 6
- **UI**: React 18 + TypeScript strict, Tailwind CSS v4, shadcn/ui (manual install)
- **State**: Zustand 5.x (renderer only, IPC on-demand — NO @zubridge)
- **Terminal**: `@xterm/xterm` 6.x + addons (webgl, fit, search, web-links)
- **SSH**: `ssh2` 1.17+ (pure JS), `node-pty` 1.1+ (needs `@electron/rebuild`)
- **Database**: `better-sqlite3` + Drizzle ORM (15 tables)
- **Package manager**: **pnpm 10.x** (pinned via `packageManager` field)
- **Testing**: Vitest unit tests in `tests/`, Playwright E2E

## Commands

```bash
pnpm dev              # Electron + Vite dev with HMR
pnpm build            # Production build (electron-vite build)
pnpm lint             # ESLint with --fix
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest unit tests (run once)
pnpm test:watch       # Vitest watch mode
pnpm test:e2e         # Playwright E2E
pnpm package          # electron-builder (deb, rpm, AppImage)
pnpm rebuild          # Rebuild native modules (better-sqlite3, node-pty) against Electron ABI

# Run a single test file
pnpm vitest run tests/services/multiplexer.test.ts
# Run a single test by name
pnpm vitest run -t "broadcast input"

# Drizzle
pnpm drizzle:generate # Generate migration from schema
pnpm drizzle:migrate  # Apply migrations

# MCP server (standalone process — see "MCP Server" below)
pnpm mcp:dev          # stdio transport (for Claude Code)
pnpm mcp:http         # HTTP transport on port 3100 (Bearer auth)
pnpm mcp:build        # Compile to out/mcp/
pnpm mcp:install      # Register MCP server in ~/.claude/settings.json
```

Run `pnpm rebuild` after `pnpm install` or any Electron upgrade so native modules match the Electron Node ABI.

## Architecture (Big Picture)

Bifrost is a **three-process** Electron app plus a **standalone MCP server**:

1. **Main process** (`src/main/`) — owns all native resources (SQLite, PTY, SSH sockets, OS keychain, system tray). Registers ~26 IPC handler modules.
2. **Preload** (`src/preload/`) — bridges IPC to renderer with a typed API. Built to `out/preload/index.mjs` (note the `.mjs`, see Lessons Learned).
3. **Renderer** (`src/renderer/`) — React UI, Zustand stores, xterm.js terminals. No direct Node access; everything goes through IPC.
4. **MCP server** (`src/mcp/`) — separate Node process exposing Bifrost to AI agents via Model Context Protocol. Reads Bifrost's DB read-only via `sql.js`. Must **not** import `electron`.

### Main process layout

- `index.ts` — App lifecycle, window-state persistence, registers every IPC module, starts auto-tunnels/MCP/audit/session loggers.
- `db/` — Drizzle schema + migration runner. Tables: `connections`, `groups`, `clusters`, `clusterMembers`, `tunnels`, `expectRules`, `macros`, `execCommands`, `globalVariables`, `connectionVariables`, `globalExpectPatterns`, `preferences`, `remoteCommands`, `sessionNotes`, `connectionTemplates`.
- `ipc/` — One module per feature domain (terminal, ssh, sftp, cluster, tunnels, discovery, multiplexer, plugins, mcp, notes, …). Each exports `register*Ipc(ipcMain)`.
- `services/` — Domain logic kept out of IPC handlers. Notable subsystems:
  - `ssh-manager.ts` — connect, shell, port forwarding, host keys, MFA
  - `multiplexer/` (`dtach.ts`, `tmux.ts`, `zellij.ts`) — local terminal session persistence
  - `jump-host/` (`chain.ts`, `mosh.ts`, `resolver.ts`, `runtime.ts`, `seal.ts`) — ProxyJump for SSH / Mosh / tunnels
  - `expect-engine.ts`, `macro-executor.ts`, `script-engine.ts` — automation
  - `variable-engine.ts` — `<IP>`, `<ENV:>`, `<GV:>`, `<ASK:>`, `<CMD:>` expansion
  - `cloud-discovery.ts` — AWS / GCP / Azure / Docker / K8s / Podman
  - `password-manager.ts` — 1Password / Bitwarden / Vault / AWS SM / Azure KV
  - `credential-store.ts` — `safeStorage` with base64 fallback (Linux without keyring)
  - `window-router.ts` — Routes IPC output to the correct `BrowserWindow` (powers detach/reattach)
  - Other: `tray-manager`, `quake-terminal`, `external-protocol`, `session-recorder` (asciicast), `audit-log` (JSON Lines), `connection-health`, `totp`, `keepass-bridge`, `plugin-manager`, `cluster-manager`

### Renderer layout

- `stores/` — `sessions.store` (tabs/panes/broadcast), `connections.store`, `preferences.store`, `workspace.store`
- `hooks/useTerminal.ts` — PTY/SSH dual mode, zoom, paste warning, broadcast, auto-reconnect, error detection, per-tab styles. Read this first when touching terminals.
- `components/` — Grouped by domain (`terminal/`, `connections/`, `cluster/`, `automation/`, `settings/`, `layout/`, `tunnels/`, `ui/`)
- `lib/` — Pure helpers: `color-schemes`, `dangerous-commands`, `error-patterns`, `script-runner` (sandboxed JS), `secret-redactor`, `shell-integration`, `multiplexer-naming`, `pcc-highlight`, `workflow-params`, `zmodem-handler`

### MCP server

Standalone process under `src/mcp/`. Architecture decisions in `docs/MCP_ARCHITECTURE.md`.

- **42 tools** across 8 modules (`tools/`): connections, ssh, terminal, sftp, cluster, tunnels, discovery, automation, observability
- **9 resources** (`resources/bifrost.resources.ts`, `bifrost://*` URIs)
- **8 prompt templates** (`prompts/bifrost.prompts.ts`)
- **Transports**: stdio (default) and Streamable HTTP with Bearer-token auth (`transport/http.ts`)
- **DB access** via `sql.js` (WASM SQLite) to dodge Electron-ABI conflicts (see Lessons Learned)
- **Security**: `security/command-filter.ts` blocks destructive ops (rm -rf /, DROP TABLE, fork bombs)
- **Skill**: `/bifrost` slash command available in Claude Code after `pnpm mcp:install`

Manual MCP config:

```json
{
  "mcpServers": {
    "bifrost": {
      "command": "npx",
      "args": ["tsx", "<path-to-bifrost>/src/mcp/index.ts"]
    }
  }
}
```

## Critical Lessons Learned

Non-obvious gotchas that have bitten this codebase. Read before changing the affected areas.

### Zustand selectors — NEVER subscribe to arrays/objects
**Problem**: `useSessionsStore((s) => s.tabs)` creates a new array reference on every store update, causing infinite re-render loops (React error #185) in production builds.
**Fix**: Use `getState()` for reads inside callbacks/effects. Use individual field selectors (`s => s.activeTabId`) not object selectors (`s => s.terminal`).
**Files**: `App.tsx`, `XTerminal.tsx`, `useTerminal.ts`

### Preload outputs `.mjs` not `.js`
electron-vite emits `out/preload/index.mjs`. The main process must reference `.mjs`:
```ts
preload: join(__dirname, '../preload/index.mjs')
```

### Do NOT override PostCSS in `electron.vite.config.ts`
Tailwind v4 uses `@tailwindcss/postcss` configured in `postcss.config.js`. Setting `css: { postcss: { plugins: [] } }` in `electron.vite.config.ts` overrides it and silently breaks every Tailwind utility.

### `safeStorage` fallback on Linux
`electron.safeStorage` may be unavailable on Linux without gnome-keyring/kwallet. `credential-store.ts` falls back to base64 with a warning. Never assume encrypted storage on Linux.

### Terminal persistence across tabs
All tabs must stay mounted in the DOM. Use `visibility: hidden` + `z-index` to show/hide — NOT conditional rendering, which destroys the PTY session.

### Detach/Reattach — PTY proxy pattern
When detaching a terminal to a separate window:
1. Mark tab as `detaching` so `useTerminal` cleanup skips `terminal.destroy()`
2. `window-router.ts` redirects IPC output to the new window owner
3. Buffer last 5000 output lines for replay on the new window
4. Pass `sessionId` via URL query params so the detached window claims ownership

### `fs.globSync` doesn't exist in Electron's Node
Electron 34 ships Node 20, which lacks `fs.globSync` (Node 22+). Use manual regex-based directory listing instead.

### Context menus via Radix UI
Radix ContextMenu works in Electron, but dispatching `contextmenu` events programmatically via CDP does **not** reliably trigger React's synthetic event handling. Test menus via real user interaction or by calling the trigger element's own handler.

### MCP server — use `sql.js`, not `better-sqlite3`
**Problem**: The MCP server runs under system Node, but `better-sqlite3` is compiled against Electron's Node ABI (NODE_MODULE_VERSION 132 vs 127). Loading it crashes with `ERR_DLOPEN_FAILED`.
**Fix**: `sql.js` (pure JS via WASM). No native bindings, works with any Node. Trade-off: whole DB loaded into memory, async init (`await initSqlJs()`). Fine for read-only access to Bifrost's ~200KB DB.
**File**: `src/mcp/db.ts`

### MCP server — ESM module resolution
**Problem**: `package.json` has `"type": "module"`. `"module": "CommonJS"` in `tsconfig.mcp.json` produces `exports is not defined` at runtime. `"module": "Node16"` requires `.js` extensions on every import.
**Fix**: `"module": "ES2022"` + `"moduleResolution": "bundler"`. Accepts extensionless imports at compile time; `tsx` resolves at runtime. Do not try to run compiled `out/mcp/*.js` with raw `node` unless you've added `.js` extensions.
**File**: `tsconfig.mcp.json`

### MCP server cannot decrypt Bifrost credentials
**Why**: `electron.safeStorage` is bound to the Electron main process keychain context. A standalone Node process has no way in.
**By design**: MCP server supports (1) SSH key-based auth (reads key files directly), (2) SSH agent forwarding, (3) explicit `password` parameter in `ssh_connect`. Do not try to `import 'electron'` from the MCP server.
**File**: `src/mcp/tools/ssh.tools.ts`

## Design System: Spectral Command

Full spec in `docs/reference/DESIGN.md`. Hard rules:

- **No 1px borders** — use tonal background shifts (`#131316 → #1b1b1e → #2a2a2d → #39393c`)
- **Ghost borders**: `rgba(199,196,215,0.15)` only on input fields
- **Spectral thread**: rainbow gradient focus indicator on inputs
- **0.25rem rounding** everywhere
- **JetBrains Mono** for terminal/code, **Inter** for UI
- `on_surface_variant` (`#c7c4d7`) for labels

## Reference Docs

- `docs/prompt.md` — Original architectural spec (Ásbrú successor vision)
- `docs/IMPLEMENTATION_PLAN.md` — 107-feature plan (Tabby + Ásbrú + DevOps analysis)
- `docs/STATUS.md` — Feature-by-feature implementation status
- `docs/COMPLETION_PLAN.md` — Remaining work toward 1.0
- `docs/reference/DESIGN.md` — Spectral Command design system
- `docs/MCP_SERVER_PLAN.md`, `docs/MCP_ARCHITECTURE.md` — MCP server design + decisions
- `docs/PLUGIN_API.md`, `docs/PLUGIN_DEV_GUIDE.md` — Plugin system (examples in `examples/`)
- `docs/SECURITY_AUDIT.md` — Security review notes
- `docs/WINDOWS_COMPAT_PLAN.md` — Cross-platform port plan
- `CHANGELOG.md` — Per-release feature/bugfix log
