# Bifrost MCP Server — Design Plan

## Vision

Transform Bifrost into an **AI-native infrastructure platform** — not just another SSH MCP server, but the complete bridge between an LLM and all infrastructure Bifrost manages: connections, credentials, tunnels, clusters, SFTP, cloud discovery, scripts, expect automation, and more.

**Key differentiator** vs existing servers (mcp-ssh-manager, ssh-mcp-sessions, etc.): Bifrost already has 90% of the work done — connection manager with 200+ IPC channels, credential vault, session multiplexing, cluster broadcast, cloud discovery. Others start from zero.

## Architecture

```
┌──────────────────────────────────────┐
│  AI Client (Claude, Cursor, etc.)    │
└──────────────┬───────────────────────┘
               │ stdio / Streamable HTTP
┌──────────────▼───────────────────────┐
│  bifrost-mcp-server                  │
│  (standalone Node process)           │
│                                      │
│  ┌─────────┐ ┌──────────┐ ┌───────┐ │
│  │  Tools  │ │Resources │ │Prompts│ │
│  │  (42+)  │ │  (12+)   │ │ (8+)  │ │
│  └────┬────┘ └────┬─────┘ └───┬───┘ │
│       └───────────┼───────────┘     │
│                   ▼                  │
│         IPC Bridge Layer             │
│    (Electron IPC / Unix Socket)      │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│  Bifrost Electron App (main process) │
│  ┌──────────────────────────────┐    │
│  │  Existing IPC Handlers (23)  │    │
│  │  Services (30+)              │    │
│  │  SQLite DB (Drizzle ORM)     │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

### Transport Modes

| Mode | Use Case | Transport |
|------|----------|-----------|
| **Embedded** | Bifrost running, local AI | stdio (spawned by Claude Code/Cursor) |
| **Remote** | Bifrost as headless service | Streamable HTTP + auth tokens |

## MCP Primitives

### Tools (42+)

#### Connections & Sessions
| Tool | Description |
|------|-------------|
| `list_connections` | List all connections with filters (group, protocol, tags) |
| `get_connection` | Get specific connection details |
| `create_connection` | Create new SSH/RDP/VNC/etc. connection |
| `ssh_connect` | Establish SSH connection to a host |
| `ssh_execute` | Execute command on SSH session, return stdout/stderr/exitCode |
| `ssh_interactive_shell` | Open interactive shell (streaming) |
| `ssh_disconnect` | Close SSH connection |
| `list_active_sessions` | List active sessions with state |

#### Local Terminal
| Tool | Description |
|------|-------------|
| `terminal_create` | Create local terminal |
| `terminal_execute` | Execute command in local terminal |
| `terminal_read_buffer` | Read current terminal buffer |
| `terminal_destroy` | Close terminal |

#### Cluster Operations
| Tool | Description |
|------|-------------|
| `cluster_list` | List defined clusters |
| `cluster_execute` | Execute command on ALL cluster members simultaneously |
| `cluster_execute_selective` | Execute on subset of members |
| `cluster_collect_results` | Collect parallel execution results |

#### File Transfer (SFTP)
| Tool | Description |
|------|-------------|
| `sftp_list_directory` | List remote directory |
| `sftp_read_file` | Read remote file (with size limit) |
| `sftp_write_file` | Write remote file |
| `sftp_upload` | Upload local file to remote |
| `sftp_download` | Download remote file to local |
| `sftp_stat` | Get file metadata |
| `sftp_mkdir` | Create remote directory |
| `sftp_delete` | Delete remote file/directory |

#### SSH Tunnels
| Tool | Description |
|------|-------------|
| `tunnel_create` | Create SSH tunnel (local/remote forward) |
| `tunnel_start` | Start tunnel |
| `tunnel_stop` | Stop tunnel |
| `tunnel_list_active` | List active tunnels with status |
| `tunnel_status` | Detailed tunnel status |

#### Infrastructure Discovery
| Tool | Description |
|------|-------------|
| `discover_aws` | Discover EC2 instances |
| `discover_gcp` | Discover GCP VMs |
| `discover_azure` | Discover Azure VMs |
| `discover_docker` | Discover Docker containers |
| `discover_kubernetes` | Discover K8s nodes/pods |
| `discover_terraform` | Parse Terraform state |
| `discover_available` | Which discovery CLIs are installed |

#### Automation
| Tool | Description |
|------|-------------|
| `execute_script` | Execute JavaScript script from script engine |
| `execute_snippet` | Execute DevOps command snippet |
| `run_expect_sequence` | Run expect sequence (automated login, MFA, etc.) |
| `resolve_variables` | Resolve template variables (`<IP>`, `<ENV:>`, `<GV:>`, etc.) |

#### Credential Access (with security gates)
| Tool | Description |
|------|-------------|
| `credential_resolve` | Resolve credential from configured vault (1Password/Bitwarden/Vault/AWS SM/Azure KV) |
| `credential_detect_managers` | List available password managers |

#### Observability
| Tool | Description |
|------|-------------|
| `audit_query` | Query audit log |
| `health_ping` | Check host reachability |
| `session_start_recording` | Start session recording (asciicast) |
| `session_stop_recording` | Stop recording |

### Resources (12+)

| URI Pattern | Content |
|------------|---------|
| `bifrost://connections` | Full connection list |
| `bifrost://connection/{id}` | Specific connection detail |
| `bifrost://groups` | Group tree |
| `bifrost://clusters` | Defined clusters |
| `bifrost://tunnels` | Configured tunnels |
| `bifrost://scripts` | Available scripts |
| `bifrost://snippets` | Command snippets |
| `bifrost://macros` | Defined macros |
| `bifrost://variables` | Global variables |
| `bifrost://audit/recent` | Last 50 audit events |
| `bifrost://session/{id}/buffer` | Active session buffer |
| `bifrost://preferences` | Bifrost configuration |

### Prompts (8+)

| Prompt | Description |
|--------|-------------|
| `troubleshoot_connection` | Diagnose SSH connection issues with context |
| `deploy_to_cluster` | Deployment guide to cluster with validation |
| `setup_tunnel` | Step-by-step SSH tunnel configuration |
| `discover_infrastructure` | Map complete cloud infrastructure |
| `security_audit` | Audit connection security configuration |
| `migrate_server` | Server migration plan |
| `incident_response` | Incident response runbook |
| `bulk_configuration` | Configure multiple servers simultaneously |

## Security — 3-Level Model

```
Level 0: READ-ONLY (default)
├── list_connections, get_connection, list_active_sessions
├── All resources (bifrost://*)
├── audit_query, health_ping
└── tunnel_list_active, cluster_list

Level 1: EXECUTE (requires explicit opt-in)
├── ssh_connect, ssh_execute, terminal_execute
├── sftp_read_file, sftp_list_directory
├── tunnel_start/stop
├── execute_snippet, execute_script
└── discover_* (cloud discovery)

Level 2: MUTATE (requires per-operation approval)
├── create_connection, sftp_write_file, sftp_delete
├── cluster_execute (broadcast to multiple hosts)
├── credential_resolve
├── tunnel_create/delete
└── ssh_interactive_shell
```

### Additional Controls
- **Command blacklist**: Block `rm -rf /`, `chmod 777`, `dd if=`, destructive patterns (reuse existing `dangerous-commands.ts`)
- **Rate limiting**: Max 60 tool calls/min, max 10 concurrent sessions
- **Audit trail**: Every tool call logged to existing audit-log
- **Session timeout**: Inactive SSH sessions auto-closed at 15min
- **Confirmation callback**: For Level 2, use MCP Elicitation for user confirmation

## Implementation Phases

### Phase 1: Core Foundation
- MCP server scaffold as separate module: `src/mcp/`
- IPC Bridge: communication between MCP server process and Electron main
- Working stdio transport
- 10 essential tools: `list_connections`, `ssh_connect`, `ssh_execute`, `ssh_disconnect`, `terminal_create`, `terminal_execute`, `sftp_list_directory`, `sftp_read_file`, `health_ping`, `list_active_sessions`
- 4 resources: `bifrost://connections`, `bifrost://connection/{id}`, `bifrost://groups`, `bifrost://audit/recent`
- Security Level 0 + 1

### Phase 2: Infrastructure Power
- Cluster tools: `cluster_execute`, `cluster_collect_results`
- Tunnel tools: `tunnel_create`, `tunnel_start`, `tunnel_stop`, `tunnel_list_active`
- Discovery tools: all `discover_*`
- SFTP write: `sftp_write_file`, `sftp_upload`, `sftp_download`, `sftp_mkdir`
- Security Level 2 with elicitation

### Phase 3: Automation & Intelligence
- Script execution tools
- Snippet execution
- Expect engine integration
- Variable resolution
- 8 prompt templates
- Credential resolution (with gates)

### Phase 4: Polish & Distribution
- Streamable HTTP transport (remote mode)
- Configuration via Bifrost settings UI (enable/disable MCP, security levels)
- Documentation
- npm package: `@bifrost/mcp-server`
- Registration in MCP server directory

## File Structure

```
src/mcp/
├── index.ts                    # Entry point, server setup
├── transport/
│   ├── stdio.ts                # stdio transport adapter
│   └── http.ts                 # Streamable HTTP adapter (Phase 4)
├── bridge/
│   └── ipc-bridge.ts           # Electron IPC <-> MCP bridge
├── tools/
│   ├── connections.tools.ts    # Connection management tools
│   ├── ssh.tools.ts            # SSH session tools
│   ├── terminal.tools.ts       # Local terminal tools
│   ├── cluster.tools.ts        # Cluster operations
│   ├── sftp.tools.ts           # File transfer tools
│   ├── tunnels.tools.ts        # SSH tunnel tools
│   ├── discovery.tools.ts      # Cloud discovery tools
│   ├── automation.tools.ts     # Scripts, snippets, expect
│   ├── credentials.tools.ts    # Credential access tools
│   └── observability.tools.ts  # Audit, health, recording
├── resources/
│   └── bifrost.resources.ts    # All resource definitions
├── prompts/
│   └── bifrost.prompts.ts      # All prompt templates
├── security/
│   ├── levels.ts               # Security level definitions
│   ├── command-filter.ts       # Dangerous command detection
│   └── rate-limiter.ts         # Rate limiting
└── types.ts                    # Shared types
```

## Creative Capabilities

### 1. Multi-Host Diff
Agent can execute the same command on N servers and get a comparative diff. Example: "compare nginx version across all production servers".

### 2. Infrastructure Snapshot
Combining discovery + ssh_execute, agent can create a complete infrastructure state snapshot (versions, uptime, disk usage, services) in a single tool call.

### 3. Automated Incident Response
With expect engine + cluster + scripts, an agent can execute a complete runbook: detect problem -> connect to server -> run diagnostics -> apply fix -> verify resolution.

### 4. Smart Tunnel Routing
Agent can create tunnel chains to access internal services that normally require VPN + bastion + manual port forwarding.

### 5. Session Replay Intelligence
Record sessions, then agent can "read" recordings to understand what was done on a server and suggest improvements or detect errors.

### 6. Cross-Cloud Inventory
A single tool call that discovers infrastructure across AWS + GCP + Azure + Docker + K8s and presents a unified inventory.

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.29.0",
  "zod": "^3.25.0"
}
```
