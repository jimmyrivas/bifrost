/**
 * MCP Tools: SSH operations
 * Security Level: 1 (execute)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { Client, type ClientChannel } from 'ssh2'
import { readFileSync, existsSync } from 'fs'
import { getConnection } from '../db'
import { checkCommand } from '../security/command-filter'
import type { SshSessionInfo } from '../types'

interface ManagedSshSession {
  id: string
  client: Client
  shell: ClientChannel | null
  host: string
  port: number
  username: string
  connectedAt: string
  outputBuffer: string[]
}

const sessions = new Map<string, ManagedSshSession>()
let sessionCounter = 0

// Exposed for SFTP tools to access SSH clients
export const __sessions = sessions

export function getActiveSshSessions(): SshSessionInfo[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    host: s.host,
    port: s.port,
    username: s.username,
    connectedAt: s.connectedAt,
    hasShell: s.shell !== null
  }))
}

export function cleanupAllSshSessions(): void {
  for (const [id, session] of sessions) {
    try {
      session.client.end()
    } catch { /* ignore */ }
    sessions.delete(id)
  }
}

export function registerSshTools(server: McpServer): void {
  server.tool(
    'ssh_connect',
    'Connect to a remote host via SSH. Use a saved Bifrost connection ID or provide host details directly.',
    {
      connectionId: z.string().optional().describe('Bifrost connection ID to use saved config'),
      host: z.string().optional().describe('Hostname or IP (if not using connectionId)'),
      port: z.number().default(22).optional().describe('SSH port (default: 22)'),
      username: z.string().optional().describe('SSH username'),
      privateKeyPath: z.string().optional().describe('Path to SSH private key file'),
      password: z.string().optional().describe('SSH password (prefer key-based auth)')
    },
    async ({ connectionId, host, port, username, privateKeyPath, password }) => {
      let connHost: string
      let connPort: number
      let connUsername: string
      let connKeyPath: string | null = null
      let connPassword: string | undefined

      if (connectionId) {
        const conn = getConnection(connectionId)
        if (!conn) {
          return { content: [{ type: 'text' as const, text: `Connection ${connectionId} not found` }], isError: true }
        }
        if (!conn.host) {
          return { content: [{ type: 'text' as const, text: 'Connection has no host configured' }], isError: true }
        }
        connHost = conn.host
        connPort = conn.port ?? 22
        connUsername = conn.username ?? ''
        connKeyPath = conn.privateKeyPath
        // Note: encrypted passwords from Bifrost's safeStorage cannot be decrypted here.
        // User must provide password param or use key-based auth.
        if (password) connPassword = password
      } else {
        if (!host) {
          return { content: [{ type: 'text' as const, text: 'Either connectionId or host is required' }], isError: true }
        }
        connHost = host
        connPort = port ?? 22
        connUsername = username ?? ''
        connKeyPath = privateKeyPath ?? null
        connPassword = password
      }

      const sessionId = `mcp-ssh-${++sessionCounter}`

      try {
        const client = new Client()
        const connectConfig: Record<string, unknown> = {
          host: connHost,
          port: connPort,
          username: connUsername,
          readyTimeout: 15000
        }

        if (connKeyPath && existsSync(connKeyPath)) {
          connectConfig.privateKey = readFileSync(connKeyPath)
        } else if (connPassword) {
          connectConfig.password = connPassword
        }
        // Falls back to SSH agent if neither key nor password

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout (15s)')), 15000)
          client.on('ready', () => {
            clearTimeout(timeout)
            resolve()
          })
          client.on('error', (err) => {
            clearTimeout(timeout)
            reject(err)
          })
          client.connect(connectConfig as Parameters<Client['connect']>[0])
        })

        sessions.set(sessionId, {
          id: sessionId,
          client,
          shell: null,
          host: connHost,
          port: connPort,
          username: connUsername,
          connectedAt: new Date().toISOString(),
          outputBuffer: []
        })

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                sessionId,
                host: connHost,
                port: connPort,
                username: connUsername,
                status: 'connected'
              })
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `SSH connection failed: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'ssh_execute',
    'Execute a command on an active SSH session and return stdout/stderr/exitCode. Commands are checked against a security filter.',
    {
      sessionId: z.string().describe('SSH session ID from ssh_connect'),
      command: z.string().describe('Shell command to execute'),
      timeoutMs: z.number().default(30000).optional().describe('Command timeout in ms (default: 30000)')
    },
    async ({ sessionId, command, timeoutMs }) => {
      const session = sessions.get(sessionId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `Session ${sessionId} not found` }], isError: true }
      }

      // Security check
      const check = checkCommand(command)
      if (!check.allowed) {
        return {
          content: [{ type: 'text' as const, text: `Command blocked: ${check.reason}` }],
          isError: true
        }
      }

      const timeout = timeoutMs ?? 30000

      try {
        const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
          (resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Command timeout (${timeout}ms)`)), timeout)

            session.client.exec(command, (err, stream) => {
              if (err) {
                clearTimeout(timer)
                reject(err)
                return
              }

              let stdout = ''
              let stderr = ''

              stream.on('data', (data: Buffer) => {
                stdout += data.toString()
              })
              stream.stderr.on('data', (data: Buffer) => {
                stderr += data.toString()
              })
              stream.on('close', (code: number) => {
                clearTimeout(timer)
                resolve({ stdout, stderr, exitCode: code ?? 0 })
              })
              stream.on('error', (streamErr: Error) => {
                clearTimeout(timer)
                reject(streamErr)
              })
            })
          }
        )

        const output: string[] = []
        if (result.stdout) output.push(result.stdout)
        if (result.stderr) output.push(`[stderr] ${result.stderr}`)
        output.push(`[exit code: ${result.exitCode}]`)

        let warningPrefix = ''
        if (check.severity === 'warning') {
          warningPrefix = `⚠️ ${check.reason}\n\n`
        }

        return {
          content: [{ type: 'text' as const, text: warningPrefix + output.join('\n') }]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Command execution failed: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'ssh_disconnect',
    'Close an active SSH session.',
    {
      sessionId: z.string().describe('SSH session ID to disconnect')
    },
    async ({ sessionId }) => {
      const session = sessions.get(sessionId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `Session ${sessionId} not found` }], isError: true }
      }

      try {
        session.client.end()
      } catch { /* ignore */ }
      sessions.delete(sessionId)

      return {
        content: [
          {
            type: 'text' as const,
            text: `Disconnected session ${sessionId} (${session.username}@${session.host}:${session.port})`
          }
        ]
      }
    }
  )
}
