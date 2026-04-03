import { ipcMain } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { randomBytes } from 'crypto'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'

export interface McpConfig {
  enabled: boolean
  transport: 'stdio' | 'http'
  port: number
  securityLevel: 0 | 1 | 2
  autoStart: boolean
  token: string
}

interface McpStatus {
  running: boolean
  pid: number | null
  transport: 'stdio' | 'http' | null
  port: number | null
  uptime: number | null
  logs: string[]
}

let mcpProcess: ChildProcess | null = null
let mcpStartedAt: number | null = null
const mcpLogs: string[] = []
const MAX_LOGS = 200

function getDefaultConfig(): McpConfig {
  return {
    enabled: false,
    transport: 'http',
    port: 3100,
    securityLevel: 1,
    autoStart: false,
    token: randomBytes(24).toString('hex')
  }
}

function loadConfig(): McpConfig {
  const db = getDatabase()
  const row = db.select().from(schema.preferences).where(eq(schema.preferences.key, 'mcp_config')).get()
  if (row) {
    try {
      return { ...getDefaultConfig(), ...JSON.parse(row.value) }
    } catch { /* ignore */ }
  }
  return getDefaultConfig()
}

function saveConfig(config: McpConfig): void {
  const db = getDatabase()
  const existing = db.select().from(schema.preferences).where(eq(schema.preferences.key, 'mcp_config')).get()
  if (existing) {
    db.update(schema.preferences).set({ value: JSON.stringify(config) }).where(eq(schema.preferences.key, 'mcp_config')).run()
  } else {
    db.insert(schema.preferences).values({ key: 'mcp_config', value: JSON.stringify(config) }).run()
  }
}

function appendLog(line: string): void {
  mcpLogs.push(`[${new Date().toISOString().slice(11, 19)}] ${line}`)
  if (mcpLogs.length > MAX_LOGS) {
    mcpLogs.splice(0, mcpLogs.length - MAX_LOGS)
  }
}

function findMcpEntry(): string {
  // Try tsx in node_modules
  const tsxBin = join(process.cwd(), 'node_modules', '.bin', 'tsx')
  const mcpEntry = join(process.cwd(), 'src', 'mcp', 'index.ts')

  // Check from app path
  const possibleRoots = [
    process.cwd(),
    join(__dirname, '..', '..'),
    join(__dirname, '..', '..', '..')
  ]

  for (const root of possibleRoots) {
    const entry = join(root, 'src', 'mcp', 'index.ts')
    const tsx = join(root, 'node_modules', '.bin', 'tsx')
    if (existsSync(entry) && existsSync(tsx)) {
      return root
    }
  }

  throw new Error('MCP server entry point not found. Ensure src/mcp/index.ts exists.')
}

function startMcpServer(config: McpConfig): { pid: number } {
  if (mcpProcess) {
    throw new Error('MCP server is already running')
  }

  const root = findMcpEntry()
  const tsxBin = join(root, 'node_modules', '.bin', 'tsx')
  const mcpEntry = join(root, 'src', 'mcp', 'index.ts')

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    BIFROST_MCP_HTTP: config.transport === 'http' ? '1' : '0',
    BIFROST_MCP_PORT: String(config.port),
    BIFROST_MCP_SECURITY_LEVEL: String(config.securityLevel)
  }

  if (config.token) {
    env.BIFROST_MCP_TOKEN = config.token
  }

  appendLog(`Starting MCP server (${config.transport}, port ${config.port})...`)

  mcpProcess = spawn(tsxBin, [mcpEntry], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false
  })

  mcpStartedAt = Date.now()

  mcpProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n')
    lines.forEach((line) => appendLog(`[stdout] ${line}`))
  })

  mcpProcess.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n')
    lines.forEach((line) => appendLog(line.replace(/^\[bifrost-mcp\]\s*/, '')))
  })

  mcpProcess.on('exit', (code) => {
    appendLog(`MCP server exited (code ${code})`)
    mcpProcess = null
    mcpStartedAt = null
  })

  mcpProcess.on('error', (err) => {
    appendLog(`MCP server error: ${err.message}`)
    mcpProcess = null
    mcpStartedAt = null
  })

  return { pid: mcpProcess.pid! }
}

function stopMcpServer(): void {
  if (!mcpProcess) {
    throw new Error('MCP server is not running')
  }

  appendLog('Stopping MCP server...')
  mcpProcess.kill('SIGTERM')

  // Force kill after 3 seconds
  const timeout = setTimeout(() => {
    if (mcpProcess) {
      mcpProcess.kill('SIGKILL')
      mcpProcess = null
      mcpStartedAt = null
      appendLog('MCP server force-killed')
    }
  }, 3000)

  mcpProcess.on('exit', () => {
    clearTimeout(timeout)
  })
}

export function registerMcpIpc(): void {
  ipcMain.handle('mcp:getConfig', (): McpConfig => {
    return loadConfig()
  })

  ipcMain.handle('mcp:setConfig', (_event, config: Partial<McpConfig>) => {
    const current = loadConfig()
    const updated = { ...current, ...config }
    saveConfig(updated)
    return updated
  })

  ipcMain.handle('mcp:start', (): { pid: number } => {
    const config = loadConfig()
    return startMcpServer(config)
  })

  ipcMain.handle('mcp:stop', () => {
    stopMcpServer()
  })

  ipcMain.handle('mcp:status', (): McpStatus => {
    const config = loadConfig()
    return {
      running: mcpProcess !== null && !mcpProcess.killed,
      pid: mcpProcess?.pid ?? null,
      transport: mcpProcess ? config.transport : null,
      port: mcpProcess && config.transport === 'http' ? config.port : null,
      uptime: mcpStartedAt ? Date.now() - mcpStartedAt : null,
      logs: mcpLogs.slice(-50)
    }
  })

  ipcMain.handle('mcp:getLogs', (_event, lines?: number): string[] => {
    return mcpLogs.slice(-(lines ?? 100))
  })

  ipcMain.handle('mcp:generateToken', (): string => {
    const token = randomBytes(24).toString('hex')
    const config = loadConfig()
    config.token = token
    saveConfig(config)
    return token
  })
}

export function autoStartMcp(): void {
  const config = loadConfig()
  if (config.enabled && config.autoStart) {
    try {
      startMcpServer(config)
    } catch (err) {
      console.warn('MCP auto-start failed:', err)
    }
  }
}

export function stopMcpOnExit(): void {
  if (mcpProcess && !mcpProcess.killed) {
    mcpProcess.kill('SIGTERM')
  }
}
