## 1. Remote alias store (main)

- [x] 1.1 Add `alias?: string` to `MultiplexerSession` in `src/main/services/multiplexer/types.ts`.
- [x] 1.2 Create `src/main/services/multiplexer/alias-store.ts`: `readAliases(exec)`, `writeAlias(exec, kind, target, alias)`, `pruneAliases(exec, kind, liveTargets)` operating on `~/.config/bifrost/session-aliases.json` shaped `{ [kind]: { [target]: alias } }`, using the module's `Executor` type. Read via `cat … 2>/dev/null` (empty/`{}` on failure or invalid JSON); write via `mkdir -p` + atomic `> tmp && mv`. Never throw to the caller.
- [x] 1.3 In `index.ts` `probe()`: after a successful backend probe, read aliases, attach `alias` to each returned session, and prune entries whose target is not in the live list. Skip entirely (no read/prune) when the probe was unsuccessful/unavailable.
- [x] 1.4 In `index.ts`: add `setAlias(transport, kind, target, alias)` that resolves the executor and calls `writeAlias`.

## 2. IPC + preload

- [x] 2.1 Register `multiplexer:setAlias` in `src/main/ipc/multiplexer.ipc.ts` delegating to `setAlias()`.
- [x] 2.2 Expose `multiplexer.setAlias(transport, kind, target, alias)` in `src/preload/index.ts` and its type declaration; confirm `probe` response already carries `alias` per session (no shape change needed beyond the type).

## 3. Tab ↔ session binding (renderer store)

- [x] 3.1 Add `muxBinding?: { kind: MultiplexerKind; target: string }` to `Tab` in `src/renderer/src/stores/sessions.store.ts` and a `setTabMux(tabId, binding)` action.
- [x] 3.2 In `useTerminal.resolveMultiplexerCmd`, call `setTabMux` with the resolved `{ kind, target }` for both attach and create paths (dtach target = the `.sock` path it already builds).

## 4. Write on rename

- [x] 4.1 On tab rename (in `TabBar.commitEdit` or a store subscription), when the tab has a `muxBinding`, call `window.bifrost.multiplexer.setAlias` with the tab's transport (derived from its SSH session id) and the new title. Fire-and-forget; log on failure, never block the local rename.

## 5. Read + apply on attach

- [x] 5.1 In `MultiplexerPicker.tsx`, display each session's `alias` (when present) alongside its name/target.
- [x] 5.2 In `useTerminal`, when attaching or auto-attaching to a session that has an `alias`, set the tab title to it and lock it (`renameTab` + `toggleLockTitle`), covering the cross-device / no-local-manifest case.

## 6. Tests

- [x] 6.1 Unit-test `alias-store.ts` read/write/prune against a fake executor: missing file → `{}`, invalid JSON → `{}`, write creates+updates the entry, prune drops non-live targets only.
- [x] 6.2 Unit-test `index.ts` `probe()` alias merge + prune-only-on-success (fake executor + fake backend).

## 7. Docs + verification

- [x] 7.1 Update the user guide (EN `docs/guide/` + ES `docs/guide/es/`, session-multiplexing chapter) to explain remote-persisted tab names, kept in sync.
- [x] 7.2 `pnpm typecheck` + `pnpm lint` + `pnpm test` green; `openspec validate remote-session-aliases --strict` passes.
- [x] 7.3 Build the AppImage (`scripts/build-appimage-docker.sh`) for the user's manual GUI verification: rename a tmux-backed tab, restart Bifrost (and/or attach from a second config), confirm the alias returns; repeat spot-check with dtach.
