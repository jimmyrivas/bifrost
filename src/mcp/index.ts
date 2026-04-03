#!/usr/bin/env node
/**
 * Bifrost MCP Server
 *
 * Standalone MCP server that exposes Bifrost's infrastructure management
 * capabilities to AI agents (Claude, Cursor, etc.) via the Model Context Protocol.
 *
 * Usage:
 *   npx tsx src/mcp/index.ts                  # stdio transport (default)
 *   BIFROST_MCP_HTTP=1 npx tsx src/mcp/index.ts  # HTTP transport on port 3100
 *   BIFROST_MCP_HTTP=1 BIFROST_MCP_PORT=8080 BIFROST_MCP_TOKEN=secret npx tsx src/mcp/index.ts
 *
 * Configure in Claude Code settings.json (stdio):
 *   {
 *     "mcpServers": {
 *       "bifrost": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/bifrost/src/mcp/index.ts"]
 *       }
 *     }
 *   }
 *
 * Configure for remote HTTP access:
 *   {
 *     "mcpServers": {
 *       "bifrost": {
 *         "url": "http://localhost:3100/mcp",
 *         "headers": { "Authorization": "Bearer <token>" }
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { openDatabase, closeDb, getDbPath } from './db'
import { registerConnectionTools } from './tools/connections.tools'
import { registerSshTools, cleanupAllSshSessions } from './tools/ssh.tools'
import { registerTerminalTools, cleanupAllTerminalSessions } from './tools/terminal.tools'
import { registerSftpTools, cleanupAllSftpSessions } from './tools/sftp.tools'
import { registerObservabilityTools } from './tools/observability.tools'
import { registerClusterTools } from './tools/cluster.tools'
import { registerTunnelTools, cleanupAllTunnels } from './tools/tunnels.tools'
import { registerDiscoveryTools } from './tools/discovery.tools'
import { registerAutomationTools } from './tools/automation.tools'
import { registerResources } from './resources/bifrost.resources'
import { registerPrompts } from './prompts/bifrost.prompts'
import { existsSync } from 'fs'

const SERVER_NAME = 'bifrost-mcp'
const SERVER_VERSION = '1.0.0'

async function main(): Promise<void> {
  // Verify Bifrost database exists before starting
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) {
    console.error(`[${SERVER_NAME}] Bifrost database not found at: ${dbPath}`)
    console.error(`[${SERVER_NAME}] Please run Bifrost at least once to initialize the database.`)
    process.exit(1)
  }

  // Open database connection (async for sql.js WASM initialization)
  try {
    await openDatabase()
  } catch (err) {
    console.error(`[${SERVER_NAME}] Failed to open database:`, err)
    process.exit(1)
  }

  // Create the MCP server
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  })

  // Register all tools (42)
  registerConnectionTools(server)
  registerSshTools(server)
  registerTerminalTools(server)
  registerSftpTools(server)
  registerObservabilityTools(server)
  registerClusterTools(server)
  registerTunnelTools(server)
  registerDiscoveryTools(server)
  registerAutomationTools(server)

  // Register all resources (9)
  registerResources(server)

  // Register all prompt templates (8)
  registerPrompts(server)

  // Cleanup on exit
  const cleanup = (): void => {
    cleanupAllTunnels()
    cleanupAllSshSessions()
    cleanupAllTerminalSessions()
    cleanupAllSftpSessions()
    closeDb()
  }

  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })
  process.on('exit', cleanup)

  // Choose transport based on environment
  const useHttp = process.env.BIFROST_MCP_HTTP === '1' || process.env.BIFROST_MCP_HTTP === 'true'

  if (useHttp) {
    const { createHttpTransport } = await import('./transport/http')
    const port = parseInt(process.env.BIFROST_MCP_PORT ?? '3100', 10)
    const host = process.env.BIFROST_MCP_HOST ?? '127.0.0.1'
    const token = process.env.BIFROST_MCP_TOKEN

    const { transport, start } = createHttpTransport({ port, host, token })
    await server.connect(transport)
    await start()

    console.error(`[${SERVER_NAME}] v${SERVER_VERSION} started (HTTP transport)`)
    console.error(`[${SERVER_NAME}] Listening: http://${host}:${port}/mcp`)
    console.error(`[${SERVER_NAME}] Health:    http://${host}:${port}/health`)
    if (token) {
      console.error(`[${SERVER_NAME}] Auth:      Bearer token required`)
    } else {
      console.error(`[${SERVER_NAME}] Auth:      NONE (set BIFROST_MCP_TOKEN for security)`)
    }
  } else {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error(`[${SERVER_NAME}] v${SERVER_VERSION} started (stdio transport)`)
  }

  console.error(`[${SERVER_NAME}] Database: ${dbPath}`)
  console.error(`[${SERVER_NAME}] Tools: 42 | Resources: 9 | Prompts: 8`)
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, err)
  process.exit(1)
})
