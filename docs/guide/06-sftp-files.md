[← Guide index](README.md)

# SFTP & Files

Bifrost transfers files over the SSH connection you already have: every SSH tab can open its own SFTP panel, and images on your clipboard can be pasted straight to the server. This chapter covers what the file tooling does today — and what it deliberately does not do yet.

## Opening the SFTP panel

Right-click inside an SSH terminal and choose **Session ▸ Open SFTP**. The panel opens next to the terminal, attached to that tab's SSH session — no second login, no separate credentials. The same menu entry becomes **Close SFTP** while the panel is open.

The panel is only available on tabs backed by a saved SSH connection; local terminal tabs don't show the entry.

## Browsing remote directories

The panel opens at the **shell's current working directory** when it can detect
it (falling back to the remote home). It gives you:

- A **breadcrumb** of the current path — click any segment (or the leading `/`)
  to jump to that ancestor.
- A **path bar** — type any absolute path (or `~`) and press Enter to jump there.
- **Up** (↑) to the parent, **Refresh** to reload, and **Sync to shell directory**
  (the down-into-folder icon) to jump back to where your shell is.
- **Double-click** a folder to enter it.
- **Name**, **Modified** date, and **Size** columns. Click a header to sort; click
  again to reverse. The **folders-first** toggle keeps directories on top.
- **Resize** the panel by dragging its left edge — the width is remembered.

## File operations

| Operation | How | Notes |
|---|---|---|
| Upload | Toolbar **Upload** button | Pick **files and/or folders**; folders upload recursively into the current directory |
| Download (one) | **Download** icon on a file row | Save As dialog; recorded in the download history |
| Download (many) | Tick the **checkboxes**, then **Download to folder…** | Select any mix of files and folders; pick a destination folder and everything transfers, folders recursively, preserving structure |
| Rename | **Pencil** icon on a row | Prompts for the new name; files and directories |
| Delete | **Trash** icon on a row | Confirms first; files and directories |
| New folder | Toolbar **New folder** button | Prompts for a name in the current directory |

## Download history

Every download is remembered. Open it with the **history** (clock) icon in the
SFTP panel header: each entry shows the file, where it was saved, its size, and
when — with **Reveal** (open the file manager at it) and **Open** actions.

## Download a Markdown file you're viewing

When you open a remote `.md` in the Markdown viewer, use its **Download** button
to save the file over SFTP (it's added to the history too).

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
