## Context

Current state (from a full survey):
- `sftp-manager.ts`: `openSftp`, `listDirectory`, `readFile(remote,local)` =
  `fastGet`, `writeFile(local,remote)` = `fastPut`, `mkdir`, `delete`
  (non-recursive), `rename`, `stat`, `readFileToString`/`readMarkdown`. No
  recursive/batch/zip.
- `SftpPanel.tsx`: opens at `~` (`loadDirectory('.')`), flat list with
  double-click descend + go-up + path input, per-row download/rename/delete,
  multi-file upload (files only). No multi-select, no breadcrumb/tree.
- Live shell cwd lives in `useTerminal`'s `remoteCwdRef` (OSC 7 handler), private
  to the hook — not in a store, not returned.
- Markdown viewer (`markdownViewer.store`) holds `sessionId` + `path` and fetches
  via `sftp.readMarkdown`; viewer is copy-only.
- No download history anywhere; `showSaveDialog` returns the local path but it's
  discarded after `readFile`.

## Goals / Non-Goals

**Goals:**
- Open SFTP where the shell is; navigate anywhere via breadcrumb/tree.
- Download a viewed `.md` in one click.
- Remember where every download went.
- Move many files/dirs at once, both directions, recursively.

**Non-Goals:**
- chmod/permissions editing, dual-pane sync, resume/partial transfers.
- A background transfer queue/manager UI (a simple progress toast is enough).
- Feeding download history into the DB/Activity view (kept renderer-side for now).

## Decisions

- **Shell cwd exposure**: publish the live remote cwd to the `sessions` store
  (e.g. `terminalCwds[terminalId]`) from `useTerminal`'s OSC 7 handler, since the
  store is the existing cross-component channel and avoids a new context. The
  panel reads the active pane's cwd on open and via a "sync to shell dir" button.
  Fallback order: store cwd → home (`.`).
- **Navigation**: render the `currentPath` as a clickable **breadcrumb** (each
  segment navigates); keep the path input and go-up. Add an **expandable tree**
  in a left rail of the panel driven by lazy `listDirectory` per node. `/` is
  always reachable (breadcrumb root + tree root).
- **Recursive/batch download** (main): a new `downloadEntries(sftpId, remotePaths[],
  destDir)` that, per entry, `fastGet`s a file or walks a directory
  (`listDirectory` recursively, `mkdir` locally, `fastGet` each file), preserving
  the tree under `destDir`. Returns the list of written local paths + byte totals
  for history. Baseline is **download-to-folder** (no native dep, most reliable);
  an **optional zip** can bundle the result via a pure-JS archiver only if we add
  one — deferred unless requested. Emit periodic progress events for a toast.
- **Recursive upload** (main): `uploadEntries(sftpId, localPaths[], destDir)` that
  `fastPut`s files and walks local directories (`mkdir` remote + recurse). The
  renderer gets directories via a directory-picker (`openDirectory`).
- **Markdown download**: `MarkdownViewer` gets a Download button that calls
  `showSaveDialog(basename)` then `sftp.readFile(sessionId-derived sftpId, path,
  local)`. The viewer only has `sessionId` (SSH), so either reuse an open sftpId
  for that session or open a short-lived one (mirror `readMarkdown` opening its
  own channel). Record it in history.
- **Download history**: a localStorage-backed store `downloads.store` mirroring
  `favorites`/`recents` — array of `{ id, name, remotePath, localPath, size,
  host, timestamp }`, capped (e.g. 200). A small history panel (reachable from
  the SFTP panel header and/or the Capture/Activity area) lists them with
  **Reveal** (`system:revealPath`) and **Open** (`system:openPath`) — both IPC
  already exist.
- **Multi-select**: add checkbox selection state to `SftpPanel` rows (reuse the
  pattern from the Import/Discovery tables), with a toolbar action
  "Download selected" (→ folder picker → `downloadEntries`).

## Risks / Trade-offs

- Recursive transfers can be large/slow — show progress and allow the panel to
  stay responsive; cap concurrency inside the manager.
- Publishing cwd to the store must use a primitive/keyed value to avoid the
  Zustand array-selector re-render trap.
- Directory upload needs an OS directory picker (`showOpenDialog` with
  `openDirectory`); confirm Electron dialog properties.
- Zip would add a dependency + native rebuild concerns; default to folder
  download and treat zip as an opt-in follow-up.
