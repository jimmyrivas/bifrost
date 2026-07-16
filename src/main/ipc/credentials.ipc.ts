import { ipcMain } from 'electron'
import { credentialStore } from '../services/credential-store'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'fs'
import { auditLogger } from '../services/audit-log'

export function registerCredentialsIpc(): void {
  ipcMain.handle('credentials:isAvailable', () => {
    return credentialStore.isAvailable()
  })

  ipcMain.handle('credentials:setPassword', (_event, connectionId: string, password: string) => {
    const encrypted = credentialStore.encrypt(password)
    const db = getDatabase()
    db.update(schema.connections)
      .set({ encryptedPassword: encrypted })
      .where(eq(schema.connections.id, connectionId))
      .run()
  })

  ipcMain.handle('credentials:setPassphrase', (_event, connectionId: string, passphrase: string) => {
    const encrypted = credentialStore.encrypt(passphrase)
    const db = getDatabase()
    db.update(schema.connections)
      .set({ encryptedPassphrase: encrypted })
      .where(eq(schema.connections.id, connectionId))
      .run()
  })

  ipcMain.handle('credentials:clearPassword', (_event, connectionId: string) => {
    const db = getDatabase()
    db.update(schema.connections)
      .set({ encryptedPassword: null })
      .where(eq(schema.connections.id, connectionId))
      .run()
  })

  ipcMain.handle('credentials:hasPassword', (_event, connectionId: string) => {
    const db = getDatabase()
    const conn = db
      .select({ encryptedPassword: schema.connections.encryptedPassword })
      .from(schema.connections)
      .where(eq(schema.connections.id, connectionId))
      .get()
    return conn?.encryptedPassword != null
  })

  // Prefills the edit form so a stored password is visible as masked dots and
  // can be revealed, like getKeyFile does for stored key material.
  ipcMain.handle('credentials:getPassword', (_event, connectionId: string): string | null => {
    const db = getDatabase()
    const conn = db
      .select({ encryptedPassword: schema.connections.encryptedPassword })
      .from(schema.connections)
      .where(eq(schema.connections.id, connectionId))
      .get()
    if (!conn?.encryptedPassword) return null
    try {
      return credentialStore.decrypt(conn.encryptedPassword)
    } catch {
      return null
    }
  })

  ipcMain.handle('credentials:getPassphrase', (_event, connectionId: string): string | null => {
    const db = getDatabase()
    const conn = db
      .select({ encryptedPassphrase: schema.connections.encryptedPassphrase })
      .from(schema.connections)
      .where(eq(schema.connections.id, connectionId))
      .get()
    if (!conn?.encryptedPassphrase) return null
    try {
      return credentialStore.decrypt(conn.encryptedPassphrase)
    } catch {
      return null
    }
  })

  ipcMain.handle('credentials:clearPassphrase', (_event, connectionId: string) => {
    const db = getDatabase()
    db.update(schema.connections)
      .set({ encryptedPassphrase: null })
      .where(eq(schema.connections.id, connectionId))
      .run()
  })

  // === #26: Vault Password Change ===
  // Re-encrypts all stored passwords and passphrases.
  // Since we use electron safeStorage (OS keychain), this re-encrypts
  // by decrypting with current credentials and re-encrypting fresh.
  ipcMain.handle('credentials:changeVaultPassword', async () => {
    const db = getDatabase()
    const connections = db.select({
      id: schema.connections.id,
      encryptedPassword: schema.connections.encryptedPassword,
      encryptedPassphrase: schema.connections.encryptedPassphrase
    }).from(schema.connections).all()

    let reEncrypted = 0

    for (const conn of connections) {
      try {
        if (conn.encryptedPassword) {
          const plain = credentialStore.decrypt(conn.encryptedPassword)
          if (plain) {
            const newEncrypted = credentialStore.encrypt(plain)
            db.update(schema.connections)
              .set({ encryptedPassword: newEncrypted })
              .where(eq(schema.connections.id, conn.id))
              .run()
            reEncrypted++
          }
        }
        if (conn.encryptedPassphrase) {
          const plain = credentialStore.decrypt(conn.encryptedPassphrase)
          if (plain) {
            const newEncrypted = credentialStore.encrypt(plain)
            db.update(schema.connections)
              .set({ encryptedPassphrase: newEncrypted })
              .where(eq(schema.connections.id, conn.id))
              .run()
            reEncrypted++
          }
        }
      } catch (err) {
        console.error(`Failed to re-encrypt credentials for ${conn.id}:`, err)
      }
    }

    auditLogger.log({
      connectionId: 'system',
      connectionName: 'system',
      host: '',
      event: 'vault_password_changed',
      details: { reEncrypted }
    })

    return { reEncrypted }
  })

  // === #27: File Secret Storage ===
  // Store SSH private key content (not just path) encrypted in DB.
  ipcMain.handle(
    'credentials:storeKeyFile',
    (_event, connectionId: string, keyContent: string) => {
      const encrypted = credentialStore.encrypt(keyContent)
      const db = getDatabase()

      // Store encrypted key content in the sshConfig JSON field
      const conn = db.select({ sshConfig: schema.connections.sshConfig })
        .from(schema.connections)
        .where(eq(schema.connections.id, connectionId))
        .get()

      const config = conn?.sshConfig ? JSON.parse(conn.sshConfig) : {}
      config.encryptedKeyContent = encrypted.toString('base64')

      db.update(schema.connections)
        .set({ sshConfig: JSON.stringify(config) })
        .where(eq(schema.connections.id, connectionId))
        .run()

      auditLogger.log({
        connectionId,
        connectionName: connectionId,
        host: '',
        event: 'key_file_stored',
        details: { method: 'encrypted' }
      })
    }
  )

  ipcMain.handle(
    'credentials:getKeyFile',
    (_event, connectionId: string): string | null => {
      const db = getDatabase()
      const conn = db.select({ sshConfig: schema.connections.sshConfig })
        .from(schema.connections)
        .where(eq(schema.connections.id, connectionId))
        .get()

      if (!conn?.sshConfig) return null

      try {
        const config = JSON.parse(conn.sshConfig) as { encryptedKeyContent?: string }
        if (!config.encryptedKeyContent) return null

        const encrypted = Buffer.from(config.encryptedKeyContent, 'base64')
        return credentialStore.decrypt(encrypted)
      } catch {
        return null
      }
    }
  )

  // DB at-rest encryption moved to services/db-encryption.ts + db-encryption.ipc.ts
  // (Phase 5.5): decrypt-on-startup with a passphrase and re-encrypt on quit.

  // === #92: FIDO2/WebAuthn Key Detection ===
  ipcMain.handle(
    'credentials:detectFido2Key',
    (_event, keyPath: string): { isFido2: boolean; keyType: string } => {
      try {
        const content = readFileSync(keyPath, 'utf-8')
        const isSk = content.includes('sk-ssh-ed25519') || content.includes('sk-ecdsa-sha2-nistp256')
        let keyType = 'unknown'
        if (content.includes('sk-ssh-ed25519')) keyType = 'ed25519-sk'
        else if (content.includes('sk-ecdsa-sha2-nistp256')) keyType = 'ecdsa-sk'
        return { isFido2: isSk, keyType }
      } catch {
        return { isFido2: false, keyType: 'unknown' }
      }
    }
  )

  ipcMain.handle(
    'credentials:generateFido2Key',
    async (_event, keyPath: string, keyType: 'ed25519-sk' | 'ecdsa-sk', resident: boolean) => {
      const { execFile } = require('child_process') as typeof import('child_process')
      const { promisify } = require('util') as typeof import('util')
      const execFileAsync = promisify(execFile)

      const args = ['-t', keyType, '-f', keyPath]
      if (resident) {
        args.push('-O', 'resident')
      }
      args.push('-N', '') // Empty passphrase for generation; user can set later

      try {
        await execFileAsync('ssh-keygen', args, { timeout: 30000 })
        return { success: true, keyPath }
      } catch (err) {
        throw new Error(
          `FIDO2 key generation failed: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  )
}
