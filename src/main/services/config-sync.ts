import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

interface ExportedEntry {
  name: string
  method: string
  host: string | null
  port: number | null
  authType: string | null
  username: string | null
  group: string | null
  tags: string[]
}

function runGit(repoPath: string, args: string): string {
  return execSync(`git -C "${repoPath}" ${args}`, { encoding: 'utf-8', timeout: 15000 }).trim()
}

function isGitRepo(repoPath: string): boolean {
  try {
    runGit(repoPath, 'rev-parse --is-inside-work-tree')
    return true
  } catch {
    return false
  }
}

export function exportToGit(repoPath: string): { exported: number } {
  if (!existsSync(repoPath)) {
    mkdirSync(repoPath, { recursive: true })
  }

  if (!isGitRepo(repoPath)) {
    runGit(repoPath, 'init')
  }

  const db = getDatabase()
  const connections = db.select().from(schema.connections).all()
  const groups = db.select().from(schema.groups).all()

  const groupMap = new Map(groups.map((g) => [g.id, g.name]))

  const exportData: ExportedEntry[] = connections.map((c) => ({
    name: c.name,
    method: c.method,
    host: c.host,
    port: c.port,
    authType: c.authType,
    username: c.username,
    group: c.groupId ? (groupMap.get(c.groupId) ?? null) : null,
    tags: []
  }))

  const filePath = join(repoPath, 'bifrost-connections.json')
  writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8')

  runGit(repoPath, 'add bifrost-connections.json')

  try {
    runGit(repoPath, 'diff --cached --quiet')
    return { exported: exportData.length }
  } catch {
    runGit(repoPath, 'commit -m "Bifrost config sync"')
  }

  return { exported: exportData.length }
}

export function importFromGit(repoPath: string): { imported: number } {
  const filePath = join(repoPath, 'bifrost-connections.json')
  if (!existsSync(filePath)) {
    throw new Error('No bifrost-connections.json found in repository')
  }

  const raw = readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw) as ExportedEntry[]

  const db = getDatabase()
  const existing = db.select({ name: schema.connections.name, host: schema.connections.host }).from(schema.connections).all()
  const existingSet = new Set(existing.map((c) => `${c.name}::${c.host}`))

  let imported = 0
  for (const entry of data) {
    const key = `${entry.name}::${entry.host}`
    if (existingSet.has(key)) continue

    const id = randomUUID()
    const now = new Date().toISOString()
    db.insert(schema.connections)
      .values({
        id,
        name: entry.name,
        method: entry.method as 'ssh' | 'rdp' | 'vnc' | 'telnet' | 'local' | 'ftp',
        host: entry.host,
        port: entry.port,
        authType: entry.authType as 'userpass' | 'key' | 'key_pass' | 'manual' | null,
        username: entry.username,
        groupId: null,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      })
      .run()
    imported++
  }

  return { imported }
}

export function syncWithGit(repoPath: string): { exported: number; imported: number } {
  if (!isGitRepo(repoPath)) {
    throw new Error('Not a git repository')
  }

  try {
    runGit(repoPath, 'pull --rebase')
  } catch {
    // Remote may not be configured
  }

  let imported = 0
  const filePath = join(repoPath, 'bifrost-connections.json')
  if (existsSync(filePath)) {
    const result = importFromGit(repoPath)
    imported = result.imported
  }

  const { exported } = exportToGit(repoPath)

  try {
    runGit(repoPath, 'push')
  } catch {
    // Remote may not be configured
  }

  return { exported, imported }
}
