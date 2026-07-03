# Tasks — Restore Session Tabs

## 1. Persist the open-tabs manifest

- [x] 1.1 Implemented persistence in `lib/session-manifest.ts` (plain localStorage, read-once / write-after-decision) instead of Zustand `persist` on `sessions.store` — avoids the live/persisted shape mismatch and the empty-manifest-on-launch clobber (see design apply-time revision)
- [x] 1.2 `isRestorable(tab, localMuxEnabled)`: connection tabs always; local tabs only when the local multiplexer is enabled (`preferences.localMultiplexer.preferred !== 'none'`)
- [x] 1.3 `deriveManifest` / `toManifestTab` serialize only restorable tabs and non-ephemeral fields (`connectionId`, `title`, `lockTitle`, `terminalStyle`, `shell`, `shellArgs`); drop `id`, `rootPane`/`terminalId`, `isActive`, `aiDetected`, `aiCwd`
- [x] 1.4 Snapshot derived from `getState()` in a vanilla `useSessionsStore.subscribe` (App.tsx), not a React `s.tabs` selector (project Zustand rule)

## 2. Launch-time restore flow

- [x] 2.1 In `App.tsx`, read the manifest once via `useState(() => readManifest())` before any `createTab`; show the prompt when it has restorable tabs instead of auto-creating a tab
- [x] 2.2 On Restore: iterate manifest tabs; for connection tabs, `connections.get(connectionId)` and **skip silently** if missing; recreate via `createTab(...)` (existing connect path → mux reattach via probe). Restore `lockTitle`
- [x] 2.3 Multiplexed local tabs recreate as local tabs (`shell`/`shellArgs`); `useTerminal`'s local path re-reads `preferences.localMultiplexer` and reattaches via its probe — no per-tab mux info needed in the manifest
- [x] 2.4 Restore only the root pane (manifest stores no split layout); activate the previously-active tab via `activeIndex`, fallback to default
- [x] 2.5 On Start fresh: `createTab()` and begin persisting (overwrites the manifest with the fresh session)
- [x] 2.6 Multiplexed-local restore tolerates a gone mux session: `useTerminal`'s existing probe path handles "no live session" (picker / fresh session), unchanged by this work
- [x] 2.7 Guard all restore/persist logic to the main window — detached windows (`?detach` / `?aiDetach`) share localStorage and must not read/write the manifest

## 3. Restore prompt UI

- [x] 3.1 Added `RestoreSessionPrompt` (Spectral Command modal): "Restore previous session?" with Restore / Start fresh and the tab count
- [x] 3.2 Shown once at launch only when the manifest has ≥1 restorable tab (`showRestorePrompt`)

## 4. Verification

- [x] 4.1 `pnpm typecheck` clean; `pnpm lint` clean on changed files (no new issues)
- [x] 4.2 Unit tests for `isRestorable`, `toManifestTab`, `deriveManifest` (8 cases: connection kept, non-mux local dropped, mux local kept, ephemeral fields stripped, activeIndex against filtered list); full suite 243 passing
- [ ] 4.3 Manual: open several SSH tabs + one multiplexed local + one plain local, quit, relaunch → prompt offers the right count (plain local excluded); Restore reopens and connects each, mux tabs reattach with scrollback; Start fresh opens a single empty tab
- [ ] 4.4 Manual: delete a connection between sessions → its tab is skipped silently and the rest restore
- [ ] 4.5 Manual (production build): confirm no Zustand object-selector regressions — navigates without React #185
