## Why

The SFTP file panel shows a name and a size but no **modified date**, and it
cannot be **sorted** (entries are only grouped folders-first, name-ordered).
Users comparing or auditing remote files can't see or order by recency. The
panel is also narrow (fixed 320px) and its only resize affordance is a hacky
CSS `resize: horizontal` corner grip that is hard to discover, so long
filenames are truncated with no obvious way to widen the view.

The underlying data already exists — `SftpFileEntry` carries `mtime` and `size`
through the backend and preload — so this is renderer-only polish that turns a
usable panel into a comfortable file browser.

## What Changes

- Add a **Modified** column (formatted relative/absolute date-time) to each SFTP
  row, sourced from the existing `mtime`.
- Make the columns **sortable**: by name, size, or date, ascending/descending,
  with a clickable header. Keep a **folders-first** grouping toggle (on by
  default) so directories still cluster at the top when desired.
- Replace the obscure corner-resize with a **clear, draggable left edge** on the
  panel and raise the maximum width so long filenames are readable; persist the
  chosen width for the session.

No backend, IPC, or preload changes — `mtime`/`size` are already available.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `file-transfer`: the SFTP browser gains a modified-date column, user-selectable
  sorting (name/size/date, asc/desc, folders-first toggle), and a discoverable,
  wider, persistent panel resize.

## Impact

- **Renderer only**: `src/renderer/src/components/terminal/SftpPanel.tsx`
  (date column, sort state + clickable headers, folders-first toggle) and
  `src/renderer/src/components/layout/AppShell.tsx` (panel resize container +
  width persistence).
- No changes to `sftp-manager.ts`, `sftp.ipc.ts`, or the preload `sftp` surface.
- A small date-formatting helper (reuse or add) in the renderer.
