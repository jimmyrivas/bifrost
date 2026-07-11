[← Guide index](README.md)

# Getting started

Bifrost is a desktop connection manager for Linux — the spiritual successor to Ásbrú Connection Manager. It is built for sysadmins, DevOps, and DevSecOps teams who manage dozens to hundreds of remote servers, SSH-first, with a modern terminal. Bifrost is free software under the GPL-3.0-or-later license. Current status: **alpha (v0.3.x), Linux only** — Windows and macOS are on the roadmap.

## Installation

### Prebuilt packages

Download the latest AppImage, `.deb`, or `.rpm` from the [GitHub releases page](https://github.com/jimmyrivas/bifrost/releases) (the project also lives on GitLab). For the AppImage:

```bash
chmod +x Bifrost-*.AppImage
./Bifrost-*.AppImage
```

Verify the download against the published checksums:

```bash
sha256sum -c SHA256SUMS
```

> **Keyring note:** on Linux without a keyring service (gnome-keyring or kwallet), stored credentials fall back to obfuscated storage and Bifrost shows a warning. Install a keyring to get real encryption. See [Managing connections](02-connections.md#stored-credentials) for details.

### Building from source

Requirements: Node.js 20+, [pnpm](https://pnpm.io) 10.x, and build tools for native modules (`python3`, `make`, `g++`).

```bash
git clone https://github.com/jimmyrivas/bifrost.git
cd bifrost
pnpm install
pnpm rebuild        # rebuild native modules against Electron's ABI
pnpm dev            # run in development mode with hot reload
pnpm package        # produce AppImage / deb / rpm in dist/
```

## First launch: a tour of the window

When Bifrost opens you see:

- **Connection sidebar** (left) — a tree of your connections, organized into groups, with Favorites and Recent sections, live search, and tag badges. Right-clicking a connection or group opens its context menu. See [Managing connections](02-connections.md).
- **Tab bar** (top) — every local shell and SSH session lives in a tab. Tabs can be split into panes and detached to their own window.
- **Terminal area** (center) — the active tab's terminal. Right-click it for the terminal context menu (copy formats, find, remote commands, and more).
- **AI assistant** — a dockable panel toggled with `Ctrl+Shift+A`. It streams responses from Ollama, OpenRouter, OpenAI, or DeepSeek; configure the provider, model, and API key in Settings.
- **Command palette** — press `Ctrl+K` for a fuzzy-search palette over your connections and commands.
- **Settings** — preferences, color schemes, known hosts, notes, plugins, and git config sync.

Other things worth knowing on day one:

- **Window state persists**: position and size are restored on the next launch.
- **Session restore**: on relaunch, Bifrost offers to reopen your previous tabs and reconnect them.
- **System tray**: Bifrost adds a tray icon. Note that the tray's connection menus are not populated yet — use the sidebar or the command palette to connect.
- **Fullscreen**: press `F11` to toggle fullscreen.
- **Find in terminal**: press `Ctrl+Shift+F` in a terminal, or right-click and choose *Find in Terminal*, to open the search bar. Plain `Ctrl+F` is passed through to the shell.

## Key keyboard shortcuts

Bifrost ships a fixed set of global shortcuts (a custom keybindings editor exists in Settings, but it does not override these built-ins yet):

| Shortcut | Action |
| --- | --- |
| `Ctrl+K` | Open the command palette |
| `Ctrl+Shift+A` | Toggle the AI assistant panel |
| `Ctrl+T` | New local terminal tab |
| `Ctrl+W` | Close the active tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab |
| `Ctrl+1`…`Ctrl+9` | Jump to tab by number |
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | Copy / paste in the terminal |
| `Ctrl+Shift+H` / `Ctrl+\` | Split the pane horizontally / vertically |
| `Ctrl+Shift+M` | Maximize / restore the focused pane |
| `Ctrl+Shift+B` | Cycle broadcast mode (off → all panes → all tabs) |
| `Ctrl+Shift+F` | Find in the focused terminal |
| `Ctrl+Shift+I` | Paste a clipboard image to the connected server |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset (per tab) |
| `F11` | Toggle fullscreen |

Inside the terminal, `Ctrl+C` is smart: it copies when text is selected and sends an interrupt when nothing is selected.

## Language and platform support

- The UI is in **English**; a Spanish translation is in progress.
- **Linux only** today. Windows and macOS support are on the roadmap.

## Not available yet

- Tray connection menus are empty (the tray icon itself works).
- The custom keybindings editor in Settings saves your changes but does not override the built-in shortcuts yet.
- Windows and macOS builds, and the complete Spanish UI translation.

> Source specs: `openspec/specs/app-shell/spec.md` — documentation reflects the implementation as of v0.3.x.
