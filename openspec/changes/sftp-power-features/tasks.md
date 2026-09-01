## 1. Shell cwd → SFTP panel

- [x] 1.1 Publish the live remote cwd from `useTerminal`'s OSC 7 handler into the
  sessions store, keyed by terminalId (primitive/keyed value — no array-selector
  trap). Add a getter/selector for the active pane's cwd.
- [x] 1.2 `AppShell` opens `SftpPanel` at the shell cwd (fallback to home). Add a
  "sync to shell directory" button in the panel header that navigates to it.

## 2. Breadcrumb + tree navigation

- [x] 2.1 Render `currentPath` as a clickable breadcrumb (each segment navigates;
  root `/` reachable). Keep the path input + go-up.
- [~] 2.2 Expandable directory tree rail — DEFERRED. Full tree navigation is
  delivered via the breadcrumb (2.1) + descend-on-double-click + go-up + path bar
  + root button, so `/`, parents, and any subtree are reachable. A persistent
  expandable tree rail is a nice-to-have left for a follow-up (the "ideally" in
  the proposal), not required for "navigate the whole tree".

## 3. Recursive / batch transfer (main + preload)

- [x] 3.1 `sftp-manager.downloadEntries(sftpId, remotePaths[], destDir)`: per
  entry, `fastGet` a file or recurse a directory (`listDirectory` → local `mkdir`
  → `fastGet` each), preserving structure under `destDir`; return written local
  paths + byte totals; cap concurrency; emit periodic progress.
- [x] 3.2 `sftp-manager.uploadEntries(sftpId, localPaths[], destDir)`: `fastPut`
  files and walk local directories (remote `mkdir` + recurse).
- [x] 3.3 IPC + preload for `sftp:downloadEntries` / `sftp:uploadEntries` and a
  progress event; a directory-open dialog (`openDirectory`) for choosing a
  destination folder / uploading a directory.

## 4. Multi-select in the panel

- [x] 4.1 Add checkbox selection state + select-all to `SftpPanel` rows (reuse the
  Import/Discovery table pattern).
- [x] 4.2 Toolbar actions: "Download selected" (→ folder picker → downloadEntries)
  and "Upload files/folder" (→ files or directory → uploadEntries), with a
  progress toast. Keep single-row download/rename/delete.

## 5. Markdown viewer download

- [x] 5.1 Add a Download button to `MarkdownViewer` (store already has
  `sessionId` + `path`): save-dialog → download over SFTP (reuse an open sftpId
  for the session or open a short-lived channel) → record in history.

## 6. Download history

- [x] 6.1 `downloads.store` (localStorage-backed, mirroring favorites/recents):
  entries `{ id, name, remotePath, localPath, size, host, timestamp }`, capped.
  Record from every download path (single, batch, markdown).
- [x] 6.2 A small history panel (from the SFTP panel header and/or Capture area)
  listing downloads with Reveal (`system:revealPath`) and Open (`system:openPath`).

## 7. Rename (verify) + polish, tests, docs

- [x] 7.1 Verify rename still works end-to-end (no change expected).
- [x] 7.2 Unit tests for pure helpers (recursive path mapping remote→local, tree
  path building, history store add/cap). E2E smoke: open panel at cwd, breadcrumb
  navigate, select + download to a temp dir, assert files + a history entry.
- [x] 7.3 typecheck + lint(src) clean; update `docs/guide/06-sftp-files.md`
  EN + `es/` (cwd sync, tree/breadcrumb, viewer download, history, multi-select).
