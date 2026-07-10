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

Bifrost is a desktop connection manager for sysadmins, DevOps, and DevSecOps teams
managing dozens to hundreds of remote servers. It combines the deep SSH tooling of
Ásbrú/PAC with a modern terminal experience: split panes, cluster broadcast,
jump-host chains, session recording, cloud discovery, automation, and an AI
assistant — all in one keyboard-friendly UI.

> **Status:** v0.2.0 (alpha). Linux first; Windows compatibility is in progress.
> Feature-by-feature coverage is tracked in [`docs/STATUS.md`](docs/STATUS.md).

## Features

**Connections & organization**
- SSH, Mosh, Telnet, local shells, RDP/VNC (external), and custom commands
- Groups, tags, clusters, templates, per-connection variables, import from Ásbrú
- Credentials in the OS keychain (`safeStorage`) — passwords never stored in plain text
- TOTP/2FA secrets, FIDO2 hardware keys, SSH certificates, agent forwarding

**Terminal**
- xterm.js with WebGL rendering, split panes, detach-to-window, quake-style dropdown
- Broadcast input to panes or every session (cluster administration)
- Session persistence across restarts via dtach/tmux/zellij
- Per-connection color schemes and background tints (production = red, staging = green…)
- Copy rendered tables as CSV or Markdown straight from the terminal

**Routing & tunnels**
- Jump-host chains (ProxyJump) for SSH, Mosh, and tunnels
- Local/remote/dynamic port forwarding with auto-start
- Wake-on-LAN, external protocol handlers

**Automation**
- Expect-style rules, macros, remote command palettes, sandboxed JS scripting
- Variable expansion: `<IP>`, `<USER>`, `<ENV:…>`, `<GV:…>`, `<ASK:…>`, `<CMD:…>`
- Pre/post-connection hooks, keep-alive strings, runbooks

**Observability & security**
- Session recording (asciicast), session logs, audit log (JSON Lines)
- Connection health monitoring, dangerous-command warnings, secret redaction
- Integrations: 1Password, Bitwarden, HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, KeePass

**Discovery & AI**
- Cloud/container discovery: AWS, GCP, Azure, Docker, Kubernetes, Podman
- Built-in AI assistant (explain commands, summarize sessions)
- [MCP server](docs/MCP_ARCHITECTURE.md) exposing 42 tools so AI agents (e.g. Claude) can manage your infrastructure through Bifrost

## Installation

Download the latest AppImage, `.deb`, or `.rpm` from the releases page, then:

```bash
chmod +x Bifrost-*.AppImage
./Bifrost-*.AppImage
```

> On Linux without a keyring (gnome-keyring/kwallet), credentials fall back to
> obfuscated storage with a warning — install a keyring for real encryption.

## Building from source

Requirements: Node.js 20+, [pnpm](https://pnpm.io) 10.x, and build tools for
native modules (`python3`, `make`, `g++`).

```bash
git clone https://gitlab.com/jimmy.rivas/bifrost.git
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

Design system: [Spectral Command](docs/reference/DESIGN.md) — tonal surfaces, no
1px borders, JetBrains Mono + Inter.

## Contributing

Issues and merge requests are welcome. Before submitting:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Significant changes go through the [OpenSpec](openspec/) workflow — see the
`openspec/changes/archive/` directory for examples.

## License

Bifrost is free software, licensed under the
[GNU General Public License v3.0 or later](LICENSE) (GPL-3.0-or-later).

Named after the burning rainbow bridge of Norse mythology that connects the
worlds — and built in loving memory of
[Ásbrú Connection Manager](https://www.asbru-cm.net/), whose name refers to the
same bridge.
