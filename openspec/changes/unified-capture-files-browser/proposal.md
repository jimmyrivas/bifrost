## Why

Session capture now works end-to-end (recordings + session logs, Phase 1 of
`close-feature-wiring-gaps`), but the files it produces are only half-manageable:
the Capture menu's "Recordings…" browser covers `.cast` files only, and the
Preferences → Session Capture section shows two bare folder paths with "Open"
buttons — session logs have no in-app listing at all. The user expects that
section to list the actual files of BOTH kinds, with the same per-file actions
the recordings browser already offers.

## What Changes

- Extend the existing `RecordingsManager` modal into a **unified capture-files
  browser** with two tabs: **Recordings** (`.cast`) and **Session Logs** (`.log`).
- Per-file actions:
  - Recordings (unchanged): copy `asciinema play` command, reveal in file
    manager, delete.
  - Session logs (new): open the file (OS default editor/viewer), reveal in
    file manager, delete.
- Preferences → Terminal → **Session Capture** embeds/opens the same browser
  (replacing the two bare folder rows with the file listings + a per-tab
  "Open folder" action, keeping the paths visible).
- The terminal Capture menu entry ("Recordings…") opens the same shared
  browser on its Recordings tab; a new "Session Logs…" entry (or the same
  dialog's tab) exposes logs from the menu too.
- New main/preload surface to make logs listable: `system:listSessionLogs`
  and `system:deleteSessionLog` (recordings listing/deletion already exists).
  Listing must not touch files that are actively being written (an active log
  is shown as "logging…" and cannot be deleted while active).

## Capabilities

### New Capabilities

<!-- none — this extends session capture, which session-observability already covers -->

### Modified Capabilities

- `session-observability`: gains requirements for (1) an in-app browser over
  captured session files covering both recordings and session logs with
  per-file actions, reachable from Preferences and the terminal Capture menu;
  (2) listing/deleting session-log files via IPC with active-log protection.

## Impact

- Renderer: `RecordingsManager.tsx` → generalized tabbed `CaptureFilesBrowser`
  (same Spectral Command visuals, no new dependencies);
  `Preferences.tsx` (Session Capture section swaps folder rows for the browser);
  `TerminalContextMenu.tsx` (Capture submenu wiring to the shared browser).
- Preload: additive `system.listSessionLogs` / `system.deleteSessionLog` typings + bridges.
- Main: `session-logger.ts` gains `listLogs()` / `deleteLog()` (guarding active
  streams); `system.ipc.ts` registers the two handlers.
- No schema/DB changes; no new npm dependencies.
