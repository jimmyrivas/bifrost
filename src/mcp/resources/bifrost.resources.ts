/**
 * MCP Resources: Read-only data exposed by Bifrost
 * Security Level: 0 (all resources are read-only)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listConnections, getConnection, listGroups, listClusters, listTunnels, queryAuditLog, listSnippets, listScripts, listGlobalVariables, listRemoteCommands } from '../db'

export function registerResources(server: McpServer): void {
  // Static resource: all connections
  server.resource(
    'connections-list',
    'bifrost://connections',
    {
      description: 'List of all saved connections in Bifrost',
      mimeType: 'application/json'
    },
    async () => {
      const connections = listConnections()
      const safe = connections.map((c) => ({
        id: c.id,
        name: c.name,
        method: c.method,
        host: c.host,
        port: c.port,
        username: c.username,
        groupId: c.groupId,
        networkMode: c.networkMode
      }))
      return {
        contents: [
          {
            uri: 'bifrost://connections',
            mimeType: 'application/json',
            text: JSON.stringify(safe, null, 2)
          }
        ]
      }
    }
  )

  // Static resource: all groups
  server.resource(
    'groups-list',
    'bifrost://groups',
    {
      description: 'Connection group hierarchy in Bifrost',
      mimeType: 'application/json'
    },
    async () => {
      const groups = listGroups()
      return {
        contents: [
          {
            uri: 'bifrost://groups',
            mimeType: 'application/json',
            text: JSON.stringify(groups, null, 2)
          }
        ]
      }
    }
  )

  // Static resource: clusters
  server.resource(
    'clusters-list',
    'bifrost://clusters',
    {
      description: 'Defined clusters for parallel command execution',
      mimeType: 'application/json'
    },
    async () => {
      const clusters = listClusters()
      return {
        contents: [
          {
            uri: 'bifrost://clusters',
            mimeType: 'application/json',
            text: JSON.stringify(clusters, null, 2)
          }
        ]
      }
    }
  )

  // Static resource: tunnels
  server.resource(
    'tunnels-list',
    'bifrost://tunnels',
    {
      description: 'Configured SSH tunnels',
      mimeType: 'application/json'
    },
    async () => {
      const tunnels = listTunnels()
      const safe = tunnels.map((t) => ({
        id: t.id,
        name: t.name,
        host: t.host,
        port: t.port,
        username: t.username,
        forwards: JSON.parse(t.forwards),
        autoStart: t.autoStart
      }))
      return {
        contents: [
          {
            uri: 'bifrost://tunnels',
            mimeType: 'application/json',
            text: JSON.stringify(safe, null, 2)
          }
        ]
      }
    }
  )

  // Static resource: recent audit events
  server.resource(
    'audit-recent',
    'bifrost://audit/recent',
    {
      description: 'Most recent 50 audit events (connections, auth, errors)',
      mimeType: 'application/json'
    },
    async () => {
      const events = queryAuditLog({ limit: 50 })
      return {
        contents: [
          {
            uri: 'bifrost://audit/recent',
            mimeType: 'application/json',
            text: JSON.stringify(events, null, 2)
          }
        ]
      }
    }
  )

  // --- Phase 3 resources ---

  server.resource(
    'snippets-list',
    'bifrost://snippets',
    {
      description: 'DevOps command snippets with variable placeholders',
      mimeType: 'application/json'
    },
    async () => {
      const snippets = listSnippets()
      return {
        contents: [
          {
            uri: 'bifrost://snippets',
            mimeType: 'application/json',
            text: JSON.stringify(snippets, null, 2)
          }
        ]
      }
    }
  )

  server.resource(
    'scripts-list',
    'bifrost://scripts',
    {
      description: 'Custom JavaScript automation scripts',
      mimeType: 'application/json'
    },
    async () => {
      const scripts = listScripts()
      const safe = scripts.map((s) => ({ id: s.id, name: s.name, description: s.description, trigger: s.trigger }))
      return {
        contents: [
          {
            uri: 'bifrost://scripts',
            mimeType: 'application/json',
            text: JSON.stringify(safe, null, 2)
          }
        ]
      }
    }
  )

  server.resource(
    'variables-list',
    'bifrost://variables',
    {
      description: 'Global template variables (password values masked)',
      mimeType: 'application/json'
    },
    async () => {
      const vars = listGlobalVariables()
      const safe = vars.map((v) => ({ name: v.name, value: v.isPassword ? '********' : v.value }))
      return {
        contents: [
          {
            uri: 'bifrost://variables',
            mimeType: 'application/json',
            text: JSON.stringify(safe, null, 2)
          }
        ]
      }
    }
  )

  server.resource(
    'remote-commands-list',
    'bifrost://commands',
    {
      description: 'Quick remote commands (global and per-connection)',
      mimeType: 'application/json'
    },
    async () => {
      const commands = listRemoteCommands()
      return {
        contents: [
          {
            uri: 'bifrost://commands',
            mimeType: 'application/json',
            text: JSON.stringify(commands, null, 2)
          }
        ]
      }
    }
  )
}
