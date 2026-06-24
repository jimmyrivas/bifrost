# MCP Integration

## Purpose

Expose Bifrost's inventory and operations to AI agents through a standalone Model Context
Protocol server that reads the Bifrost database read-only. Implemented in `src/mcp/`;
architecture in `docs/MCP_ARCHITECTURE.md`. The server must not import `electron`.

## Requirements

### Requirement: MCP Tools, Resources, and Prompts

The system SHALL expose Bifrost capabilities as MCP tools, resources (`bifrost://` URIs),
and prompt templates across connection, ssh, terminal, sftp, cluster, tunnels, discovery,
automation, and observability domains.

#### Scenario: List connections via MCP

- **WHEN** an agent calls a connection-listing MCP tool
- **THEN** the server returns connections read from the Bifrost database

#### Scenario: Read a resource

- **WHEN** an agent reads a `bifrost://` resource URI
- **THEN** the server returns the corresponding data

### Requirement: Read-Only Database Access via sql.js

The system SHALL read the Bifrost database using `sql.js` (WASM SQLite) so the MCP server
runs under system Node without native-ABI conflicts, and SHALL NOT write to the database.

#### Scenario: Open the database under system Node

- **WHEN** the MCP server starts under system Node
- **THEN** it loads the database via `sql.js` without an `ERR_DLOPEN_FAILED` crash

### Requirement: Transports and Authentication

The system SHALL support stdio and Streamable HTTP transports, with Bearer-token
authentication on the HTTP transport.

#### Scenario: stdio transport

- **WHEN** the server is launched in stdio mode
- **THEN** it serves MCP over stdio for a local agent

#### Scenario: Authenticated HTTP

- **WHEN** an HTTP request omits or presents an invalid Bearer token
- **THEN** the server SHALL reject the request

### Requirement: SSH Auth Without Decrypting Bifrost Credentials

The system SHALL authenticate SSH operations using key files, agent forwarding, or an
explicit `password` parameter, since it cannot decrypt credentials stored by the Electron
main process.

#### Scenario: Connect with an explicit password

- **WHEN** an agent calls `ssh_connect` with a `password` parameter
- **THEN** the server authenticates using that password rather than the Bifrost vault

### Requirement: Destructive Command Filtering

The system SHALL block destructive operations (e.g. `rm -rf /`, `DROP TABLE`, fork bombs)
through a command filter before executing agent-requested commands.

#### Scenario: Block a destructive command

- **WHEN** an agent requests a command matching the destructive filter
- **THEN** the server refuses to execute it
