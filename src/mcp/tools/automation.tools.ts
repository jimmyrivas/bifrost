/**
 * MCP Tools: Automation (snippets, scripts, variables)
 * Security Level: 1 (execute)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { checkCommand } from '../security/command-filter'
import { listSnippets, listScripts, listGlobalVariables, getConnection } from '../db'
import { __sessions as sshSessions } from './ssh.tools'

export function registerAutomationTools(server: McpServer): void {
  server.tool(
    'list_snippets',
    'List all command snippets available in Bifrost. Snippets are pre-built DevOps commands with variable placeholders ({{var}}).',
    {
      category: z.string().optional().describe('Filter by category (e.g. Kubernetes, Docker, Systemd, Networking, System, Security)'),
      search: z.string().optional().describe('Search snippets by name or description')
    },
    async ({ category, search }) => {
      const snippets = listSnippets()
      let filtered = snippets

      if (category) {
        filtered = filtered.filter((s) => s.category.toLowerCase() === category.toLowerCase())
      }
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(
          (s) => s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q)
        )
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(filtered, null, 2) }]
      }
    }
  )

  server.tool(
    'execute_snippet',
    'Execute a Bifrost command snippet with variable substitution. Variables use {{var}} syntax.',
    {
      snippetId: z.string().optional().describe('Snippet ID to execute'),
      command: z.string().optional().describe('Or provide a raw command template instead of snippet ID'),
      variables: z.record(z.string(), z.string()).default({}).optional().describe('Variable values to substitute, e.g. {"namespace": "production", "pod": "web-1"}'),
      sshSessionId: z.string().optional().describe('SSH session ID to execute on (omit for local execution)')
    },
    async ({ snippetId, command, variables, sshSessionId }) => {
      let cmd: string

      if (snippetId) {
        const snippets = listSnippets()
        const snippet = snippets.find((s) => s.id === snippetId)
        if (!snippet) {
          return { content: [{ type: 'text' as const, text: `Snippet ${snippetId} not found` }], isError: true }
        }
        cmd = snippet.command
      } else if (command) {
        cmd = command
      } else {
        return { content: [{ type: 'text' as const, text: 'Either snippetId or command is required' }], isError: true }
      }

      // Substitute variables
      const vars = variables ?? {}
      cmd = cmd.replace(/\{\{(\w+)\}\}/g, (match: string, varName: string) => {
        return vars[varName] !== undefined ? vars[varName] : match
      })

      // Check for unresolved variables
      const unresolved = cmd.match(/\{\{(\w+)\}\}/g)
      if (unresolved) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Unresolved variables: ${unresolved.join(', ')}. Provide values in the 'variables' parameter.`
            }
          ],
          isError: true
        }
      }

      // Security check
      const check = checkCommand(cmd)
      if (!check.allowed) {
        return { content: [{ type: 'text' as const, text: `Command blocked: ${check.reason}` }], isError: true }
      }

      // Execute on SSH session or locally
      if (sshSessionId) {
        const session = sshSessions.get(sshSessionId)
        if (!session) {
          return { content: [{ type: 'text' as const, text: `SSH session ${sshSessionId} not found` }], isError: true }
        }
        try {
          const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
            (resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Timeout')), 30000)
              session.client.exec(cmd, (err, stream) => {
                if (err) { clearTimeout(timer); reject(err); return }
                let stdout = '', stderr = ''
                stream.on('data', (d: Buffer) => { stdout += d.toString() })
                stream.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
                stream.on('close', (code: number) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code ?? 0 }) })
              })
            }
          )
          const out = [result.stdout, result.stderr ? `[stderr] ${result.stderr}` : '', `[exit code: ${result.exitCode}]`].filter(Boolean)
          return { content: [{ type: 'text' as const, text: out.join('\n') }] }
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Execution failed: ${(err as Error).message}` }], isError: true }
        }
      } else {
        try {
          const result = execSync(cmd, { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 })
          return { content: [{ type: 'text' as const, text: result }] }
        } catch (err: unknown) {
          const e = err as { stdout?: string; stderr?: string }
          return { content: [{ type: 'text' as const, text: (e.stdout || '') + (e.stderr || '') || (err as Error).message }], isError: true }
        }
      }
    }
  )

  server.tool(
    'list_scripts',
    'List all custom JavaScript scripts saved in Bifrost.',
    {},
    async () => {
      const scripts = listScripts()
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(scripts, null, 2) }]
      }
    }
  )

  server.tool(
    'execute_script',
    'Execute a JavaScript script in a sandboxed environment. Scripts can use console.log() for output.',
    {
      code: z.string().describe('JavaScript code to execute'),
      timeoutMs: z.number().default(15000).optional().describe('Execution timeout in ms (default: 15000)')
    },
    async ({ code, timeoutMs }) => {
      const timeout = timeoutMs ?? 15000
      try {
        // Use Node's vm module for basic sandboxing
        const { createContext, runInNewContext } = await import('vm')
        const output: string[] = []
        const sandbox = {
          console: {
            log: (...args: unknown[]) => output.push(args.map(String).join(' ')),
            error: (...args: unknown[]) => output.push('[error] ' + args.map(String).join(' ')),
            warn: (...args: unknown[]) => output.push('[warn] ' + args.map(String).join(' '))
          },
          setTimeout: undefined,
          setInterval: undefined,
          fetch: undefined,
          require: undefined
        }
        createContext(sandbox)
        const result = runInNewContext(code, sandbox, { timeout })
        if (result !== undefined) {
          output.push(`[return] ${JSON.stringify(result)}`)
        }
        return { content: [{ type: 'text' as const, text: output.join('\n') || '(no output)' }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Script error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    'list_variables',
    'List all global variables defined in Bifrost. Variables can be used in snippets and connection templates.',
    {},
    async () => {
      const vars = listGlobalVariables()
      // Mask password values
      const safe = vars.map((v) => ({
        ...v,
        value: v.isPassword ? '********' : v.value
      }))
      return { content: [{ type: 'text' as const, text: JSON.stringify(safe, null, 2) }] }
    }
  )

  server.tool(
    'resolve_variables',
    'Resolve Bifrost template variables in a string. Supports: <IP>, <USER>, <PORT>, <ENV:name>, <GV:name>, <CMD:command>, <TIMESTAMP>, <DATE_Y/M/D>, <TIME_H/M/S>.',
    {
      template: z.string().describe('Template string with variables to resolve'),
      connectionId: z.string().optional().describe('Connection ID for connection-specific variables')
    },
    async ({ template, connectionId }) => {
      let result = template
      const now = new Date()

      // Timestamp variables
      result = result.replace(/<TIMESTAMP>/g, now.toISOString())
      result = result.replace(/<DATE_Y>/g, String(now.getFullYear()))
      result = result.replace(/<DATE_M>/g, String(now.getMonth() + 1).padStart(2, '0'))
      result = result.replace(/<DATE_D>/g, String(now.getDate()).padStart(2, '0'))
      result = result.replace(/<TIME_H>/g, String(now.getHours()).padStart(2, '0'))
      result = result.replace(/<TIME_M>/g, String(now.getMinutes()).padStart(2, '0'))
      result = result.replace(/<TIME_S>/g, String(now.getSeconds()).padStart(2, '0'))

      // Connection variables
      if (connectionId) {
        const conn = getConnection(connectionId)
        if (conn) {
          result = result.replace(/<IP>/g, conn.host ?? '')
          result = result.replace(/<PORT>/g, String(conn.port ?? 22))
          result = result.replace(/<USER>/g, conn.username ?? '')
          result = result.replace(/<NAME>/g, conn.name)
        }
      }

      // Environment variables: <ENV:name>
      result = result.replace(/<ENV:(\w+)>/g, (_, name) => process.env[name] ?? '')

      // Global variables: <GV:name>
      const globalVars = listGlobalVariables()
      result = result.replace(/<GV:(\w+)>/g, (_, name) => {
        const v = globalVars.find((gv) => gv.name === name)
        return v?.value ?? ''
      })

      // CMD execution: <CMD:command>
      result = result.replace(/<CMD:([^>]+)>/g, (_, cmd) => {
        const check = checkCommand(cmd)
        if (!check.allowed) return `[BLOCKED: ${check.reason}]`
        try {
          return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
        } catch {
          return '[CMD_FAILED]'
        }
      })

      return { content: [{ type: 'text' as const, text: result }] }
    }
  )
}
