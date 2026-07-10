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
managing dozens to hundreds of remote servers. It combines the deep SSH tooling of
Ásbrú/PAC with a modern terminal experience — and its behavior is specified
capability-by-capability under [`openspec/specs/`](openspec/specs/), which is the
source of truth for the feature list below.

> **Status:** v0.3.0 (alpha). Linux first; Windows/macOS support is on the
> [roadmap](#roadmap--todo).

## Features

Everything listed here is implemented and covered by a capability spec.

### Connections & organization
- Connection CRUD with hierarchical groups, favorites, history, fuzzy search, tags, and validation
- Reusable connection templates ("Save as Template", "Save session as profile")
- Import/export — Ásbrú Connection Manager, `~/.ssh/config` parser, Ansible inventories, Terraform state
- Wake-on-LAN
- Per-connection stats (connect count, last connected) and live health dots (ping)

### Terminal
- xterm.js with WebGL rendering; dual-mode local PTY and SSH terminals
- Split panes (horizontal/vertical), maximize, resize hotkeys, explode panes to tabs, combine tabs
- Detach any tab to its own window and reattach — the session survives the move
- Broadcast input to panes or all tabs, with a warning overlay while active
- Paste safety: multiline paste warning, dangerous-command detection, intelligent Ctrl-C
- Zoom (scoped to the active tab), font ligatures, copy-on-select, clickable links, dynamic tab titles (OSC 0/2)
- 50+ color schemes, per-connection colors and background tints (production = red, staging = green…)
- Quake-style dropdown terminal and F11 fullscreen
- **Copy as CSV / Markdown**: right-click any table or selection — ASCII-pipe, GFM, and box-drawing tables (psql included) are reconstructed into clean CSV (RFC 4180) or GFM Markdown
- Internal Markdown viewer: `.md` paths in SSH output are clickable (relative paths resolved via cwd tracking) and render in-app

### Sessions that survive
- Local session persistence via multiplexers: dtach, tmux, zellij, rmux — with custom config/layout/extra args per multiplexer
- Session restore: reopen the app and get a prompt to restore your previous tabs, reconnected
- Auto-reconnect with exponential backoff; SSH connection reuse/multiplexing

### SSH & networking
- Auth: password, key file, certificate, SSH agent, FIDO2 hardware keys, MFA/TOTP auto-inject
- Host key verification (TOFU, SHA-256 fingerprints) with a known-hosts management panel
- Algorithm selection (ciphers/KEX/HMAC/host keys), X11 forwarding, HTTP proxy, agent forwarding
- **Jump hosts**: multi-hop ProxyJump chains for SSH, Mosh, and tunnels
- **Tunnels**: local, remote, and dynamic (SOCKS) port forwarding with auto-start and tray lifecycle
- Alternative protocols: Mosh, RDP (clipboard/drive/printer/audio/resolution options), and arbitrary custom commands

### Clusters & automation
- Clusters: group connections, open every member at once, broadcast to the cluster; auto-clusters by regex
- Expect engine (per-connection toggle, debugger, jump rules) for prompt automation
- Sandboxed JavaScript script engine with editor, execution modes, and terminal context
- Macros, per-connection remote command palettes, pre/post-connection hooks with `ASK` prompts
- Variable expansion everywhere: `<IP>`, `<USER>`, `<ENV:…>`, `<GV:…>`, `<ASK:…>`, `<CMD:…>` with global/connection scope resolution
- Runbooks (parse & execute fenced commands with per-step status), parameterized workflows (`{{arg}}`), snippet browser, launch configurations

### Secrets & security
- Encrypted credential vault (OS keychain via `safeStorage`), vault re-encryption, AES-256-GCM config encryption, encrypted key-file storage
- Stored passwords visible (masked, with reveal) and removable from the connection editor
- External password managers: 1Password, Bitwarden, HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, KeePassXC
- SSH certificate authority support and FIDO2 key generation/detection
- Secret redaction in output, audit log (append-only JSON Lines), session recording (asciicast v2), session logs, terminal screenshots

### Infrastructure discovery
- Cloud: AWS EC2, GCP, Azure VMs, AWS SSM
- Containers & orchestration: Docker, Podman, `kubectl exec`
- One click turns discovered targets into Bifrost connections

### AI & MCP
- AI Assistant panel (multi-provider: Ollama, OpenRouter, OpenAI, DeepSeek): command explanation, error detection with suggestions, idle-session summaries, detachable window, copy responses as text/Markdown/CSV
- **MCP server** for AI agents (e.g. Claude): 42 tools, 9 resources, and 8 prompt templates over stdio or HTTP+Bearer; reads the Bifrost DB read-only via sql.js and filters destructive commands — see [`docs/MCP_ARCHITECTURE.md`](docs/MCP_ARCHITECTURE.md)

### App shell
- Workspaces, command palette (Ctrl+K), multi-chord hotkeys, system tray with dynamic menus, window-state persistence, git-based config sync
- "Spectral Command" design system — [`docs/reference/DESIGN.md`](docs/reference/DESIGN.md)

## Roadmap / TODO

What Bifrost does **not** have yet, and wants to. Contributions welcome — big
items should go through the [OpenSpec](openspec/) workflow.

**Platform support**
- [ ] Windows support (platform utilities, shell detection incl. PowerShell/WSL, native RDP via mstsc, packaging) — plan in [`docs/WINDOWS_COMPAT_PLAN.md`](docs/WINDOWS_COMPAT_PLAN.md)
- [ ] macOS packaging (dmg)
- [ ] Multi-OS CI matrix (currently Linux only)

**Plugin system**
- [ ] Full plugin architecture (load/isolate third-party plugins — the hooks API in [`docs/PLUGIN_API.md`](docs/PLUGIN_API.md) already exists)
- [ ] Plugin manager UI (browse/install/enable)

**Protocols**
- [ ] FTP
- [ ] WebDAV
- [ ] TN3270 (mainframe)
- [ ] Additional VNC viewers (TigerVNC/RealVNC)

**Terminal & UX**
- [ ] Real in-terminal ZMODEM transfers (today: sz/rz detection hands off to SFTP)
- [ ] PCC (broadcast bar) syntax highlighting
- [ ] Profile inheritance (templates exist; inheritance chains do not)

**Stability & quality**
- [ ] Eradicate the remaining production-build re-render crash (Zustand object-selector cascade — partially fixed)
- [ ] E2E (Playwright) suite wired into CI
- [ ] User documentation generated from the capability specs, in English and Spanish

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

Every capability is specified under [`openspec/specs/`](openspec/specs/) — 20
capabilities with testable requirements and BDD scenarios. Start there to
understand expected behavior before diving into code.

## Contributing

Issues and pull requests are welcome. Before submitting:

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
