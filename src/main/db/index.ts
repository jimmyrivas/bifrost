import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let db: ReturnType<typeof drizzle> | null = null
let sqlite: Database.Database | null = null

export function getDatabase(): ReturnType<typeof drizzle> {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'bifrost.db')
  sqlite = new Database(dbPath)

  // Performance and safety pragmas
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')

  db = drizzle(sqlite, { schema })
  return db
}

export function getSqlite(): Database.Database {
  if (!sqlite) getDatabase()
  return sqlite!
}

export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
  }
}

export { schema }
