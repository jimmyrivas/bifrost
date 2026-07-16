<p align="center">
  <img src="resources/icon.png" alt="Bifrost" width="96" />
</p>

<h1 align="center">Bifrost</h1>

<p align="center">
  <strong>Modern connection manager for Linux — the spiritual successor to Ásbrú Connection Manager.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: GPL-3.0-or-later" src="https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg" /></a>
  <img alt="Platform: Linux" src="https://img.shields.io/badge/Platform-Linux-informational" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-34-9feaf9" />
</p>

<p align="center">
  <strong>English</strong> · <a href="README.es.md">Español</a>
</p>

Bifrost is a desktop connection manager for sysadmins, DevOps, and DevSecOps teams
managing dozens to hundreds of remote servers — SSH-first, with a modern terminal
experience.

> **Status: alpha (v0.3.0), Linux only.** This README is honest by design: the
> **Features** section lists only what works end-to-end in the UI today, verified
> against the code. Things that are built in the backend but not yet reachable
> from the UI live in [their own section](#built-in-the-backend-ui-pending), and
> known gaps are listed under [limitations](#known-limitations-alpha). If you find
> a claim here that isn't true, that's a bug — please open an issue.

📖 **User guide**: [docs/guide](docs/guide/README.md) — chapter-by-chapter documentation
derived from the project's OpenSpec capability specs and verified against the code
(also [en español](docs/guide/es/README.md)).

## Features

### Connections & organization
- Connection CRUD with hierarchical groups, favorites, recents, live search (matches tags too), and tag badges
- Connection templates: save any connection as a template, apply one when creating
- Per-connection notes (tagged: note/evidence/command/error), searchable notes panel
- Per-connection statistics (total connects, last connected, session time — derived from the audit log) and live health dots (periodic ping)
- Wake-on-LAN from the connection's right-click menu
- Workspaces: named connection filters to scope the sidebar to what you're working on

### Terminal
- xterm.js with WebGL rendering; local shells (with a shell picker: bash/zsh/fish/pwsh) and SSH in the same tab system
- Split panes (context menu; horizontal/vertical), maximize pane, explode panes to tabs, combine tabs
- Broadcast typing to all panes or all tabs (with a visible warning overlay), plus a multi-line broadcast bar with draft auto-save
- Paste safety: multiline-paste confirmation with dangerous-command scanning; Ctrl-C copies when text is selected, interrupts when not
- Per-tab zoom, font ligatures, copy-on-select, OSC 52 clipboard (copy from tmux/vim works), clickable web links
- `.md` paths in SSH output are clickable and open in an internal Markdown viewer — relative paths resolve against the tracked working directory
- **Copy as CSV / Markdown**: right-click any selection — ASCII-pipe, GFM, and box-drawing tables (`psql`, MySQL, etc.) are reconstructed into RFC 4180 CSV or clean Markdown; works in the terminal, the Markdown viewer, and AI responses
- Paste an image from the clipboard straight to the server (Ctrl+Shift+I): uploaded via SFTP (jump chains included), path typed into the terminal, cleaned up on exit
- ~50 built-in color schemes, per-connection scheme and background tint (production = red, staging = green), dynamic tab titles (OSC 0/2) with title lock
- Detach a tab to its own window — and reattach it back, keeping the same live session (scrollback and running process intact)
- Find in terminal (`Ctrl+Shift+F` or context menu) with highlighted matches; Clear/Reset terminal actions
- Terminal screenshot to PNG, F11 fullscreen, idle-completion desktop notification
- Error detection badges on failed commands, AI "Explain Command" on any selection, idle-session AI summary you can save as a note

### Sessions that survive
- Local session persistence via real multiplexer integration: **dtach, tmux, zellij, rmux** — probe, attach picker, and per-connection custom args (config file, zellij layout, extra flags)
- Session restore: on relaunch, Bifrost offers to reopen your previous tabs and reconnect them
- SSH auto-reconnect with exponential backoff (3s → 60s)

### SSH & networking
- Auth: password, key file (with passphrase), SSH agent; keyboard-interactive MFA prompts are forwarded to you
- Stored passwords encrypted with the OS keychain (`safeStorage`); the edit form shows them masked with reveal, and clearing the field deletes them
- TOTP/2FA: store a Base32 secret per connection and Bifrost auto-types the code when a verification prompt appears in the session
- Host-key verification (TOFU, SHA-256 fingerprints) with a known-hosts management panel in Settings
- **Jump-host chains** (multi-hop ProxyJump) with a visual chain editor — used by SSH, Mosh, and tunnels; inline hop passwords are encrypted at rest
- **Tunnels**: local, remote, and **dynamic (SOCKS5)** port forwarding with a full manager UI, per-tunnel credentials, and auto-start on launch
- **Mosh** as a first-class connection method (spawned via PTY, jump chains supported)
- **More connection methods** from the terminal: **Telnet** (in-terminal), **RDP** and **VNC** (launch the external client), and **Custom Command** (run any command as the session) — alongside SSH and Mosh
- **Advanced SSH options**: per-connection cipher / KEX / MAC / host-key algorithm selection and X11 forwarding are applied on connect

### SFTP & files
- SFTP panel per SSH tab: browse, upload (multi-file), download, delete, mkdir
- Clipboard-image upload (see Terminal above)

### Automation
- **Remote commands**: per-connection or global command palettes with groups, confirmation flags, keybindings, `<VAR>` expansion and `{{param}}` prompts — run from the terminal's right-click menu
- **Runbooks**: paste a Markdown runbook, pick the target tab, execute fenced blocks step-by-step with per-step status, dry-run mode, and dangerous-command warnings
- **Scripts**: sandboxed JavaScript (isolated worker) with `send`/`log`/`sleep`, editable in-app, run against the live terminal from the context menu
- Snippet browser with categories, search, copy or run-in-terminal, `{{param}}` prompts
- Variable expansion (`<IP>`, `<USER>`, `<ENV:name>`, `<GV:name>`, dates) in tab titles and remote commands
- **Global variables editor** (Keys view): define the values behind `<GV:name>`, with secret masking
- **Macros** (Automation view): global and per-connection command macros (remote or local), run from the terminal's right-click **Macros** submenu with an optional confirm flag
- **Expect automation** (connection editor → EXPECT tab): per-connection regex→response rules that fire automatically on the live SSH session, with send-Enter and hide-from-log options
- **Clusters**: group connections manually or by regex auto-cluster; "Open cluster" opens every member in its own tab and turns on all-tabs broadcast so you drive the whole group at once
- **Pre/post-connection hooks**: commands stored on a connection run locally on connect/disconnect, with optional per-command confirmation — every execution is audit-logged

### Observability & security
- **Session recording** (asciicast v2 `.cast`, input + output) from the terminal's Capture menu: pulsing red dot on the tab, a blinking REC indicator in the status bar, stop-toast with the file path, and a Recordings manager (play command, reveal, delete) — replay with `asciinema play`
- **Session logs**: plain-text transcripts per session (pattern-based file names), start/stop from the Capture menu, folders exposed in Preferences → Session Capture
- Append-only audit log (JSON Lines) of connections, credential events, capture start/stop, and hook executions — it also powers the per-connection statistics
- **Activity view** (sidebar): the audit log as a day-grouped timeline with category filters, search, 24h/7d/30d ranges, live refresh, per-connection drill-down, insights counters, log rotation, and CSV/JSONL export of the filtered events — plus a Captures tab over recordings and session logs
- Secret redaction filter for terminal output (Settings toggle, persisted across restarts; off by default)
- Encrypted credential storage throughout: connections, tunnels, and jump hops; one-click **vault re-encryption** (Settings → Security)
- **Database encryption at rest**: encrypt the whole DB file with a passphrase (AES-256-GCM) — decrypted on startup, re-encrypted on quit
- **1Password references**: point a connection's password at `op://…` and it's resolved via the `op` CLI at connect time, never stored; a **Secret Managers** panel detects 1Password/Bitwarden/KeePassXC/Vault/AWS SM/Azure KV
- **SSH certificate authority**: sign a public key via a local CA (`ssh-keygen`) or a Vault SSH role
- **Key-file fallback**: keep an encrypted copy of a private key in the vault so a connection still authenticates if the key file moves
- Session idle detection with AI summaries; desktop notifications when long-running commands finish

### AI & MCP
- AI Assistant panel (Ctrl+Shift+A), dockable or in its own window, with streaming responses from **Ollama, OpenRouter, OpenAI, or DeepSeek** (provider/model/key configurable in Settings)
- Explain-command, error awareness, idle summaries, and copy-as-CSV/Markdown on responses
- **MCP server** for AI agents (e.g. Claude): **42 tools, 9 resources, 8 prompt templates**, stdio or HTTP with Bearer auth, destructive-command filtering, read-only DB access — see [`docs/MCP_ARCHITECTURE.md`](docs/MCP_ARCHITECTURE.md)

### App shell
- Command palette (Ctrl+K) over connections and commands; a fixed set of global shortcuts
- Plugin system: install/enable/disable npm-packaged plugins from Settings, against a documented hooks API ([`docs/PLUGIN_API.md`](docs/PLUGIN_API.md))
- Config sync via git: export/import/sync your configuration to a repository you point it at
- **Import / Export** (Settings): parse `~/.ssh/config`, Ansible inventories, and Terraform state into connections (preview → select → import), plus JSON backup export/restore
- **Cloud discovery** (Settings): scan AWS EC2, GCP, Azure, Docker, Podman, and Kubernetes via their local CLIs and import running instances as connections
- Window-state persistence, **system tray with your favorites and recent connections** (click to open), "Spectral Command" design system ([`docs/reference/DESIGN.md`](docs/reference/DESIGN.md))
- UI in English; Spanish translation started (~30 strings so far — help welcome)

## Built in the backend, UI pending

These exist as real, tested main-process implementations with IPC in place, but
**no UI reaches them yet** — selecting them does nothing (or falls back to SSH).
They are the top of the roadmap, and each is a well-scoped contribution:

- **Protocol launchers** without a menu entry: FTP (lftp), TN3270, WebDAV, AWS SSM sessions — the backend exists but the connection form only offers SSH/Mosh/RDP/VNC/Telnet/Custom
- **Password-manager references beyond 1Password**: Bitwarden, Vault, AWS Secrets Manager, and Azure Key Vault are detected and reachable in the backend, but only 1Password (`op://`) is wired to the connect path
- **Advanced SSH options — partial**: cipher/KEX/MAC/host-key algorithm selection and X11 forwarding are now consumed by the connect path; **agent forwarding and HTTP proxy** are saved by the form but not yet applied

## Known limitations (alpha)

- **Keyboard pane-resize** shortcuts are not wired yet (resize via splits/maximize)
- **Zmodem** sz/rz is detected and redirects you to SFTP — no in-terminal transfer
- **FIDO2** tab exists but ssh2 cannot yet use sk-keys directly (works only through ssh-agent)
- Custom **keybindings editor** doesn't yet override the built-in shortcuts
- **Session recording** covers SSH sessions only (local/mosh panes show the option disabled)

## Roadmap

Beyond wiring the sections above: Windows support ([plan](docs/WINDOWS_COMPAT_PLAN.md)),
macOS packaging, multi-OS CI, Ásbrú import, real ZMODEM transfers, SFTP
rename/chmod/dual-pane, E2E tests in CI, spec-derived user docs in English and
Spanish, and finishing the Spanish UI translation.

## Installation

Download the latest AppImage from the [releases page](https://github.com/jimmyrivas/bifrost/releases), then:

```bash
chmod +x Bifrost-*.AppImage
./Bifrost-*.AppImage
```

Verify the download:

```bash
sha256sum -c SHA256SUMS
```

> On Linux without a keyring (gnome-keyring/kwallet), credentials fall back to
> obfuscated storage with a warning — install a keyring for real encryption.

## Building from source

Requirements: Node.js 20+, [pnpm](https://pnpm.io) 10.x, and build tools for
native modules (`python3`, `make`, `g++`).

```bash
git clone https://github.com/jimmyrivas/bifrost.git
cd bifrost
pnpm install
pnpm rebuild        # rebuild native modules against Electron's ABI
pnpm dev            # development with HMR
pnpm package        # produce AppImage / deb / rpm in dist/
```

Useful scripts:

| Command | Description |
| --- | --- |
| `pnpm lint` | ESLint (with `--fix`) |
| `pnpm typecheck` | TypeScript `--noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm mcp:dev` | Run the MCP server (stdio) |

## Architecture

Three-process Electron app plus a standalone MCP server:

- **Main** (`src/main/`) — SQLite (Drizzle), PTY/SSH, keychain, tray, ~26 IPC modules
- **Preload** (`src/preload/`) — typed IPC bridge
- **Renderer** (`src/renderer/`) — React 18 + TypeScript, Zustand, Tailwind v4, xterm.js
- **MCP server** (`src/mcp/`) — separate Node process, read-only DB access via sql.js

Intended behavior is specified under [`openspec/specs/`](openspec/specs/). Note
that some specs describe capabilities whose UI is still pending (see the section
above) — the specs are the target, this README is the current state.

## Contributing

Issues and pull requests are welcome — the
["backend built, UI pending" section](#built-in-the-backend-ui-pending) is a
great place to start: the hard half is already done and tested. Before
submitting:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Significant changes go through the [OpenSpec](openspec/) workflow — see
`openspec/changes/archive/` for real examples of proposal → tasks → spec deltas.

## License

Bifrost is free software, licensed under the
[GNU General Public License v3.0 or later](LICENSE) (GPL-3.0-or-later).

Named after the burning rainbow bridge of Norse mythology that connects the
worlds — and built in loving memory of
[Ásbrú Connection Manager](https://www.asbru-cm.net/), whose name refers to the
same bridge.
