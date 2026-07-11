## 1. Main process — session-log listing/deletion

- [x] 1.1 `session-logger.ts`: add `listLogs(): LogFileInfo[]` (readdir + stat over `getLogDir()`, filter `*.log`, fields: name, path, size, mtime, `active` from the open-streams map) and `deleteLog(path: string): boolean` (resolve + require prefix `getLogDir()`, refuse active logs, unlink).
- [x] 1.2 `system.ipc.ts`: register `system:listSessionLogs` and `system:deleteSessionLog` over the two new service methods.
- [x] 1.3 Preload: add `system.listSessionLogs()` / `system.deleteSessionLog(path)` typings + bridges (additive).

## 2. Renderer — shared browser

- [x] 2.1 Generalize `RecordingsManager.tsx` → `CaptureFilesBrowser.tsx` with tabs (Recordings | Session Logs) and a `defaultTab` prop; recordings tab keeps copy-play-command/reveal/delete; logs tab: open (`system.openPath`), reveal, delete (disabled + "logging…" badge when active); per-tab "Open folder"; keep Spectral styling and the empty-state hints. — RecordingsManager.tsx removed.
- [x] 2.2 `TerminalContextMenu.tsx`: Capture ▸ "Recordings…" opens the browser on the recordings tab; add "Session Logs…" opening the logs tab (single browser instance + state).
- [x] 2.3 `Preferences.tsx` (Session Capture): keep the folder-path rows, replace/augment the "Open" buttons with "Browse recordings…" / "Browse logs…" buttons opening the shared browser on the matching tab. — one "Browse…" button per row.

## 3. Verification & docs

- [x] 3.1 Unit test for `deleteLog` path-confinement and active-log refusal (vitest, hermetic temp dir). — 5 new tests (listLogs ×2, deleteLog ×3), 321 total.
- [x] 3.2 `pnpm typecheck` + `pnpm lint` + `pnpm test` green; build portable AppImage (`scripts/build-appimage-docker.sh`) for user GUI verification.
- [x] 3.3 Update `docs/guide/09-observability-security.md` (EN/ES) — browser covers logs too; adjust Preferences Session Capture description (also ch03 Capture menu mentions EN/ES); sync delta spec to main specs after approval (`openspec sync` at archive time).
