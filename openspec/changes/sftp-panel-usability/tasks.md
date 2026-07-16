## 1. Data plumbing

- [ ] 1.1 Add `mtime?: number` (and confirm `size?`) to the renderer `SftpEntry`
  interface in `SftpPanel.tsx`; map it from the `sftp.listDirectory` result.
- [ ] 1.2 Add a compact date formatter (recent → `MMM D HH:mm`, older → `MMM D
  YYYY`, browser locale) — reuse an existing helper if present, else a small
  local one; full timestamp as the row `title`.

## 2. Columns, sorting & grouping

- [ ] 2.1 Convert each row to an aligned grid: name (flex, truncate + title),
  size, modified, actions. Add a clickable header row for Name / Size / Modified.
- [ ] 2.2 Add sort state `{ key: 'name'|'size'|'date'; dir: 'asc'|'desc';
  foldersFirst: boolean }` (default name/asc/foldersFirst). Header click sets the
  key / toggles direction; show the active key + direction arrow.
- [ ] 2.3 Implement the comparator: when `foldersFirst`, directories cluster
  first, then both groups ordered by the active key/dir; otherwise a single
  ordering. Add a small "folders first" toggle.

## 3. Panel resize

- [ ] 3.1 Replace the `resize: horizontal` + `direction: rtl` hack in
  `AppShell.tsx` with an explicit drag handle on the panel's left border
  (pointer events compute width from the drag delta).
- [ ] 3.2 Raise the max width (clamped to a fraction of the window) and keep a
  sensible min; persist the chosen width for the session (preferences store or
  localStorage) so reopening the panel restores it.

## 4. Verify & docs

- [ ] 4.1 typecheck + lint(src) clean; manual GUI check: date shows, each sort
  key + direction works, folders-first toggles, drag-resize widens/persists.
- [ ] 4.2 Update the user guide (`docs/guide/06-sftp-files.md` EN + `es/`) to
  mention the date column, sorting, and resizable panel.
