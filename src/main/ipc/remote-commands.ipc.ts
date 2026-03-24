import { ipcMain } from 'electron'
import { getDatabase, schema } from '../db'
import { eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export interface RemoteCommandData {
  id?: string
  connectionId?: string | null // null = global command
  command: string
  description: string
  cmdGroup?: string
  confirm?: boolean
  sendIntro?: boolean
  keybinding?: string
  sortOrder?: number
}

export function registerRemoteCommandsIpc(): void {
  // List remote commands — global (connectionId=null) + per-connection
  ipcMain.handle('remoteCommands:list', (_event, connectionId?: string) => {
    const db = getDatabase()
    // Always include global commands (connectionId IS NULL)
    const globalCmds = db.select().from(schema.remoteCommands)
      .where(isNull(schema.remoteCommands.connectionId))
      .all()

    if (!connectionId) return globalCmds

    // Also include connection-specific commands
    const connCmds = db.select().from(schema.remoteCommands)
      .where(eq(schema.remoteCommands.connectionId, connectionId))
      .all()

    return [...globalCmds, ...connCmds]
  })

  ipcMain.handle('remoteCommands:create', (_event, data: RemoteCommandData) => {
    const db = getDatabase()
    const id = randomUUID()
    db.insert(schema.remoteCommands)
      .values({
        id,
        connectionId: data.connectionId ?? null,
        command: data.command,
        description: data.description || data.command,
        cmdGroup: data.cmdGroup ?? '',
        confirm: data.confirm ?? false,
        sendIntro: data.sendIntro ?? true,
        keybinding: data.keybinding ?? '',
        sortOrder: data.sortOrder ?? 0,
        createdAt: new Date().toISOString()
      })
      .run()
    return id
  })

  ipcMain.handle('remoteCommands:update', (_event, id: string, data: Partial<RemoteCommandData>) => {
    const db = getDatabase()
    const updates: Record<string, unknown> = {}
    if (data.command !== undefined) updates.command = data.command
    if (data.description !== undefined) updates.description = data.description
    if (data.cmdGroup !== undefined) updates.cmdGroup = data.cmdGroup
    if (data.confirm !== undefined) updates.confirm = data.confirm
    if (data.sendIntro !== undefined) updates.sendIntro = data.sendIntro
    if (data.keybinding !== undefined) updates.keybinding = data.keybinding
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder
    if (data.connectionId !== undefined) updates.connectionId = data.connectionId

    db.update(schema.remoteCommands)
      .set(updates)
      .where(eq(schema.remoteCommands.id, id))
      .run()
  })

  ipcMain.handle('remoteCommands:delete', (_event, id: string) => {
    const db = getDatabase()
    db.delete(schema.remoteCommands)
      .where(eq(schema.remoteCommands.id, id))
      .run()
  })
}
