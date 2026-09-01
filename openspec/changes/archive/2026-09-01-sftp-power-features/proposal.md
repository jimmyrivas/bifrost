## Why

The SFTP panel works for one-file, one-directory operations but falls short of a
real file-transfer workflow:

- It always opens in the SSH **home** directory, even when your shell is deep in
  a project tree — so you re-navigate by hand every time.
- You can descend/ascend and type a path, but there's no breadcrumb or tree, and
  reaching `/` or a sibling tree is clumsy.
- A remote `.md` opened in the Markdown viewer can only be **copied**, not saved
  to disk, even though the panel could download it.
- After a download there's **no record** of where the file landed — you have to
  remember the Save-As location.
- You can only download **one file at a time** and can't download a directory at
  all; uploads are single files only. No multi-select, no recursive transfer.

The live shell working directory is already tracked (OSC 7 → `remoteCwdRef` in
`useTerminal`) and the download plumbing exists — this change wires those
together and fills the batch/tree/history gaps.

## What Changes

- **Open in the shell's cwd**: expose the terminal's live remote cwd so the SFTP
  panel opens there (falling back to home), with a one-click "sync to shell
  directory" control.
- **Tree navigation**: a clickable breadcrumb of the current path plus reliable
  navigation to any absolute path including `/` and parents; an expandable
  directory tree in the panel.
- **Download from the Markdown viewer**: a Download button on the viewer (and on
  the clickable `.md` link affordance) that saves the file over SFTP.
- **Download history**: persist each download (name, remote path, local path,
  size, timestamp) and show it in a small history view with reveal/open actions.
- **Multi-select + recursive transfer**: select multiple remote files and
  directories and download them together (recursive directory download into a
  chosen folder, preserving structure; optional zip); upload multiple files and
  whole directories recursively.
- **Rename**: already implemented — verified, no behavior change.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `file-transfer`: the SFTP browser gains shell-cwd sync, breadcrumb/tree
  navigation, Markdown-viewer download, a persistent download history, and
  multi-select recursive download/upload of files and directories.

## Impact

- **Main**: `sftp-manager.ts` + `sftp.ipc.ts` — new recursive/batch download
  (walk a remote tree, `fastGet` each file, recreate dirs locally) and recursive
  upload; expose the final local paths. No native zip dependency is assumed;
  "download to a folder" is the baseline, zip is optional.
- **Preload**: additive `sftp.*` bindings for the new batch/recursive channels.
- **Renderer**:
  - `useTerminal.ts` — expose the live remote cwd (store or returned value) so
    the panel can read it (today `remoteCwdRef` is private to the hook).
  - `SftpPanel.tsx` — breadcrumb + tree, multi-select, sync-to-cwd, wire batch
    transfer; `AppShell.tsx` opens the panel at the shell cwd.
  - `MarkdownViewer.tsx` — Download button (store already holds sessionId+path).
  - New download-history store (localStorage-backed, mirroring favorites/recents)
    + a small history UI.
- No DB schema change (history is renderer-side; may revisit if it should feed
  the Activity view).
- Docs: `docs/guide/06-sftp-files.md` (EN + `es/`).
