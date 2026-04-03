/**
 * MCP Tools: Cluster operations — parallel command execution across multiple hosts
 * Security Level: 2 (mutate — broadcasts to multiple hosts)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { Client } from 'ssh2'
import { readFileSync, existsSync } from 'fs'
import { getConnection, getClusterMembers, listClusters } from '../db'
import { checkCommand } from '../security/command-filter'
import { __sessions as sshSessions } from './ssh.tools'

interface ClusterExecResult {
  connectionId: string
  connectionName: string
  host: string
  stdout: string
  stderr: string
  exitCode: number
  error?: string
  durationMs: number
}

export function registerClusterTools(server: McpServer): void {
  server.tool(
    'cluster_execute',
    'Execute a command on all members of a Bifrost cluster simultaneously. Returns results from each host. Requires active SSH sessions for each member, or will auto-connect using saved connection config.',
    {
      clusterId: z.string().describe('Cluster ID from list_clusters'),
      command: z.string().describe('Shell command to execute on all members'),
      timeoutMs: z.number().default(30000).optional().describe('Per-host timeout in ms (default: 30000)'),
      connectionIds: z.array(z.string()).optional().describe('Override: specific connection IDs instead of cluster members')
    },
    async ({ clusterId, command, timeoutMs, connectionIds }) => {
      // Security check
      const check = checkCommand(command)
      if (!check.allowed) {
        return {
          content: [{ type: 'text' as const, text: `Command blocked: ${check.reason}` }],
          isError: true
        }
      }

      const timeout = timeoutMs ?? 30000

      // Get connection IDs from cluster or override
      const targetIds = connectionIds ?? getClusterMembers(clusterId)
      if (targetIds.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No members found for cluster ${clusterId}` }],
          isError: true
        }
      }

      // Resolve connections
      const connections = targetIds.map((id) => getConnection(id)).filter(Boolean)
      if (connections.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No valid connections found for cluster members' }],
          isError: true
        }
      }

      let warningPrefix = ''
      if (check.severity === 'warning') {
        warningPrefix = `⚠️ ${check.reason}\n\n`
      }

      // Execute on all hosts in parallel
      const results = await Promise.all(
        connections.map(async (conn): Promise<ClusterExecResult> => {
          const start = Date.now()
          const result: ClusterExecResult = {
            connectionId: conn!.id,
            connectionName: conn!.name,
            host: conn!.host ?? 'unknown',
            stdout: '',
            stderr: '',
            exitCode: -1,
            durationMs: 0
          }

          try {
            // Check if we already have an SSH session for this host
            let client: Client | null = null
            let isTemporary = false

            for (const [, session] of sshSessions) {
              if (session.host === conn!.host && session.port === (conn!.port ?? 22)) {
                client = session.client
                break
              }
            }

            // If no existing session, create temporary one
            if (!client) {
              client = new Client()
              isTemporary = true

              const connectConfig: Record<string, unknown> = {
                host: conn!.host,
                port: conn!.port ?? 22,
                username: conn!.username ?? '',
                readyTimeout: 10000
              }

              if (conn!.privateKeyPath && existsSync(conn!.privateKeyPath)) {
                connectConfig.privateKey = readFileSync(conn!.privateKeyPath)
              }

              await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Connection timeout')), 10000)
                client!.on('ready', () => { clearTimeout(timer); resolve() })
                client!.on('error', (err) => { clearTimeout(timer); reject(err) })
                client!.connect(connectConfig as Parameters<Client['connect']>[0])
              })
            }

            // Execute command
            const execResult = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
              (resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`Timeout (${timeout}ms)`)), timeout)
                client!.exec(command, (err, stream) => {
                  if (err) { clearTimeout(timer); reject(err); return }
                  let stdout = ''
                  let stderr = ''
                  stream.on('data', (d: Buffer) => { stdout += d.toString() })
                  stream.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
                  stream.on('close', (code: number) => {
                    clearTimeout(timer)
                    resolve({ stdout, stderr, exitCode: code ?? 0 })
                  })
                  stream.on('error', (e: Error) => { clearTimeout(timer); reject(e) })
                })
              }
            )

            result.stdout = execResult.stdout
            result.stderr = execResult.stderr
            result.exitCode = execResult.exitCode

            // Clean up temporary connection
            if (isTemporary) {
              client.end()
            }
          } catch (err) {
            result.error = err instanceof Error ? err.message : String(err)
          }

          result.durationMs = Date.now() - start
          return result
        })
      )

      // Format output as a comparison table
      const summary = results.map((r) => {
        const status = r.error ? `ERROR: ${r.error}` : `exit ${r.exitCode}`
        return `── ${r.connectionName} (${r.host}) [${status}] ${r.durationMs}ms ──\n${r.stdout}${r.stderr ? `\n[stderr] ${r.stderr}` : ''}`
      })

      const successCount = results.filter((r) => !r.error && r.exitCode === 0).length

      return {
        content: [
          {
            type: 'text' as const,
            text: `${warningPrefix}Cluster execution: ${successCount}/${results.length} succeeded\n\n${summary.join('\n\n')}`
          }
        ]
      }
    }
  )

  server.tool(
    'cluster_multi_host_diff',
    'Execute the same command on multiple hosts and present a comparative diff of the outputs. Useful for checking version consistency, config drift, etc.',
    {
      connectionIds: z.array(z.string()).min(2).describe('Connection IDs to compare (minimum 2)'),
      command: z.string().describe('Command to execute on each host')
    },
    async ({ connectionIds, command }) => {
      // Security check
      const check = checkCommand(command)
      if (!check.allowed) {
        return { content: [{ type: 'text' as const, text: `Command blocked: ${check.reason}` }], isError: true }
      }

      const connections = connectionIds.map((id) => getConnection(id)).filter(Boolean)
      if (connections.length < 2) {
        return { content: [{ type: 'text' as const, text: 'Need at least 2 valid connections for diff' }], isError: true }
      }

      // Execute on all hosts
      const results = await Promise.all(
        connections.map(async (conn) => {
          try {
            const client = new Client()
            const connectConfig: Record<string, unknown> = {
              host: conn!.host,
              port: conn!.port ?? 22,
              username: conn!.username ?? '',
              readyTimeout: 10000
            }
            if (conn!.privateKeyPath && existsSync(conn!.privateKeyPath)) {
              connectConfig.privateKey = readFileSync(conn!.privateKeyPath)
            }

            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Timeout')), 10000)
              client.on('ready', () => { clearTimeout(timer); resolve() })
              client.on('error', (err) => { clearTimeout(timer); reject(err) })
              client.connect(connectConfig as Parameters<Client['connect']>[0])
            })

            const output = await new Promise<string>((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Timeout')), 15000)
              client.exec(command, (err, stream) => {
                if (err) { clearTimeout(timer); reject(err); return }
                let out = ''
                stream.on('data', (d: Buffer) => { out += d.toString() })
                stream.on('close', () => { clearTimeout(timer); resolve(out) })
                stream.on('error', (e: Error) => { clearTimeout(timer); reject(e) })
              })
            })

            client.end()
            return { name: conn!.name, host: conn!.host, output, error: null }
          } catch (err) {
            return { name: conn!.name, host: conn!.host, output: '', error: (err as Error).message }
          }
        })
      )

      // Compare outputs
      const outputs = results.filter((r) => !r.error).map((r) => r.output.trim())
      const allSame = outputs.every((o) => o === outputs[0])

      const lines = results.map((r) =>
        r.error
          ? `── ${r.name} (${r.host}) ── ERROR: ${r.error}`
          : `── ${r.name} (${r.host}) ──\n${r.output}`
      )

      const header = allSame
        ? `✅ All ${outputs.length} hosts returned identical output`
        : `⚠️ Outputs differ across ${outputs.length} hosts`

      return {
        content: [{ type: 'text' as const, text: `${header}\n\n${lines.join('\n\n')}` }]
      }
    }
  )
}
