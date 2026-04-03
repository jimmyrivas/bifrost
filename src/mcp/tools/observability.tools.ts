/**
 * MCP Tools: Observability (audit, health)
 * Security Level: 0 (read-only)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { execFile } from 'child_process'
import { queryAuditLog } from '../db'

export function registerObservabilityTools(server: McpServer): void {
  server.tool(
    'audit_query',
    'Query the Bifrost audit log. Returns recent connection events, auth attempts, and actions.',
    {
      connectionId: z.string().optional().describe('Filter by connection ID'),
      event: z
        .enum([
          'connect', 'disconnect', 'auth_success', 'auth_fail',
          'command', 'error', 'port_forward_start', 'port_forward_stop',
          'host_key_verified', 'host_key_rejected', 'host_key_changed',
          'recording_start', 'recording_stop'
        ])
        .optional()
        .describe('Filter by event type'),
      limit: z.number().default(50).optional().describe('Max results (default: 50, max: 200)')
    },
    async ({ connectionId, event, limit }) => {
      const maxLimit = Math.min(limit ?? 50, 200)
      const events = queryAuditLog({ connectionId, event, limit: maxLimit })

      if (events.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No audit events found matching criteria.' }] }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(events, null, 2) }]
      }
    }
  )

  server.tool(
    'health_ping',
    'Ping a host to check reachability and measure latency.',
    {
      host: z.string().describe('Hostname or IP address to ping')
    },
    async ({ host }) => {
      // Validate host to prevent injection
      if (!/^[a-zA-Z0-9._\-:[\]]+$/.test(host)) {
        return {
          content: [{ type: 'text' as const, text: 'Invalid host format' }],
          isError: true
        }
      }

      try {
        const result = await new Promise<{ reachable: boolean; latencyMs: number | null }>(
          (resolve) => {
            const args = process.platform === 'darwin'
              ? ['-c', '1', '-W', '3', host]
              : ['-c', '1', '-W', '3', host]

            execFile('ping', args, { timeout: 5000 }, (error, stdout) => {
              if (error) {
                resolve({ reachable: false, latencyMs: null })
                return
              }
              const match = stdout.match(/time[=<](\d+(?:\.\d+)?)\s*ms/)
              const latencyMs = match ? parseFloat(match[1]) : null
              resolve({ reachable: true, latencyMs })
            })
          }
        )

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                host,
                reachable: result.reachable,
                latencyMs: result.latencyMs,
                checkedAt: new Date().toISOString()
              }, null, 2)
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Ping failed: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )
}
