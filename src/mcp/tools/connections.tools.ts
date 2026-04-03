/**
 * MCP Tools: Connection management
 * Security Level: 0 (read-only)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listConnections, getConnection, listGroups, listClusters, getClusterMembers } from '../db'

export function registerConnectionTools(server: McpServer): void {
  server.tool(
    'list_connections',
    'List all saved connections in Bifrost. Can filter by group or protocol.',
    {
      groupId: z.string().optional().describe('Filter by group ID'),
      method: z
        .enum(['ssh', 'mosh', 'rdp', 'vnc', 'telnet', 'local', 'ftp'])
        .optional()
        .describe('Filter by connection protocol')
    },
    async ({ groupId, method }) => {
      const connections = listConnections({ groupId, method })
      const summary = connections.map((c) => ({
        id: c.id,
        name: c.name,
        method: c.method,
        host: c.host,
        port: c.port,
        username: c.username,
        groupId: c.groupId
      }))
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(summary, null, 2)
          }
        ]
      }
    }
  )

  server.tool(
    'get_connection',
    'Get full details of a specific connection by ID.',
    {
      connectionId: z.string().describe('The connection ID to look up')
    },
    async ({ connectionId }) => {
      const conn = getConnection(connectionId)
      if (!conn) {
        return {
          content: [{ type: 'text' as const, text: `Connection ${connectionId} not found` }],
          isError: true
        }
      }
      // Strip encrypted fields for safety
      const safe = { ...conn } as Record<string, unknown>
      delete safe.encryptedPassword
      delete safe.encryptedPassphrase
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(safe, null, 2) }]
      }
    }
  )

  server.tool(
    'list_groups',
    'List all connection groups (folders) in Bifrost.',
    {},
    async () => {
      const groups = listGroups()
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(groups, null, 2) }]
      }
    }
  )

  server.tool(
    'list_clusters',
    'List all defined clusters. A cluster groups multiple connections for parallel command execution.',
    {},
    async () => {
      const clusters = listClusters()
      const result = await Promise.all(
        clusters.map(async (c) => ({
          ...c,
          memberConnectionIds: getClusterMembers(c.id)
        }))
      )
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
      }
    }
  )

  server.tool(
    'list_active_sessions',
    'List all active SSH and terminal sessions managed by this MCP server instance.',
    {},
    async () => {
      // Import from the session registries
      const { getActiveSshSessions } = await import('./ssh.tools')
      const { getActiveTerminalSessions } = await import('./terminal.tools')
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                ssh: getActiveSshSessions(),
                terminal: getActiveTerminalSessions()
              },
              null,
              2
            )
          }
        ]
      }
    }
  )
}
