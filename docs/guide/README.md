# Bifrost User Guide

Practical documentation for Bifrost, derived from the project's [OpenSpec capability specs](../../openspec/specs/) and verified against the code — every feature described here has a working UI path as of **v0.3.x**. Things that exist only in the backend, or that are known limitations, are called out honestly in each chapter's *"Not available yet"* section (and in the [README](../../README.md)'s feature tiers).

**[Versión en español →](es/README.md)**

## Chapters

| # | Chapter | What it covers |
| --- | --- | --- |
| 01 | [Getting started](01-getting-started.md) | Install, first launch, window tour, keyboard shortcuts |
| 02 | [Connections](02-connections.md) | CRUD, groups, templates, favorites, search, notes, stats, WoL, workspaces, credentials, TOTP, git config sync |
| 03 | [The terminal](03-terminal.md) | Tabs, panes, the right-click menu, broadcast, paste safety, find, copy as Markdown/CSV, image paste, appearance, capture, detach/reattach |
| 04 | [SSH, Mosh & jump hosts](04-ssh.md) | Auth methods, host keys (TOFU), MFA/TOTP, auto-reconnect, jump-host chains, Mosh |
| 05 | [Port forwarding](05-tunnels.md) | Local, remote, and dynamic (SOCKS5) tunnels; auto-start; jump chains |
| 06 | [SFTP & files](06-sftp-files.md) | SFTP panel, clipboard-image upload, Zmodem note |
| 07 | [Sessions that survive](07-sessions.md) | Multiplexers (dtach/tmux/zellij/rmux), custom args, session restore, auto-reconnect |
| 08 | [Automation](08-automation.md) | Remote commands, runbooks, scripts, snippets, connection hooks, variable expansion |
| 09 | [Observability & security](09-observability-security.md) | Session recording, session logs, audit log, health, error detection, secret redaction, credential security |
| 10 | [AI & MCP](10-ai-mcp.md) | AI assistant panel, providers, explain command, the MCP server for AI agents |

## Other documentation

- [`README.md`](../../README.md) — feature overview with honest tiers (verified / backend-only / limitations)
- [`docs/MCP_ARCHITECTURE.md`](../MCP_ARCHITECTURE.md) — MCP server design and decisions
- [`docs/PLUGIN_API.md`](../PLUGIN_API.md) / [`docs/PLUGIN_DEV_GUIDE.md`](../PLUGIN_DEV_GUIDE.md) — plugin system
- [`docs/reference/DESIGN.md`](../reference/DESIGN.md) — the Spectral Command design system
- [`CHANGELOG.md`](../../CHANGELOG.md) — per-release history

> Found something documented here that doesn't work? That's a bug in the docs or the app — please [open an issue](https://github.com/jimmyrivas/bifrost/issues).
