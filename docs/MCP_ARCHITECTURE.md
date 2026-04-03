# Bifrost MCP Server — Architecture Guide

## Overview

The Bifrost MCP server exposes infrastructure management capabilities to AI agents via the Model Context Protocol. It runs as a **standalone Node.js process** separate from the Electron app, communicating with Bifrost's data through direct SQLite access.

```
┌───────────────────────────────┐
│  AI Client                    │
│  (Claude Code, Cursor, etc.)  │
└──────────┬────────────────────┘
           │ stdio or Streamable HTTP
┌──────────▼────────────────────┐
│  bifrost-mcp v1.0.0           │
│  (standalone Node.js process) │
│                               │
│  42 Tools │ 9 Resources       │
│  8 Prompts │ Security Filter  │
│                               │
│  ┌─────────────────────────┐  │
│  │ sql.js (pure JS SQLite) │──┼──→ ~/.config/bifrost/bifrost.db (read-only)
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │ ssh2 (pure JS)          │──┼──→ Remote SSH servers
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │ node-pty (native)       │──┼──→ Local terminal sessions
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

## Key Architectural Decisions

### 1. Standalone Process (not embedded in Electron)

**Decision**: The MCP server is a separate Node.js process, not part of the Electron main process.

**Why**:
- MCP clients (Claude Code, Cursor) spawn processes via stdio — they can't attach to a running Electron app
- Electron's sandboxed environment adds complexity for a server role
- Separation allows running the MCP server without the GUI (headless mode)
- No risk of the MCP server crashing the Electron app

**Trade-off**: Cannot reuse Electron's live SSH sessions or decrypt safeStorage credentials. The MCP server manages its own sessions.

### 2. sql.js over better-sqlite3

**Decision**: Use `sql.js` (pure JavaScript SQLite via WASM) instead of `better-sqlite3` (native C++ bindings).

**Why**: `better-sqlite3` is compiled against Electron's Node ABI. When the MCP server runs under system Node.js (different ABI version), it crashes with `ERR_DLOPEN_FAILED`. sql.js has zero native dependencies.

**Trade-offs**:
| Aspect | sql.js | better-sqlite3 |
|--------|--------|----------------|
| ABI compatibility | Any Node version | Must match compiled version |
| Initialization | Async (WASM load) | Sync |
| Performance | Slower (WASM overhead) | Fast (native) |
| Memory | Loads entire DB into RAM | Memory-mapped |
| Write support | Read-write possible but fragile | Full ACID |
| DB size limit | ~100MB practical | Unlimited |

**When this breaks**: If Bifrost's DB grows beyond ~100MB, or if write access is needed (currently read-only), this decision should be revisited. Consider a Unix socket bridge to the Electron process as an alternative.

### 3. Own SSH/Terminal Sessions

**Decision**: The MCP server creates its own SSH connections and PTY sessions, independent of the Bifrost UI.

**Why**:
- No IPC bridge needed to the Electron process
- Sessions are fully controlled by the MCP server lifecycle
- Simpler architecture with fewer moving parts

**Implication**: If you open a connection in Bifrost's UI AND via the MCP server, they are separate sessions. The MCP server cannot send commands to terminals visible in the UI.

### 4. Cross-Tool Session Access via `__sessions`

**Pattern**: SSH sessions are stored in a `Map` in `ssh.tools.ts` and exported as `__sessions` for other modules (SFTP, cluster) to access.

```typescript
// ssh.tools.ts
const sessions = new Map<string, ManagedSshSession>()
export const __sessions = sessions

// sftp.tools.ts
import { __sessions as sshSessions } from './ssh.tools'
```

**Why**: SFTP is an SSH subsystem — you need the SSH `Client` object to open an SFTP channel. Direct map access avoids creating a service layer for what is a simple lookup.

**Risk**: Tight coupling. Changes to the session map structure break SFTP and cluster tools silently.

### 5. Dual Transport (stdio + HTTP)

**Decision**: Support both transports, selected via environment variable.

| Transport | Use Case | Config |
|-----------|----------|--------|
| **stdio** (default) | Claude Code, Cursor, local AI tools | `npx tsx src/mcp/index.ts` |
| **HTTP** | Remote access, multi-client, headless servers | `BIFROST_MCP_HTTP=1` |

HTTP transport includes:
- Bearer token authentication (`BIFROST_MCP_TOKEN`)
- CORS headers for browser clients
- Public `/health` endpoint (no auth required)
- Streamable HTTP (SSE) for long-running operations

## Security Model

### Command Filter

All tools that execute commands (`ssh_execute`, `terminal_execute`, `execute_snippet`, `cluster_execute`) pass through `security/command-filter.ts`:

| Severity | Action | Examples |
|----------|--------|----------|
| **critical** | Blocked, returns error | `rm -rf /`, fork bombs, `DROP TABLE`, `mkfs`, `dd if=/dev/zero` |
| **warning** | Allowed with warning prefix | `chmod 777`, `curl | sh`, `shutdown`, `reboot` |

**Limitation**: Regex-based detection has false positives/negatives. It cannot detect obfuscated commands (`$(echo cm0gLXJm | base64 -d)`).

### Credential Boundary

The MCP server intentionally **cannot** decrypt Bifrost's credential vault (safeStorage). Authentication options:

1. **SSH key files** — MCP reads key files directly from disk (path from connection config)
2. **SSH agent** — Falls back to SSH agent if no key/password specified
3. **Explicit password** — User provides password as tool parameter (not stored)

### Security Levels (Planned, Not Enforced)

| Level | Access | Tools |
|-------|--------|-------|
| 0 | Read-only | list_*, get_*, audit_query, health_ping |
| 1 | Execute | ssh_execute, terminal_execute, discover_*, tunnel_start |
| 2 | Mutate | sftp_write_file, cluster_execute, sftp_delete, tunnel_create_adhoc |

Currently all tools are registered regardless of level. Future: add `BIFROST_MCP_SECURITY_LEVEL` env var.

## Tool Inventory (42 tools)

### Connections (5)
| Tool | Level | Description |
|------|-------|-------------|
| `list_connections` | 0 | List saved connections (filter by group/protocol) |
| `get_connection` | 0 | Get connection details by ID |
| `list_groups` | 0 | List connection groups |
| `list_clusters` | 0 | List clusters with members |
| `list_active_sessions` | 0 | Show active MCP-managed sessions |

### SSH (3)
| Tool | Level | Description |
|------|-------|-------------|
| `ssh_connect` | 1 | Connect by connection ID or direct host/port/user |
| `ssh_execute` | 1 | Execute command, return stdout/stderr/exitCode |
| `ssh_disconnect` | 1 | Close SSH session |

### Terminal (4)
| Tool | Level | Description |
|------|-------|-------------|
| `terminal_create` | 1 | Create local PTY session |
| `terminal_execute` | 1 | Execute command (with or without session) |
| `terminal_read_buffer` | 0 | Read terminal output buffer |
| `terminal_destroy` | 1 | Close terminal session |

### SFTP (8)
| Tool | Level | Description |
|------|-------|-------------|
| `sftp_open` | 1 | Open SFTP channel on SSH session |
| `sftp_list_directory` | 1 | List remote directory |
| `sftp_read_file` | 1 | Read remote file (max 1MB) |
| `sftp_stat` | 0 | Get file metadata |
| `sftp_write_file` | 2 | Write content to remote file |
| `sftp_mkdir` | 2 | Create remote directory |
| `sftp_delete` | 2 | Delete remote file/directory |
| `sftp_rename` | 2 | Rename/move remote file |

### Clusters (2)
| Tool | Level | Description |
|------|-------|-------------|
| `cluster_execute` | 2 | Execute command on all cluster members in parallel |
| `cluster_multi_host_diff` | 1 | Compare command output across N hosts |

### Tunnels (4)
| Tool | Level | Description |
|------|-------|-------------|
| `tunnel_list` | 0 | List configured + active tunnels |
| `tunnel_start` | 1 | Start saved Bifrost tunnel |
| `tunnel_stop` | 1 | Stop active tunnel |
| `tunnel_create_adhoc` | 2 | Create temporary tunnel |

### Discovery (8)
| Tool | Level | Description |
|------|-------|-------------|
| `discover_available` | 0 | Check installed CLIs |
| `discover_aws` | 1 | EC2 instances |
| `discover_gcp` | 1 | GCP Compute VMs |
| `discover_azure` | 1 | Azure VMs |
| `discover_docker` | 1 | Docker containers |
| `discover_kubernetes` | 1 | K8s pods |
| `discover_terraform` | 1 | Parse .tfstate files |
| `discover_all` | 1 | Unified cross-provider scan |

### Automation (6)
| Tool | Level | Description |
|------|-------|-------------|
| `list_snippets` | 0 | List DevOps command snippets |
| `execute_snippet` | 1 | Run snippet with variable substitution |
| `list_scripts` | 0 | List JavaScript scripts |
| `execute_script` | 1 | Execute JS in sandbox |
| `list_variables` | 0 | List global template variables |
| `resolve_variables` | 0 | Resolve template variables in string |

### Observability (2)
| Tool | Level | Description |
|------|-------|-------------|
| `audit_query` | 0 | Query audit log |
| `health_ping` | 0 | Ping host for reachability |

## Resources (9)

| URI | Description |
|-----|-------------|
| `bifrost://connections` | All saved connections (safe fields only) |
| `bifrost://groups` | Connection group hierarchy |
| `bifrost://clusters` | Cluster definitions |
| `bifrost://tunnels` | Tunnel configurations |
| `bifrost://audit/recent` | Last 50 audit events |
| `bifrost://snippets` | DevOps command snippets |
| `bifrost://scripts` | JavaScript automation scripts |
| `bifrost://variables` | Global template variables (passwords masked) |
| `bifrost://commands` | Quick remote commands |

## Prompts (8)

| Name | Description |
|------|-------------|
| `troubleshoot_connection` | Diagnose SSH issues with audit context |
| `deploy_to_cluster` | Guided cluster deployment with pre-flight checks |
| `setup_tunnel` | Step-by-step tunnel creation |
| `discover_infrastructure` | Full cloud inventory scan |
| `security_audit` | Audit SSH security configuration |
| `migrate_server` | Server migration plan with inventory |
| `incident_response` | Incident triage runbook |
| `bulk_configuration` | Configure multiple servers simultaneously |

## File Structure

```
src/mcp/
├── index.ts                    # Entry point, transport selection
├── db.ts                       # sql.js database access
├── types.ts                    # Shared TypeScript types
├── transport/
│   └── http.ts                 # Streamable HTTP transport + auth
├── tools/
│   ├── connections.tools.ts    # 5 tools
│   ├── ssh.tools.ts            # 3 tools + session management
│   ├── terminal.tools.ts       # 4 tools
│   ├── sftp.tools.ts           # 8 tools
│   ├── cluster.tools.ts        # 2 tools
│   ├── tunnels.tools.ts        # 4 tools
│   ├── discovery.tools.ts      # 8 tools
│   ├── automation.tools.ts     # 6 tools
│   └── observability.tools.ts  # 2 tools
├── resources/
│   └── bifrost.resources.ts    # 9 resources
├── prompts/
│   └── bifrost.prompts.ts      # 8 prompts
└── security/
    └── command-filter.ts       # Dangerous command detection
```

## Known Limitations

1. **Sessions are process-local** — MCP server restart loses all SSH/terminal sessions
2. **No credential vault access** — Cannot decrypt Bifrost's safeStorage passwords
3. **Database is read-only** — Cannot create/modify connections via MCP (by design)
4. **Security levels not enforced** — All 42 tools are always available
5. **PTY output detection is heuristic** — Polls buffer every 200ms, may miss fast output
6. **Command filter is regex-based** — Can be bypassed with obfuscation
7. **sql.js loads entire DB into memory** — Fine for Bifrost's small DB, won't scale to large DBs
