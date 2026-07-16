import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { getSqlite, closeDatabase } from '../db'
import { encryptBytes, decryptBytes } from './db-encryption-crypto'

/**
 * At-rest encryption for the SQLite database file (Phase 5.5).
 *
 * Approach: app-level AES-256-GCM over the whole `bifrost.db` file (scrypt key
 * from the user's passphrase). This protects the data when the app is CLOSED.
 * While Bifrost runs, better-sqlite3 needs a plaintext file on disk, so the DB
 * is decrypted for the session and re-encrypted on quit — this is not SQLCipher
 * and does not hide data from a process running as your user while the app is open.
 *
 * State model:
 *  - "encrypted at rest" = the `.enc` file exists and the plaintext `bifrost.db`
 *    does not. Detected purely from disk at startup.
 *  - The in-memory `mode` + `passphrase` (set on unlock or enable) drive what
 *    happens on quit: `encrypted` → produce `.enc`, delete plaintext; `plain`
 *    → leave plaintext, remove any `.enc`.
 */

function dbPath(): string {
  return join(app.getPath('userData'), 'bifrost.db')
}
function encPath(): string {
  return dbPath() + '.enc'
}

let mode: 'plain' | 'encrypted' = 'plain'
let passphrase: string | null = null

/** True when the DB is encrypted on disk and needs a passphrase to open. */
export function isLockedAtRest(): boolean {
  return existsSync(encPath()) && !existsSync(dbPath())
}

/** Whether encryption is currently enabled for this session (drives quit). */
export function isEncryptionEnabled(): boolean {
  return mode === 'encrypted'
}

/**
 * Startup unlock: decrypt `.enc` → `bifrost.db` with the passphrase. On success
 * the session runs in encrypted mode (re-encrypts on quit). Returns false on a
 * wrong passphrase / corrupt file so the caller can re-prompt.
 */
export function unlock(pass: string): boolean {
  try {
    const decrypted = decryptBytes(readFileSync(encPath()), pass)
    writeFileSync(dbPath(), decrypted)
    rmSync(encPath(), { force: true })
    passphrase = pass
    mode = 'encrypted'
    return true
  } catch {
    return false
  }
}

/**
 * Enable encryption for an already-open plaintext DB. The file is not touched
 * now (better-sqlite3 holds it open) — it is encrypted on quit. Callers must
 * warn the user that a lost passphrase means unrecoverable data.
 */
export function enable(pass: string): void {
  passphrase = pass
  mode = 'encrypted'
}

/** Disable encryption: the DB stays plaintext and any `.enc` is removed on quit. */
export function disable(): void {
  passphrase = null
  mode = 'plain'
}

/**
 * Finalize on quit. In encrypted mode: checkpoint + close the DB, encrypt
 * `bifrost.db` → `.enc`, and delete the plaintext DB + WAL sidecars. In plain
 * mode: just remove any stale `.enc`. Best-effort; never throws.
 */
export function finalizeOnQuit(): void {
  try {
    if (mode === 'encrypted' && passphrase) {
      // Fold the WAL back into the main file before we read it.
      try {
        getSqlite().pragma('wal_checkpoint(TRUNCATE)')
      } catch { /* db may already be closed */ }
      closeDatabase()

      const p = dbPath()
      if (existsSync(p)) {
        writeFileSync(encPath(), encryptBytes(readFileSync(p), passphrase))
        rmSync(p, { force: true })
        rmSync(p + '-wal', { force: true })
        rmSync(p + '-shm', { force: true })
      }
    } else {
      closeDatabase()
      rmSync(encPath(), { force: true })
    }
  } catch (err) {
    console.error('[db-encryption] finalize failed:', err)
  }
}
