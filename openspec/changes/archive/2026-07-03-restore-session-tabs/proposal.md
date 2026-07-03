# Restore Session Tabs

## Why

When Bifrost closes, every open tab is lost: `sessions.store` is an in-memory Zustand
store with no persistence, and on `before-quit` the main process tears down all live
sessions. On next launch the app always starts with a single empty local tab. Users who
had a dozen connections open must reopen each one by hand. We want to offer to restore the
previous session's tabs.

## What Changes

- **Persist a session manifest** of the open tabs (connection id, title, terminal style,
  and — for local tabs — multiplexer info), updated as tabs change. Ephemeral fields
  (live terminal id, active flag) are not persisted.
- **Prompt on launch** when a restorable manifest exists: "Restore N tabs from your
  previous session?" → Restore / Start fresh. No silent auto-restore.
- **On restore, recreate each tab and connect it** immediately (same path as a normal
  connect; per-connection auth prompts may follow). SSH connection tabs that had a live
  multiplexer session reattach automatically via the existing connect-time probe.
- **Restore policy**: SSH connection tabs are always restorable; local tabs are restored
  **only if they were multiplexed** (all multiplexed local tabs reopen and reattach);
  non-multiplexed local tabs are not persisted.
- **Phase 1 scope**: restore the tab's root pane only (no split-pane layout); a tab whose
  connection was deleted from the DB since last session is silently skipped.

No new external dependency. No DB schema change (the manifest is UI state, persisted like
preferences).

## Capabilities

### New Capabilities

- `session-restore` — persisting the set of open tabs across app restarts and restoring
  them (via a launch prompt) by recreating and reconnecting each tab. Distinct from
  `terminal-ui`'s in-session "Tab and Pane Persistence" (keeping tabs mounted while the app
  runs) and from `session-multiplexing` (the mux backends it reattaches through).

### Modified Capabilities

- None.

## Impact

- **Renderer**: `src/renderer/src/stores/sessions.store.ts` (add `persist` with a
  `partialize` that keeps only restorable tabs + non-ephemeral fields). `App.tsx` (launch:
  detect manifest, show prompt, recreate+connect tabs instead of the default empty tab). A
  small restore-prompt UI component. Reuses the existing `useTerminal` connect/probe path
  for mux reattach — no change to the multiplexer subsystem.
- **No main-process change** required for phase 1 (manifest lives in renderer-persisted
  state, like `preferences.store`).
