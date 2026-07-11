[← Guide index](README.md)

# AI & MCP

Bifrost integrates AI in two directions: an in-app **AI Assistant** that helps *you* while you work in the terminal, and an **MCP server** that lets AI agents (such as Claude Code) operate Bifrost's inventory — connections, SSH, SFTP, tunnels, clusters — from the outside.

## AI Assistant panel

Press **Ctrl+Shift+A** (or right-click a terminal → **Automation ▸ AI Assistant**) to toggle the assistant panel.

- **Docked or detached**: the panel docks to the side of the workspace; a resize handle adjusts its width (persisted across restarts), and a detach button in its header moves it to its own window. Detached, it stays fully functional and **follows the active tab** — prompts always use the currently active session's connection and terminal context.
- **Prompt editor**: multi-line; **Enter** submits, **Shift+Enter** inserts a newline. Submitting is disabled while a response is still streaming.
- **Streaming responses** render as they arrive.
- **Copy actions**: right-click any response for **Copy** (plain text — selection if you have one, else the whole message), **Copy as Markdown** (always the full Markdown source), and **Copy as CSV** (extracts Markdown tables into RFC 4180 CSV, with fallbacks for bare pipe rows and space-aligned text). The same menu works in the detached window.

### Providers

Configure the model in **Settings → AI**:

| Provider | Notes |
| --- | --- |
| Ollama | Local models; set the Ollama URL (default `http://localhost:11434`) |
| OpenRouter | API key required |
| OpenAI | API key required |
| DeepSeek | API key required |

Provider, model name, and API key are all set in the same panel. The assistant, [Explain Command](#explain-command), error awareness, and idle summaries all use this configuration.

## Explain Command

Select any text in a terminal, right-click → **Automation ▸ Explain Command**. Bifrost asks the configured model to explain the command; when no model is configured (or unreachable), a built-in explanation library covers common commands, so the feature degrades gracefully rather than failing.

## Error awareness & idle summaries

The AI features also react to your session: detected errors are surfaced as badges, and idle sessions with meaningful output offer an on-demand AI summary you can save as a note. Both are described in [Observability & security](09-observability-security.md).

## MCP server

Bifrost ships a standalone [Model Context Protocol](https://modelcontextprotocol.io/) server (`src/mcp/`) that exposes your infrastructure to AI agents. It runs as its own Node process — independent of the Bifrost app — and reads Bifrost's database **read-only** via `sql.js`, so it can never modify your connections.

### What agents get

**42 tools** across nine domains:

| Domain | Tools | Examples |
| --- | --- | --- |
| Connections | 5 | `list_connections`, `get_connection`, `list_groups` |
| SSH | 3 | `ssh_connect`, `ssh_execute`, `ssh_disconnect` |
| Terminal | 4 | `terminal_create`, `terminal_execute`, `terminal_read_buffer` |
| SFTP | 8 | `sftp_read_file`, `sftp_write_file`, `sftp_list_directory` |
| Clusters | 2 | `cluster_execute`, `cluster_multi_host_diff` |
| Tunnels | 4 | `tunnel_start`, `tunnel_stop`, `tunnel_create_adhoc` |
| Discovery | 8 | `discover_aws`, `discover_docker`, `discover_kubernetes` |
| Automation | 6 | `list_snippets`, `execute_script`, `resolve_variables` |
| Observability | 2 | `audit_query`, `health_ping` |

Plus **9 resources** under `bifrost://` URIs (`bifrost://connections`, `bifrost://groups`, `bifrost://clusters`, `bifrost://tunnels`, `bifrost://audit/recent`, `bifrost://snippets`, `bifrost://scripts`, `bifrost://variables`, `bifrost://commands`) and **8 prompt templates** for guided workflows (troubleshoot a connection, deploy to a cluster, set up a tunnel, discover infrastructure, security audit, server migration, incident response, bulk configuration).

### Setup with Claude Code

From the Bifrost source tree:

```bash
pnpm mcp:install
```

This registers the server in `~/.claude/settings.json` and makes a `/bifrost` skill available in Claude Code. To configure any MCP client manually:

```json
{
  "mcpServers": {
    "bifrost": {
      "command": "npx",
      "args": ["tsx", "<path-to-bifrost>/src/mcp/index.ts"]
    }
  }
}
```

### Transports

- **stdio** (default) — for local agents like Claude Code: `pnpm mcp:dev`.
- **Streamable HTTP** on port **3100** — for remote or multi-client access: `pnpm mcp:http`. Requests must carry a Bearer token (`BIFROST_MCP_TOKEN` environment variable); only `/health` is public.

### Security model

- **Destructive-command filter**: every command-executing tool passes through a filter that blocks critical operations (`rm -rf /`, `DROP TABLE`, fork bombs, `mkfs`, `dd if=/dev/zero`, …) and prefixes a warning on risky ones (`chmod 777`, `curl | sh`, `shutdown`). The filter is regex-based — treat it as a seatbelt, not a sandbox.
- **Read-only database**: the server cannot create or modify connections.
- **Credential boundary, by design**: the MCP server **cannot decrypt credentials stored by Bifrost** — `safeStorage` is bound to the Electron app's keychain context. Agents authenticate SSH via (1) key files read from disk, (2) the SSH agent, or (3) an explicit `password` parameter on `ssh_connect`. Your stored passwords never leave the app.

Architecture details and the full tool inventory live in [`docs/MCP_ARCHITECTURE.md`](../MCP_ARCHITECTURE.md).

## Not available yet

Nothing major is missing in this area. Two honest caveats: MCP sessions live in the server process (a restart drops active SSH/terminal sessions), and the planned per-level tool permission system is not enforced yet — all 42 tools are available to any connected agent.

> Source specs: `openspec/specs/ai-assistant/spec.md`, `openspec/specs/mcp-integration/spec.md`, `openspec/specs/session-observability/spec.md` — documentation reflects the implementation as of v0.3.x.
