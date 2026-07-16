## Context

`SftpPanel.tsx` renders a flat list of `SftpEntry` rows (icon, name, size,
download/rename/delete actions). It loads entries via `sftp.listDirectory`,
filters `.`/`..`, and sorts folders-first by name. The renderer's local
`SftpEntry` interface must carry `mtime` (the backend `SftpFileEntry` already
returns it). The panel lives in `AppShell.tsx` inside a `shrink-0` container with
`style={{ width: 320, resize: 'horizontal', direction: 'rtl', minWidth: 200,
maxWidth: 600 }}` — a CSS corner-resize that is hard to find.

## Goals / Non-Goals

**Goals:**
- Show a modified date per file and let the user sort by name/size/date, asc/desc.
- Keep folders-first as a default, toggleable grouping.
- Make the panel obviously and comfortably resizable, wider than today, with the
  width remembered for the session.

**Non-Goals:**
- No backend/IPC/preload changes (data already present).
- No new columns beyond Modified (no permissions/owner/group for now).
- No column drag-to-reorder or per-column width; no dual-pane.

## Decisions

- **Date column**: add `mtime?: number` to the renderer `SftpEntry`; format with
  a small helper — recent (< 1 year) as `MMM D HH:mm`, older as `MMM D YYYY`
  (ls-style), using the browser locale. Tooltip shows the full timestamp.
- **Sorting**: local component state `{ key: 'name' | 'size' | 'date'; dir: 'asc'
  | 'desc'; foldersFirst: boolean }`. Clickable column headers cycle the sort key
  and toggle direction; a small "folders first" toggle. Default = name/asc/
  foldersFirst. Directories have size 0 and are sorted among themselves by the
  active key when foldersFirst is on.
- **Resize**: replace the `resize: horizontal` + rtl hack with an explicit drag
  handle on the panel's left border (pointer events computing width from the
  drag delta), `minWidth` ~240, `maxWidth` raised to ~900 (or a fraction of the
  window). Persist the width in the preferences store (or localStorage) so it
  survives reopening the panel within the session.
- **Layout**: switch the row from an ad-hoc flex to a grid (name flex-1 with
  truncation + title, size fixed, date fixed, actions) so columns align and the
  header is clickable.

## Risks / Trade-offs

- Widening `maxWidth` eats terminal space on small windows — clamp to a fraction
  of the available width.
- A custom drag handle must not fight the terminal's own resize; scope pointer
  capture to the handle only.
- Date formatting is locale-dependent; keep it compact to avoid wrapping.
