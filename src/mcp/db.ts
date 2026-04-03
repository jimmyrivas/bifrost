/**
 * Direct SQLite access for the MCP server (standalone process).
 * Uses sql.js (pure JavaScript SQLite) to avoid native module ABI issues
 * between Electron's Node and system Node.
 * Opens Bifrost's database in read-only mode.
 */

import initSqlJs, { type Database } from 'sql.js'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { homedir, platform } from 'os'
import type { Connection, Group, Tunnel, Cluster, AuditEvent } from './types'

let db: Database | null = null

function getDataDir(): string {
  const home = homedir()
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'bifrost')
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'bifrost')
    default:
      return join(home, '.config', 'bifrost')
  }
}

export function getDbPath(): string {
  return join(getDataDir(), 'bifrost.db')
}

export function getAuditLogPath(): string {
  return join(getDataDir(), 'audit.jsonl')
}

export async function openDatabase(): Promise<Database> {
  if (db) return db

  const dbPath = getDbPath()
  if (!existsSync(dbPath)) {
    throw new Error(
      `Bifrost database not found at ${dbPath}. Is Bifrost installed and has been run at least once?`
    )
  }

  const SQL = await initSqlJs()
  const buffer = readFileSync(dbPath)
  db = new SQL.Database(buffer)
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

function getDb(): Database {
  if (!db) throw new Error('Database not initialized. Call openDatabase() first.')
  return db
}

// --- Query helpers ---

export function listConnections(filter?: {
  groupId?: string
  method?: string
}): Connection[] {
  const database = getDb()
  let sql = 'SELECT * FROM connections'
  const params: unknown[] = []
  const conditions: string[] = []

  if (filter?.groupId) {
    conditions.push('group_id = ?')
    params.push(filter.groupId)
  }
  if (filter?.method) {
    conditions.push('method = ?')
    params.push(filter.method)
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }
  sql += ' ORDER BY sort_order ASC, name ASC'

  const stmt = database.prepare(sql)
  if (params.length > 0) stmt.bind(params as (string | number | null)[])

  const results: Connection[] = []
  while (stmt.step()) {
    results.push(mapConnection(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  return results
}

export function getConnection(id: string): Connection | undefined {
  const database = getDb()
  const stmt = database.prepare('SELECT * FROM connections WHERE id = ?')
  stmt.bind([id])
  let result: Connection | undefined
  if (stmt.step()) {
    result = mapConnection(stmt.getAsObject() as Record<string, unknown>)
  }
  stmt.free()
  return result
}

export function listGroups(): Group[] {
  const database = getDb()
  const stmt = database.prepare('SELECT * FROM groups ORDER BY sort_order ASC, name ASC')
  const results: Group[] = []
  while (stmt.step()) {
    results.push(mapGroup(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  return results
}

export function listClusters(): Cluster[] {
  const database = getDb()
  const stmt = database.prepare('SELECT * FROM clusters ORDER BY name ASC')
  const results: Cluster[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    results.push({
      id: row.id as string,
      name: row.name as string,
      createdAt: row.created_at as string | null
    })
  }
  stmt.free()
  return results
}

export function getClusterMembers(clusterId: string): string[] {
  const database = getDb()
  const stmt = database.prepare('SELECT connection_id FROM cluster_members WHERE cluster_id = ?')
  stmt.bind([clusterId])
  const results: string[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    results.push(row.connection_id as string)
  }
  stmt.free()
  return results
}

export function listTunnels(): Tunnel[] {
  const database = getDb()
  const stmt = database.prepare('SELECT * FROM tunnels ORDER BY name ASC')
  const results: Tunnel[] = []
  while (stmt.step()) {
    results.push(mapTunnel(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  return results
}

// --- Snippets (stored in JSON file, not DB) ---

export interface SnippetRecord {
  id: string
  name: string
  command: string
  description?: string
  category: string
  tags: string[]
  variables: string[]
}

export function listSnippets(): SnippetRecord[] {
  const snippetsPath = join(getDataDir(), 'snippets', 'snippets.json')
  if (!existsSync(snippetsPath)) return []
  try {
    return JSON.parse(readFileSync(snippetsPath, 'utf-8')) as SnippetRecord[]
  } catch {
    return []
  }
}

// --- Scripts (stored in DB) ---

export interface ScriptRecord {
  id: string
  name: string
  description: string | null
  code: string
  trigger: string | null
}

export function listScripts(): ScriptRecord[] {
  const database = getDb()
  try {
    const stmt = database.prepare('SELECT * FROM scripts ORDER BY name ASC')
    const results: ScriptRecord[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      results.push({
        id: row.id as string,
        name: row.name as string,
        description: row.description as string | null,
        code: row.code as string,
        trigger: row.trigger as string | null
      })
    }
    stmt.free()
    return results
  } catch {
    // scripts table may not exist yet
    return []
  }
}

// --- Global Variables (stored in DB) ---

export interface GlobalVariableRecord {
  id: string
  name: string
  value: string
  isPassword: boolean
}

export function listGlobalVariables(): GlobalVariableRecord[] {
  const database = getDb()
  try {
    const stmt = database.prepare('SELECT * FROM global_variables ORDER BY name ASC')
    const results: GlobalVariableRecord[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      results.push({
        id: row.id as string,
        name: row.name as string,
        value: row.value as string,
        isPassword: Boolean(row.is_password)
      })
    }
    stmt.free()
    return results
  } catch {
    return []
  }
}

// --- Remote Commands ---

export interface RemoteCommandRecord {
  id: string
  connectionId: string | null
  command: string
  description: string
  cmdGroup: string
}

export function listRemoteCommands(connectionId?: string): RemoteCommandRecord[] {
  const database = getDb()
  try {
    const sql = connectionId
      ? 'SELECT * FROM remote_commands WHERE connection_id = ? OR connection_id IS NULL ORDER BY sort_order ASC'
      : 'SELECT * FROM remote_commands ORDER BY sort_order ASC'
    const stmt = database.prepare(sql)
    if (connectionId) stmt.bind([connectionId])
    const results: RemoteCommandRecord[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      results.push({
        id: row.id as string,
        connectionId: row.connection_id as string | null,
        command: row.command as string,
        description: row.description as string,
        cmdGroup: row.cmd_group as string
      })
    }
    stmt.free()
    return results
  } catch {
    return []
  }
}

export function queryAuditLog(options?: {
  connectionId?: string
  event?: string
  limit?: number
}): AuditEvent[] {
  const auditPath = getAuditLogPath()
  if (!existsSync(auditPath)) return []

  const content = readFileSync(auditPath, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)

  let events: AuditEvent[] = lines
    .map((line) => {
      try {
        return JSON.parse(line) as AuditEvent
      } catch {
        return null
      }
    })
    .filter((e): e is AuditEvent => e !== null)

  if (options?.connectionId) {
    events = events.filter((e) => e.connectionId === options.connectionId)
  }
  if (options?.event) {
    events = events.filter((e) => e.event === options.event)
  }

  // Most recent first
  events.reverse()

  const limit = options?.limit ?? 50
  return events.slice(0, limit)
}

// --- Row mappers (snake_case → camelCase) ---

function mapConnection(row: Record<string, unknown>): Connection {
  return {
    id: row.id as string,
    groupId: row.group_id as string | null,
    name: row.name as string,
    method: row.method as Connection['method'],
    host: row.host as string | null,
    port: row.port as number | null,
    authType: row.auth_type as string | null,
    username: row.username as string | null,
    privateKeyPath: row.private_key_path as string | null,
    launchOnStartup: Boolean(row.launch_on_startup),
    reconnectOnDisconnect: Boolean(row.reconnect_on_disconnect),
    runWithSudo: Boolean(row.run_with_sudo),
    useAutossh: Boolean(row.use_autossh),
    tabTitle: row.tab_title as string | null,
    networkMode: row.network_mode as string | null,
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as string | null,
    updatedAt: row.updated_at as string | null
  }
}

function mapGroup(row: Record<string, unknown>): Group {
  return {
    id: row.id as string,
    name: row.name as string,
    parentId: row.parent_id as string | null,
    sortOrder: (row.sort_order as number) ?? 0,
    icon: row.icon as string | null
  }
}

function mapTunnel(row: Record<string, unknown>): Tunnel {
  return {
    id: row.id as string,
    name: row.name as string,
    host: row.host as string,
    port: (row.port as number) ?? 22,
    username: row.username as string | null,
    authType: row.auth_type as string | null,
    privateKeyPath: row.private_key_path as string | null,
    forwards: row.forwards as string,
    autoStart: Boolean(row.auto_start),
    createdAt: row.created_at as string | null
  }
}
