[← Guide index](README.md)

# The Terminal

Bifrost's terminal is xterm.js with WebGL rendering. Local shells and SSH connections live in the same tab system: open a local tab, connect to a server, split either into panes, broadcast to all of them — the workflow is identical. This chapter covers the terminal itself; connecting is covered in [Connections](02-connections.md) and [SSH](04-ssh.md).

## Local shells and SSH in one tab system

- **New local tab**: `Ctrl+T`, or the **+** button in the tab bar. The shell picker next to it lists the shells detected on your system (bash, zsh, fish, pwsh) so each tab can run a different shell.
- **SSH tabs** open from the sidebar or the command palette (`Ctrl+K`) and behave exactly like local tabs: same panes, same context menu, same shortcuts.
- Tabs stay alive when you switch away. Bifrost keeps every terminal mounted, so returning to a tab finds its scrollback and its running process exactly where you left them.

## The right-click menu

Everything in this chapter is reachable from the terminal's context menu. Its top level:

| Item | What it holds |
| --- | --- |
| **Copy** | Copy the selection as plain text |
| **Copy as ▸** | Markdown / CSV (see [Copy as Markdown or CSV](#copy-as-markdown-or-csv)) |
| **Paste** | Paste the clipboard (goes through paste safety) |
| **Find in Terminal** | Opens the search bar (`Ctrl+Shift+F`) |
| **Layout ▸** | Split Horizontal / Split Vertical / Maximize Pane / Close Split Pane / Explode to Tabs / Combine All Tabs |
| **Automation ▸** | Scripts, Remote Commands, Runbooks, Explain Command, AI Assistant, Broadcast toggle, Paste Image to Server, Enable cwd tracking |
| **Capture ▸** | Record Session, Save Session Log, Take Screenshot, Save as Note, Recordings…, Open Recordings/Logs Folder |
| **Session ▸** | Rename Tab, Lock Title, Duplicate, Save as Connection, Open SFTP, Detach to Window |
| **Clear Terminal** | Clears the screen and scrollback |
| **Reset Terminal** | Full terminal reset (modes, charset, colors) |
| **Disconnect** | Ends the session and closes the tab |

Some entries appear only when they apply: *Explode to Tabs* needs a split tab, *Combine All Tabs* needs more than one tab, and *Paste Image to Server*, *Save as Connection*, *Open SFTP*, and *Enable cwd tracking* need an SSH tab.

## Split panes and layout

Right-click → **Layout → Split Horizontal** (or **Split Vertical**) divides the current pane. Each pane is an independent session.

- **Maximize Pane** (`Ctrl+Shift+M` or Layout menu) temporarily makes the focused pane fill the tab; toggle again to restore the layout.
- **Close Split Pane** removes the focused pane.
- **Explode to Tabs** turns every pane of a split tab into its own tab.
- **Combine All Tabs** does the reverse: merges all open tabs into one split tab.

## Detach to a window — and bring it back

**Session → Detach to Window** moves the tab into its own window. This is a live transfer, not a copy: the session keeps running and its recent output is replayed in the new window.

The round trip works too. Click **Re-attach** in the detached window (or just close it) and the tab returns to the main window, adopting the same live session — scrollback replayed, process still running. Detach for a second monitor, reattach when you're done; nothing restarts.

## Broadcast typing

Type once, send everywhere. `Ctrl+Shift+B` cycles broadcast mode: **off → panes → all tabs → off** (also available as the Broadcast toggle under right-click → **Automation**).

- **Panes** mode sends your keystrokes to every pane in the current tab (amber banner).
- **All tabs** mode sends them to every open tab (red banner).
- The banner stays visible the whole time broadcast is active, so you always know keystrokes are going to many targets.

There is also a multi-line broadcast bar: compose a longer command in a text area and send it with `Ctrl+Enter`; your draft is auto-saved while you type.

## Paste safety and smart Ctrl-C

- Pasting **multi-line** content pops a confirmation showing exactly what will be sent.
- Pasted content is scanned against known **dangerous command patterns** (`rm -rf /` and friends); matches are flagged and require explicit confirmation.
- `Ctrl+C` is intelligent: with a selection it **copies**; without one it sends the interrupt (`^C`) as usual. `Ctrl+Shift+C` / `Ctrl+Shift+V` always copy/paste.

## Find in terminal

Press `Ctrl+Shift+F` (in the focused pane), or right-click → **Find in Terminal**, to open a search bar in the top-right corner of the pane. Matches are highlighted as you type. Plain `Ctrl+F` is intentionally passed through to the shell (readline).

| Key | Action |
| --- | --- |
| `Enter` | Next match |
| `Shift+Enter` | Previous match |
| `Esc` | Close the bar and clear all highlights |

## Clear and reset

- **Clear Terminal** (context menu) wipes the screen and scrollback.
- **Reset Terminal** performs a full reset — use it when a program leaves the terminal in a broken state (wrong charset, stuck alternate screen, dead colors).

## Appearance

- **Per-tab zoom**: `Ctrl+=` / `Ctrl+-` / `Ctrl+0` (reset). Zoom applies only to the active terminal — background tabs keep their size.
- **~50 built-in color schemes**, selectable globally and per connection. A per-connection **background tint** color-codes environments at a glance — the convention: production red, staging green.
- **Font ligatures**, **copy-on-select**, and **OSC 52** clipboard support (copying from tmux or vim inside the session reaches your system clipboard).
- **Clickable web links** in output open in your browser.
- **Dynamic tab titles**: shells that emit OSC 0/2 title sequences update the tab title live. **Session → Lock Title** freezes it; **Session → Rename Tab** sets your own name (renaming locks the title automatically).

## Markdown files in output

`.md` paths printed in SSH output are clickable and open in Bifrost's internal Markdown viewer (GitHub-flavored rendering).

- **Relative paths** need to know the remote working directory: run right-click → **Automation → Enable cwd tracking (relative .md links)** once per session, and the shell will report its directory from then on. Absolute paths work without it.
- The viewer has its own copy tools: right-click the rendered content for **Copy as text / Markdown / CSV** (acting on your selection, or the whole document if nothing is selected), or use the **Copy** dropdown in the viewer header, which always acts on the whole document. Copy as CSV extracts rendered tables as RFC 4180 CSV.

## Copy as Markdown or CSV

Right-click a terminal selection → **Copy as → Markdown** or **CSV**. Bifrost reconstructs real tables out of plain terminal text:

- ASCII-pipe tables, GFM tables, and box-drawing tables (`psql`, MySQL, and similar CLIs) become a clean Markdown table or RFC 4180 CSV — border and separator rows are dropped.
- If the selection isn't a table, Copy as CSV falls back to splitting whitespace/tab-aligned columns; Copy as Markdown returns the text unchanged.
- Shell command lines containing pipes (`ps aux | grep ssh`) are **not** mistaken for tables.
- A small toast confirms which format was copied; choosing either action with nothing selected shows a "Select text first" hint instead.

## Paste an image to the server

On an SSH tab, `Ctrl+Shift+I` (or right-click → **Automation → Paste Image to Server**) takes an image from your clipboard, uploads it to the server over SFTP — jump-host chains included — and types the remote path at your prompt, ready to use. Uploaded images are cleaned up when the session ends.

## Capture

Everything under right-click → **Capture**:

- **Record Session** records an SSH session's input and output as an asciicast `.cast` file (SSH sessions only). Choose **Stop Recording** to finalize; a toast shows the file path. **Recordings…** opens a manager for past recordings, and **Open Recordings Folder** jumps to the directory.
- **Save Session Log** streams the session's output to a `.log` file (named from the connection's log pattern); **Stop Session Log** ends it. **Open Logs Folder** shows the files.
- **Take Screenshot** saves the visible terminal as a PNG.
- **Save as Note** stores the current selection as a per-connection note, tagged as Note, Evidence, Command, Error, or AI Prompt — searchable later from the notes panel.

## Terminal intelligence

- **Error badges**: when output matches a known error pattern, a dismissible badge appears in the corner with a suggestion on hover.
- **Idle-completion notification**: if a long-running command finishes while you're elsewhere, Bifrost sends a desktop notification.
- **Explain Command**: select any command and right-click → **Automation → Explain Command** to get an AI explanation in place.
- **Idle session summary**: when a session with meaningful output goes idle, an AI summary is offered — it collapses to a corner icon, expands on demand, and can be saved as a note with one click. Requires an AI provider configured in Settings (see [AI & MCP](10-ai-mcp.md)).

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+T` | New local tab |
| `Ctrl+W` | Close active tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab |
| `Ctrl+1` … `Ctrl+9` | Jump to tab by number |
| `Ctrl+Shift+H` | Split horizontal |
| `Ctrl+\` | Split vertical |
| `Ctrl+Shift+M` | Maximize / restore pane |
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | Copy / paste |
| `Ctrl+Shift+B` | Cycle broadcast mode |
| `Ctrl+Shift+F` | Find in the focused terminal |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset (active tab only) |
| `Ctrl+Shift+I` | Paste clipboard image to server (SSH) |
| `Ctrl+Shift+D` | Disconnect / close session |
| `Ctrl+Shift+A` | Toggle AI Assistant |
| `F11` | Fullscreen |

## Not available yet

- **Keyboard pane resizing** (`Ctrl+Shift+Arrow`) is not wired yet — resize by splitting differently or maximizing.
- **Quake-style drop-down terminal** is not functional yet.
- The **custom keybindings editor** in Settings saves your bindings but does not override the built-in shortcuts yet.
- **Zmodem transfers** (`sz`/`rz`) are detected but not performed — Bifrost points you to the SFTP panel instead.

> Source specs: `openspec/specs/terminal-ui/spec.md`, `openspec/specs/markdown-viewer/spec.md` — documentation reflects the implementation as of v0.3.x.
