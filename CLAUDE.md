# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bifrost is a modern connection manager for Linux (future cross-platform), the spiritual successor to Asbru Connection Manager. It targets sysadmins, DevOps, and DevSecOps who manage dozens/hundreds of remote servers. The key differentiators over generic modern terminals (Tabby, Electerm) are: Expect engine automation, cluster management, global/local variables with substitution, and pre/post connection macros.

**License**: GPL

## Tech Stack (Non-negotiable)

- **Build tool**: electron-vite (alex8088) — scaffolded via `npm create @quick-start/electron`
- **UI**: React 18+ with TypeScript strict mode, Vite, Tailwind CSS v4, shadcn/ui
- **State**: Zustand 5.x (renderer only, IPC on-demand to main — no @zubridge)
- **Terminal**: @xterm/xterm 6.x + addon-webgl + addon-fit + addon-search + addon-web-links
- **SSH**: ssh2 1.17+ (pure JS), node-pty 1.1+ (needs @electron/rebuild)
- **Database**: better-sqlite3 + Drizzle ORM (schema-as-code, drizzle-kit migrations)
- **Security**: electron safeStorage for credential encryption via IPC
- **i18n**: react-i18next + i18next-electron-fs-backend (es + en)
- **Split panes**: react-resizable-panels (shadcn Resizable)
- **Tree view**: shadcn community tree-view with drag-and-drop
- **Testing**: Vitest (unit) + Playwright (E2E) — tests from day one
- **Packaging**: electron-builder (deb, rpm, AppImage)
- **External protocols**: FreeRDP (xfreerdp), vncviewer, telnet via child processes

## Build & Development Commands

```bash
npm install          # Install dependencies (runs electron-rebuild postinstall)
npm run dev          # Start Electron + Vite dev server with HMR
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript strict check
npm run test         # Run Vitest unit tests
npm run test:e2e     # Run Playwright E2E tests
npm run package      # Package for distribution (electron-builder)
npx drizzle-kit generate  # Generate DB migration from schema changes
npx drizzle-kit migrate   # Apply pending migrations
```

## Project Structure (electron-vite standard)

```
src/
  main/                    # Main process (Node.js)
    index.ts               # Electron entry point
    ipc/                   # IPC handlers by domain
      connections.ipc.ts
      sessions.ipc.ts
      ssh.ipc.ts
      sftp.ipc.ts
      expect.ipc.ts
      credentials.ipc.ts
      system.ipc.ts
    services/              # Business logic
      ssh-manager.ts
      expect-engine.ts
      cluster-manager.ts
      variable-engine.ts
      credential-store.ts
      macro-executor.ts
      session-logger.ts
    db/                    # Database layer
      index.ts             # DB singleton (WAL mode, foreign keys)
      schema.ts            # Drizzle ORM schema
      drizzle/             # Generated migrations
  preload/                 # Preload scripts (sandboxed bridge)
    index.ts
  renderer/                # React app (browser context)
    index.html
    src/
      App.tsx
      main.tsx
      components/          # By feature: layout/, connections/, terminal/, cluster/, automation/, settings/, ui/
      stores/              # Zustand stores per domain
      hooks/               # useTerminal, useSSH, useSFTP, useExpect, useCluster
      lib/                 # ipc-client.ts, substitution.ts, utils.ts
      types/               # Shared TypeScript types
      locales/             # i18n: en/, es/
tests/                     # Vitest unit + Playwright E2E
```

## Architecture

Two-process Electron model with strict main/renderer separation:

**Main process** (`src/main/`): All system operations — SSH connections, filesystem, database, credential storage, Expect engine, cluster management. IPC handlers organized by domain. Drizzle ORM for type-safe database access.

**Renderer** (`src/renderer/`): React UI only. Zustand stores are local to renderer — data fetched via IPC on-demand (invoke/handle pattern), no state sync library. Custom hooks wrap IPC calls for clean component interfaces.

**IPC is typed end-to-end** — shared types between main and renderer. All SSH, FS, DB operations must go through main process IPC, never directly from renderer.

## Core Feature Domains

1. **Connection Manager** — Hierarchical tree with groups, CRUD, drag-and-drop, templates, quick connect
2. **Expect Engine** — Regex state machine over terminal stream for login automation. Global predefined patterns + per-connection custom rules. This is the heart of Bifrost.
3. **Cluster Management** — Named clusters of N connections, synchronized keyboard input, Power Cluster Controller (PCC)
4. **Variable Substitution** — `<IP>`, `<USER>`, `<ENV:name>`, `<GV:name>`, `<ASK:desc|opt1|opt2>`, `<CMD:command>`, `<field|keepass_path>`
5. **Macros** — Pre/post connection local commands, remote/local macros (global + per-connection)
6. **Networking** — Global SOCKS proxy, per-connection override, jump servers (standard + pseudo), SSH tunnels

## Development Principles

- TypeScript strict mode: no `any`, no `ts-ignore`
- TDD: unit tests (Vitest) for every new service/module, per phase
- Credentials NEVER in plaintext — always use electron safeStorage via IPC
- Components max 200 lines, small and reusable
- Keyboard navigation and ARIA labels throughout
- i18n ready from the start (Spanish + English minimum)
- Feature branches, merge to main when complete
- Dark theme default with subtle rainbow bridge gradient accents (brand identity)
- xterm.js wrapper is custom (not react-xtermjs) to avoid GPL dependency conflict

## Database

SQLite via better-sqlite3 + Drizzle ORM. Schema defined in `src/main/db/schema.ts`. Migrations generated with `drizzle-kit generate` into `src/main/db/drizzle/`. WAL mode and foreign keys enabled at initialization. 14 tables: groups, connections, expect_rules, macros, exec_commands, global_variables, connection_variables, clusters, cluster_members, connection_templates, preferences, global_expect_patterns. Full SQL schema in `docs/prompt.md`.

## Reference

Complete architectural specification: `docs/prompt.md`
