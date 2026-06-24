# Bifrost — Project Context

> Living project context for OpenSpec. New changes should read this plus the relevant
> capability spec under `openspec/specs/` before proposing requirements.

## What Bifrost Is

Bifrost is a modern connection manager for Linux (Windows compat in progress), the
spiritual successor to Ásbrú Connection Manager. It targets sysadmins, DevOps, and
DevSecOps managing dozens to hundreds of remote servers. Current release: **v0.2.0**.
License: GPL-3.0. Repo: https://gitlab.com/jimmy.rivas/bifrost.

## Architecture (three processes + standalone MCP server)

1. **Main** (`src/main/`) — owns all native resources (SQLite, PTY, SSH sockets, OS
   keychain, system tray). Registers ~26 IPC handler modules (`ipc/`), domain logic in
   `services/`, Drizzle schema in `db/` (15 tables).
2. **Preload** (`src/preload/`) — typed IPC bridge, built to `out/preload/index.mjs`.
3. **Renderer** (`src/renderer/`) — React 18 + TS strict, Zustand stores, xterm.js. No
   direct Node access; everything via IPC.
4. **MCP server** (`src/mcp/`) — standalone Node process exposing Bifrost to AI agents.
   Reads the DB read-only via `sql.js` (WASM). Must **not** import `electron`.

## Tech Stack

electron-vite 5.x / Electron 34.x / Vite 6 · React 18 + TypeScript strict · Tailwind v4
+ shadcn/ui (manual) · Zustand 5.x (renderer only, IPC on-demand — no @zubridge) ·
`@xterm/xterm` 6.x + addons · `ssh2` 1.17+ · `node-pty` 1.1+ · `better-sqlite3` +
Drizzle ORM · pnpm 10.x · Vitest + Playwright.

## Conventions That Constrain New Work

- **Zustand**: never subscribe to arrays/objects in selectors (React #185 loop). Use
  `getState()` in callbacks; individual field selectors only.
- **Preload path** is `.mjs`, not `.js`.
- **Do not override PostCSS** in `electron.vite.config.ts` (breaks Tailwind v4).
- **`safeStorage`** may be unavailable on Linux without a keyring; `credential-store.ts`
  falls back to base64 with a warning. Never assume encrypted storage.
- **Terminal persistence**: all tabs stay mounted; show/hide via `visibility`+`z-index`,
  never conditional rendering (destroys the PTY).
- **MCP server** uses `sql.js` (not `better-sqlite3`), `module: ES2022` +
  `moduleResolution: bundler`, and cannot decrypt Bifrost credentials by design.
- **Design system "Spectral Command"**: no 1px borders (tonal background shifts), ghost
  borders only on inputs, 0.25rem rounding, JetBrains Mono for terminal / Inter for UI.
  Full spec in `docs/reference/DESIGN.md`.

## How These Specs Were Captured

These specs baseline the **implemented** behavior as of v0.2.0 (commit `9238c5d`),
grounded in `docs/STATUS.md` (~107-feature tracker, 91% done) and the source tree.
Features marked pending in STATUS.md (Explode/Combine tabs, Zmodem, plugin system UI,
FTP/3270/VNC/WebDAV protocols, PCC auto-save/highlighting) are intentionally **out of
scope** of these specs until implemented.

## Reference Docs

`docs/STATUS.md` (feature status) · `docs/IMPLEMENTATION_PLAN.md` (107-feature plan) ·
`docs/reference/DESIGN.md` (design system) · `docs/MCP_ARCHITECTURE.md` ·
`docs/PLUGIN_API.md` · `docs/SECURITY_AUDIT.md` · `docs/WINDOWS_COMPAT_PLAN.md` ·
`CLAUDE.md` (authoritative gotchas).
