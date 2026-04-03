/**
 * MCP Tools: Local terminal operations
 * Security Level: 1 (execute)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import * as pty from 'node-pty'
import { execSync } from 'child_process'
import { checkCommand } from '../security/command-filter'
import type { TerminalSessionInfo } from '../types'

interface ManagedTerminalSession {
  id: string
  process: pty.IPty
  shell: string
  createdAt: string
  outputBuffer: string[]
}

const sessions = new Map<string, ManagedTerminalSession>()
let terminalCounter = 0
const BUFFER_MAX = 5000

export function getActiveTerminalSessions(): TerminalSessionInfo[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    shell: s.shell,
    createdAt: s.createdAt
  }))
}

export function cleanupAllTerminalSessions(): void {
  for (const [id, session] of sessions) {
    try {
      session.process.kill()
    } catch { /* ignore */ }
    sessions.delete(id)
  }
}

function getDefaultShell(): string {
  return process.env.SHELL || '/bin/bash'
}

export function registerTerminalTools(server: McpServer): void {
  server.tool(
    'terminal_create',
    'Create a new local terminal session (PTY). Returns a session ID for subsequent commands.',
    {
      shell: z.string().optional().describe('Shell to use (default: system default shell)'),
      cwd: z.string().optional().describe('Working directory (default: home directory)')
    },
    async ({ shell, cwd }) => {
      const id = `mcp-term-${++terminalCounter}`
      const shellPath = shell || getDefaultShell()
      const workDir = cwd || process.env.HOME || '/'

      try {
        const ptyProcess = pty.spawn(shellPath, [], {
          name: 'xterm-256color',
          cols: 120,
          rows: 40,
          cwd: workDir,
          env: process.env as Record<string, string>
        })

        const session: ManagedTerminalSession = {
          id,
          process: ptyProcess,
          shell: shellPath,
          createdAt: new Date().toISOString(),
          outputBuffer: []
        }

        ptyProcess.onData((data: string) => {
          session.outputBuffer.push(data)
          if (session.outputBuffer.length > BUFFER_MAX) {
            session.outputBuffer = session.outputBuffer.slice(-BUFFER_MAX)
          }
        })

        ptyProcess.onExit(() => {
          sessions.delete(id)
        })

        sessions.set(id, session)

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ sessionId: id, shell: shellPath, cwd: workDir })
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to create terminal: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'terminal_execute',
    'Execute a command in a local terminal session and return the output. If no session ID is provided, creates a temporary session.',
    {
      command: z.string().describe('Shell command to execute'),
      sessionId: z.string().optional().describe('Terminal session ID (creates temporary if omitted)'),
      timeoutMs: z.number().default(30000).optional().describe('Command timeout in ms (default: 30000)')
    },
    async ({ command, sessionId, timeoutMs }) => {
      // Security check
      const check = checkCommand(command)
      if (!check.allowed) {
        return {
          content: [{ type: 'text' as const, text: `Command blocked: ${check.reason}` }],
          isError: true
        }
      }

      const timeout = timeoutMs ?? 30000

      // If no session, execute via child_process for simplicity
      if (!sessionId) {
        try {
          const result = execSync(command, {
            timeout,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
            cwd: process.env.HOME || '/',
            env: process.env as Record<string, string>
          })
          let warningPrefix = ''
          if (check.severity === 'warning') {
            warningPrefix = `⚠️ ${check.reason}\n\n`
          }
          return { content: [{ type: 'text' as const, text: warningPrefix + result }] }
        } catch (err: unknown) {
          const execErr = err as { stdout?: string; stderr?: string; status?: number }
          const output = (execErr.stdout || '') + (execErr.stderr ? `\n[stderr] ${execErr.stderr}` : '')
          return {
            content: [
              {
                type: 'text' as const,
                text: output || `Command failed: ${err instanceof Error ? err.message : String(err)}`
              }
            ],
            isError: true
          }
        }
      }

      // Use existing PTY session
      const session = sessions.get(sessionId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `Terminal session ${sessionId} not found` }], isError: true }
      }

      // Clear buffer, write command, wait for output
      const bufferBefore = session.outputBuffer.length
      session.process.write(command + '\r')

      // Wait for output to stabilize
      return new Promise((resolve) => {
        const deadline = Date.now() + timeout
        let lastLen = 0
        const poll = setInterval(() => {
          const currentLen = session.outputBuffer.length
          if (Date.now() > deadline || (currentLen === lastLen && currentLen > bufferBefore)) {
            clearInterval(poll)
            const newOutput = session.outputBuffer.slice(bufferBefore).join('')
            let warningPrefix = ''
            if (check.severity === 'warning') {
              warningPrefix = `⚠️ ${check.reason}\n\n`
            }
            resolve({
              content: [{ type: 'text' as const, text: warningPrefix + newOutput }]
            })
          }
          lastLen = currentLen
        }, 200)
      })
    }
  )

  server.tool(
    'terminal_read_buffer',
    'Read the current output buffer of a terminal session.',
    {
      sessionId: z.string().describe('Terminal session ID'),
      lastN: z.number().default(100).optional().describe('Number of recent buffer entries to read (default: 100)')
    },
    async ({ sessionId, lastN }) => {
      const session = sessions.get(sessionId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `Terminal session ${sessionId} not found` }], isError: true }
      }
      const n = lastN ?? 100
      const output = session.outputBuffer.slice(-n).join('')
      return { content: [{ type: 'text' as const, text: output || '(empty buffer)' }] }
    }
  )

  server.tool(
    'terminal_destroy',
    'Close and destroy a local terminal session.',
    {
      sessionId: z.string().describe('Terminal session ID to destroy')
    },
    async ({ sessionId }) => {
      const session = sessions.get(sessionId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `Terminal session ${sessionId} not found` }], isError: true }
      }
      try {
        session.process.kill()
      } catch { /* ignore */ }
      sessions.delete(sessionId)
      return {
        content: [{ type: 'text' as const, text: `Terminal session ${sessionId} destroyed` }]
      }
    }
  )
}
