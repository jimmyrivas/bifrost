/**
 * MCP Tools: SSH tunnel management
 * Security Level: 1 (start/stop), 2 (create/delete)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { Client } from 'ssh2'
import { createServer, type Server } from 'net'
import { readFileSync, existsSync } from 'fs'
import { listTunnels } from '../db'

interface ActiveTunnel {
  id: string
  name: string
  host: string
  port: number
  username: string
  client: Client
  forwards: ActiveForward[]
  startedAt: string
}

interface ActiveForward {
  type: 'local' | 'remote'
  localPort: number
  remoteHost: string
  remotePort: number
  server?: Server
  connections: number
}

const activeTunnels = new Map<string, ActiveTunnel>()

export function getActiveTunnelsList(): Array<{
  id: string
  name: string
  host: string
  startedAt: string
  forwards: Array<{ type: string; localPort: number; remoteHost: string; remotePort: number; connections: number }>
}> {
  return Array.from(activeTunnels.values()).map((t) => ({
    id: t.id,
    name: t.name,
    host: `${t.username}@${t.host}:${t.port}`,
    startedAt: t.startedAt,
    forwards: t.forwards.map((f) => ({
      type: f.type,
      localPort: f.localPort,
      remoteHost: f.remoteHost,
      remotePort: f.remotePort,
      connections: f.connections
    }))
  }))
}

export function cleanupAllTunnels(): void {
  for (const [id, tunnel] of activeTunnels) {
    for (const fwd of tunnel.forwards) {
      fwd.server?.close()
    }
    try { tunnel.client.end() } catch { /* ignore */ }
    activeTunnels.delete(id)
  }
}

export function registerTunnelTools(server: McpServer): void {
  server.tool(
    'tunnel_list',
    'List all configured SSH tunnels from Bifrost, plus any currently active tunnels managed by this MCP session.',
    {},
    async () => {
      const configured = listTunnels()
      const active = getActiveTunnelsList()

      const configuredSafe = configured.map((t) => ({
        id: t.id,
        name: t.name,
        host: t.host,
        port: t.port,
        username: t.username,
        forwards: JSON.parse(t.forwards),
        autoStart: t.autoStart
      }))

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ configured: configuredSafe, active }, null, 2)
          }
        ]
      }
    }
  )

  server.tool(
    'tunnel_start',
    'Start an SSH tunnel by its Bifrost tunnel ID. Establishes the SSH connection and sets up port forwards.',
    {
      tunnelId: z.string().describe('Tunnel ID from tunnel_list'),
      password: z.string().optional().describe('SSH password if needed (key-based auth preferred)')
    },
    async ({ tunnelId, password }) => {
      if (activeTunnels.has(tunnelId)) {
        return {
          content: [{ type: 'text' as const, text: `Tunnel ${tunnelId} is already active` }],
          isError: true
        }
      }

      const tunnels = listTunnels()
      const tunnel = tunnels.find((t) => t.id === tunnelId)
      if (!tunnel) {
        return {
          content: [{ type: 'text' as const, text: `Tunnel ${tunnelId} not found` }],
          isError: true
        }
      }

      try {
        const client = new Client()
        const connectConfig: Record<string, unknown> = {
          host: tunnel.host,
          port: tunnel.port,
          username: tunnel.username ?? '',
          readyTimeout: 15000
        }

        if (tunnel.privateKeyPath && existsSync(tunnel.privateKeyPath)) {
          connectConfig.privateKey = readFileSync(tunnel.privateKeyPath)
        } else if (password) {
          connectConfig.password = password
        }

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Connection timeout')), 15000)
          client.on('ready', () => { clearTimeout(timer); resolve() })
          client.on('error', (err) => { clearTimeout(timer); reject(err) })
          client.connect(connectConfig as Parameters<Client['connect']>[0])
        })

        // Parse and establish forwards
        const forwardConfigs = JSON.parse(tunnel.forwards) as Array<{
          type: 'local' | 'remote' | 'dynamic'
          localPort: number
          remoteHost?: string
          remotePort?: number
        }>

        const activeForwards: ActiveForward[] = []

        for (const fwd of forwardConfigs) {
          if (fwd.type === 'local') {
            const forward = await setupLocalForward(
              client,
              fwd.localPort,
              fwd.remoteHost ?? '127.0.0.1',
              fwd.remotePort ?? fwd.localPort
            )
            activeForwards.push(forward)
          }
          // Remote forwards would go here in Phase 3+
        }

        activeTunnels.set(tunnelId, {
          id: tunnelId,
          name: tunnel.name,
          host: tunnel.host,
          port: tunnel.port,
          username: tunnel.username ?? '',
          client,
          forwards: activeForwards,
          startedAt: new Date().toISOString()
        })

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                tunnelId,
                name: tunnel.name,
                status: 'active',
                forwards: activeForwards.map((f) => ({
                  type: f.type,
                  local: f.localPort,
                  remote: `${f.remoteHost}:${f.remotePort}`
                }))
              }, null, 2)
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to start tunnel: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'tunnel_stop',
    'Stop an active SSH tunnel.',
    {
      tunnelId: z.string().describe('Tunnel ID to stop')
    },
    async ({ tunnelId }) => {
      const tunnel = activeTunnels.get(tunnelId)
      if (!tunnel) {
        return {
          content: [{ type: 'text' as const, text: `Tunnel ${tunnelId} is not active` }],
          isError: true
        }
      }

      for (const fwd of tunnel.forwards) {
        fwd.server?.close()
      }
      try { tunnel.client.end() } catch { /* ignore */ }
      activeTunnels.delete(tunnelId)

      return {
        content: [
          { type: 'text' as const, text: `Tunnel ${tunnel.name} (${tunnelId}) stopped` }
        ]
      }
    }
  )

  server.tool(
    'tunnel_create_adhoc',
    'Create and start an ad-hoc SSH tunnel without saving it to Bifrost config. Useful for temporary port forwards.',
    {
      host: z.string().describe('SSH host for the tunnel'),
      port: z.number().default(22).optional().describe('SSH port'),
      username: z.string().describe('SSH username'),
      privateKeyPath: z.string().optional().describe('Path to SSH private key'),
      password: z.string().optional().describe('SSH password'),
      localPort: z.number().describe('Local port to listen on'),
      remoteHost: z.string().default('127.0.0.1').optional().describe('Remote host to forward to'),
      remotePort: z.number().describe('Remote port to forward to')
    },
    async ({ host, port, username, privateKeyPath, password, localPort, remoteHost, remotePort }) => {
      const tunnelId = `adhoc-${Date.now()}`

      try {
        const client = new Client()
        const connectConfig: Record<string, unknown> = {
          host,
          port: port ?? 22,
          username,
          readyTimeout: 15000
        }

        if (privateKeyPath && existsSync(privateKeyPath)) {
          connectConfig.privateKey = readFileSync(privateKeyPath)
        } else if (password) {
          connectConfig.password = password
        }

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Connection timeout')), 15000)
          client.on('ready', () => { clearTimeout(timer); resolve() })
          client.on('error', (err) => { clearTimeout(timer); reject(err) })
          client.connect(connectConfig as Parameters<Client['connect']>[0])
        })

        const rHost = remoteHost ?? '127.0.0.1'
        const forward = await setupLocalForward(client, localPort, rHost, remotePort)

        activeTunnels.set(tunnelId, {
          id: tunnelId,
          name: `adhoc ${localPort} → ${rHost}:${remotePort}`,
          host,
          port: port ?? 22,
          username,
          client,
          forwards: [forward],
          startedAt: new Date().toISOString()
        })

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                tunnelId,
                status: 'active',
                forward: `localhost:${localPort} → ${rHost}:${remotePort} via ${username}@${host}`
              }, null, 2)
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to create tunnel: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )
}

/**
 * Set up a local port forward: listen on localPort, forward via SSH to remoteHost:remotePort
 */
function setupLocalForward(
  client: Client,
  localPort: number,
  remoteHost: string,
  remotePort: number
): Promise<ActiveForward> {
  return new Promise((resolve, reject) => {
    const forward: ActiveForward = {
      type: 'local',
      localPort,
      remoteHost,
      remotePort,
      connections: 0
    }

    const srv = createServer((socket) => {
      forward.connections++
      client.forwardOut('127.0.0.1', localPort, remoteHost, remotePort, (err, stream) => {
        if (err) {
          socket.end()
          forward.connections--
          return
        }
        socket.pipe(stream).pipe(socket)
        stream.on('close', () => { forward.connections--; socket.end() })
        socket.on('close', () => { forward.connections--; stream.close() })
      })
    })

    forward.server = srv

    srv.on('error', (err) => reject(err))
    srv.listen(localPort, '127.0.0.1', () => {
      resolve(forward)
    })
  })
}
