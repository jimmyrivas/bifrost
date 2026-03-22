import { ipcMain } from 'electron'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export interface ConnectionData {
  id?: string
  groupId?: string | null
  name: string
  method: 'ssh' | 'rdp' | 'vnc' | 'telnet' | 'local' | 'ftp'
  host?: string
  port?: number
  authType?: 'userpass' | 'key' | 'key_pass' | 'manual'
  username?: string
  privateKeyPath?: string | null
  launchOnStartup?: boolean
  reconnectOnDisconnect?: boolean
  runWithSudo?: boolean
  useAutossh?: boolean
  tabTitle?: string
  autoSaveLog?: boolean
  logPattern?: string
  sendString?: string
  sendIntervalSeconds?: number
  sendIdleOnly?: boolean
  networkMode?: 'global' | 'direct' | 'socks' | 'jump'
  proxyConfig?: string
  jumpServerConfig?: string
  terminalOverride?: boolean
  terminalConfig?: string
  sshConfig?: string
  sortOrder?: number
  templateId?: string | null
}

export interface GroupData {
  id?: string
  name: string
  parentId?: string | null
  sortOrder?: number
  icon?: string
}

export function registerConnectionsIpc(): void {
  // === Groups ===
  ipcMain.handle('connections:listGroups', () => {
    const db = getDatabase()
    return db.select().from(schema.groups).all()
  })

  ipcMain.handle('connections:createGroup', (_event, data: GroupData) => {
    const db = getDatabase()
    const id = data.id ?? randomUUID()
    db.insert(schema.groups)
      .values({ id, name: data.name, parentId: data.parentId ?? null, sortOrder: data.sortOrder ?? 0, icon: data.icon ?? null })
      .run()
    return id
  })

  ipcMain.handle('connections:updateGroup', (_event, id: string, data: Partial<GroupData>) => {
    const db = getDatabase()
    db.update(schema.groups).set(data).where(eq(schema.groups.id, id)).run()
  })

  ipcMain.handle('connections:deleteGroup', (_event, id: string) => {
    const db = getDatabase()
    db.delete(schema.groups).where(eq(schema.groups.id, id)).run()
  })

  // === Connections ===
  ipcMain.handle('connections:list', () => {
    const db = getDatabase()
    return db.select().from(schema.connections).all()
  })

  ipcMain.handle('connections:get', (_event, id: string) => {
    const db = getDatabase()
    return db.select().from(schema.connections).where(eq(schema.connections.id, id)).get()
  })

  ipcMain.handle('connections:create', (_event, data: ConnectionData) => {
    const db = getDatabase()
    const id = data.id ?? randomUUID()
    const now = new Date().toISOString()
    db.insert(schema.connections)
      .values({
        id,
        groupId: data.groupId ?? null,
        name: data.name,
        method: data.method,
        host: data.host ?? null,
        port: data.port ?? null,
        authType: data.authType ?? null,
        username: data.username ?? null,
        privateKeyPath: data.privateKeyPath ?? null,
        launchOnStartup: data.launchOnStartup ?? false,
        reconnectOnDisconnect: data.reconnectOnDisconnect ?? false,
        runWithSudo: data.runWithSudo ?? false,
        useAutossh: data.useAutossh ?? false,
        tabTitle: data.tabTitle ?? null,
        autoSaveLog: data.autoSaveLog ?? false,
        logPattern: data.logPattern ?? null,
        sendString: data.sendString ?? null,
        sendIntervalSeconds: data.sendIntervalSeconds ?? null,
        sendIdleOnly: data.sendIdleOnly ?? false,
        networkMode: data.networkMode ?? 'global',
        proxyConfig: data.proxyConfig ?? null,
        jumpServerConfig: data.jumpServerConfig ?? null,
        terminalOverride: data.terminalOverride ?? false,
        terminalConfig: data.terminalConfig ?? null,
        sshConfig: data.sshConfig ?? null,
        sortOrder: data.sortOrder ?? 0,
        templateId: data.templateId ?? null,
        createdAt: now,
        updatedAt: now
      })
      .run()
    return id
  })

  ipcMain.handle('connections:update', (_event, id: string, data: Partial<ConnectionData>) => {
    const db = getDatabase()
    db.update(schema.connections)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(schema.connections.id, id))
      .run()
  })

  ipcMain.handle('connections:delete', (_event, id: string) => {
    const db = getDatabase()
    db.delete(schema.connections).where(eq(schema.connections.id, id)).run()
  })

  ipcMain.handle('connections:reorder', (_event, items: Array<{ id: string; sortOrder: number }>) => {
    const db = getDatabase()
    for (const item of items) {
      db.update(schema.connections)
        .set({ sortOrder: item.sortOrder })
        .where(eq(schema.connections.id, item.id))
        .run()
    }
  })
}
