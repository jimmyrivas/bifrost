[← Guide index](README.md)

# SFTP & Files

Bifrost transfers files over the SSH connection you already have: every SSH tab can open its own SFTP panel, and images on your clipboard can be pasted straight to the server. This chapter covers what the file tooling does today — and what it deliberately does not do yet.

## Opening the SFTP panel

Right-click inside an SSH terminal and choose **Session ▸ Open SFTP**. The panel opens next to the terminal, attached to that tab's SSH session — no second login, no separate credentials. The same menu entry becomes **Close SFTP** while the panel is open.

The panel is only available on tabs backed by a saved SSH connection; local terminal tabs don't show the entry.

## Browsing remote directories

The panel starts in the remote home directory and gives you:

- A **path bar** — type any absolute path (or `~`) and press Enter to jump there.
- **Up** (↑ button) to go to the parent directory, and **Refresh** to reload the listing.
- **Double-click** a folder to enter it.
- **Name**, **Modified** date, and **Size** columns. Click a column header to sort by it; click again to reverse. The **folders-first** toggle (folder-tree icon) keeps directories grouped at the top.
- **Resize** the panel by dragging its left edge — the width is remembered while the app is open, so long filenames stay readable.

## File operations

| Operation | How | Notes |
|---|---|---|
| Upload | Toolbar **Upload file** button | Native file picker, multi-select; files land in the current remote directory |
| Download | **Download** icon on a file row | Opens a Save As dialog for the local destination |
| Rename | **Pencil** icon on a row | Prompts for the new name; works on files and directories |
| Delete | **Trash** icon on a row | Asks for confirmation first; works on files and directories |
| New folder | Toolbar **New folder** button | Prompts for a name, creates it in the current directory |

Permission (chmod) editing and a dual-pane local/remote view are not available yet — see the end of this chapter.

## Paste a clipboard image to the server

If you have an image on your clipboard (a screenshot, for example), you can push it directly to the remote host from an SSH tab:

- Press **Ctrl+Shift+I**, or
- Right-click ▸ **Automation ▸ Paste Image to Server**.

What happens:

1. The image is uploaded over SFTP — this works through jump-host chains too.
2. The remote path of the uploaded file is typed at your prompt, ready to use as an argument (`file`, `mv`, an upload script, whatever you're doing).
3. Temporary files created for the paste are cleaned up when the app exits.

Configure it under **Settings ▸ Preferences ▸ Terminal**:

| Preference | Default | Effect |
|---|---|---|
| Paste image to server | on | Master toggle; when off, pasting an image behaves like a normal paste |
| Image upload directory (remote) | `~/.bifrost/pastes` | Where pasted images are stored on the server (`~` expands to the remote home) |
| Delete uploaded images on app close | on | Cleans up the uploaded images when Bifrost quits |

## Zmodem: detected, not transferred

Honesty note: Bifrost does **not** implement in-terminal Zmodem transfers. If a remote program starts `sz` (send) or `rz` (receive), Bifrost detects the handshake and shows a desktop notification pointing you to the SFTP panel instead. Cancel the `sz`/`rz` on the remote side and use **Session ▸ Open SFTP** for the transfer.

## Not available yet

- **chmod** (permission) editing in the SFTP panel.
- **Dual-pane** local/remote file browser.
- **Zmodem** in-terminal transfers (detection + SFTP redirect only).

---

Previous: [Tunnels & port forwarding](05-tunnels.md) · Next: [Sessions](07-sessions.md)

> Source specs: openspec/specs/file-transfer/spec.md — documentation reflects the implementation as of v0.3.x.
