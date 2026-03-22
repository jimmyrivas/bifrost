import { ipcMain } from 'electron'
import { credentialStore } from '../services/credential-store'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'

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
}
