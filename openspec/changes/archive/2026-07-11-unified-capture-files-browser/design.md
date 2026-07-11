## Context

Phase 1 of `close-feature-wiring-gaps` shipped working session capture:
recordings (`.cast`, listed/managed by `RecordingsManager.tsx` via the existing
`ssh:listRecordings`/`ssh:deleteRecording` IPC) and session logs (`.log`,
written by `session-logger.ts` under `userData/session-logs/`, with only
`system:getLogDir` exposed). Preferences → Terminal → Session Capture currently
renders two folder paths with "Open" buttons; logs have no in-app file listing.
The user expects that section to list the files of both kinds with the same
per-file affordances the recordings browser has.

## Goals / Non-Goals

**Goals:**
- One browser component for both capture kinds, used from Preferences and the
  terminal Capture menu — no duplicated list UIs.
- Session logs become first-class: listable, openable, revealable, deletable.
- Active captures are visible and protected (no deleting a file mid-write).

**Non-Goals:**
- No in-app playback of recordings (asciinema player embed is a separate,
  dependency-adding change).
- No log-content viewer/search inside the app (OS default handler opens the
  file).
- No retention policies/auto-cleanup (future change if needed).
- No renaming/moving of capture files.

## Decisions

- **Generalize `RecordingsManager` → `CaptureFilesBrowser`** with a
  `defaultTab: 'recordings' | 'logs'` prop, rather than a second manager
  component. The row layout, flash messages, and Spectral styling are already
  right; only the data source and per-row actions differ per tab.
  *Alternative considered*: separate `LogsManager` clone — rejected, diverges
  visually and doubles maintenance.
- **Embed vs. modal in Preferences**: Preferences opens the browser as the
  same modal (button per kind: "Browse recordings…", "Browse logs…"), keeping
  the current folder-path rows for context. Embedding the full list inline in
  the settings page would duplicate modal behavior and cramp the layout.
  *Alternative considered*: inline accordion lists — rejected for layout and
  scroll complexity inside the settings pane.
- **New IPC lives on the `system` namespace** (`system:listSessionLogs`,
  `system:deleteSessionLog`), implemented by `session-logger.ts`
  (`listLogs()`, `deleteLog(path)`), mirroring how recordings IPC lives next
  to its service. `listLogs()` reads the directory with `readdirSync` +
  `statSync` (Electron's Node lacks `fs.globSync` — Lessons Learned) and marks
  a file active when its path belongs to an open write stream.
- **Delete safety**: `deleteLog` resolves the requested path and requires it
  to be inside `getLogDir()` (path-prefix check after `path.resolve`) and not
  active. Recordings deletion keeps using the existing `ssh:deleteRecording`.
- **Open file** uses the already-shipped `system:openPath`; reveal uses
  `system:revealPath`. No new shell surface.
- **Capture menu**: "Recordings…" opens the shared browser on the recordings
  tab; add "Session Logs…" beneath it opening the logs tab (both render the
  one `CaptureFilesBrowser` instance in `TerminalContextMenu`).

## Risks / Trade-offs

- [Active-flag accuracy] The active check depends on `session-logger`'s open
  stream map; a crashed session could leave a stale stream entry → mitigation:
  the map is already cleaned on stream error and on session close (Phase 1
  auto-finalize), and delete failures surface a toast rather than throwing.
- [Large directories] Hundreds of logs listed synchronously → acceptable at
  this scale (same pattern as `listRecordings`); listing runs on demand, not
  on a timer.
- [Filename collisions with non-log files] A user dropping arbitrary files in
  the folder would list them → filter to `*.log` (and `*.cast` on the other
  side), matching each writer's naming.
