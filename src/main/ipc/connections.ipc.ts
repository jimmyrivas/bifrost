import { ipcMain } from 'electron'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { variableEngine, type VariableContext } from '../services/variable-engine'
import { checkCycleForJson, sealInlinePasswords } from '../services/jump-host/runtime'

export interface ConnectionData {
  id?: string
  groupId?: string | null
  name: string
  method: 'ssh' | 'mosh' | 'rdp' | 'vnc' | 'telnet' | 'local' | 'ftp'
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

  ipcMain.handle('connections:create', async (_event, data: ConnectionData) => {
    const db = getDatabase()
    const id = data.id ?? randomUUID()
    const now = new Date().toISOString()
    if (data.jumpServerConfig) {
      const cycle = await checkCycleForJson(id, data.jumpServerConfig)
      if (cycle) throw new Error(cycle)
    }
    const sealedJump = sealInlinePasswords(data.jumpServerConfig ?? null)
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
        jumpServerConfig: sealedJump,
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

  ipcMain.handle('connections:update', async (_event, id: string, data: Partial<ConnectionData>) => {
    const db = getDatabase()
    if (data.jumpServerConfig !== undefined && data.jumpServerConfig !== null) {
      const cycle = await checkCycleForJson(id, data.jumpServerConfig)
      if (cycle) throw new Error(cycle)
    }
    const patch: Partial<ConnectionData> = { ...data }
    if (data.jumpServerConfig !== undefined) {
      patch.jumpServerConfig = sealInlinePasswords(data.jumpServerConfig)
    }
    db.update(schema.connections)
      .set({ ...patch, updatedAt: new Date().toISOString() })
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

  // Resolve a tab title template using the variable engine
  ipcMain.handle('connections:resolveTabTitle', async (_event, template: string, connectionId?: string) => {
    const db = getDatabase()
    let ctx: VariableContext = {}

    if (connectionId) {
      const conn = db.select().from(schema.connections).where(eq(schema.connections.id, connectionId)).get()
      if (conn) {
        ctx = {
          connectionId,
          ip: conn.host ?? undefined,
          port: conn.port ?? undefined,
          user: conn.username ?? undefined,
          name: conn.name ?? undefined,
          title: conn.tabTitle ?? undefined
        }
      }
    }

    return variableEngine.resolveInternal(template, ctx)
  })

  // Exec commands (pre/post connection hooks)
  ipcMain.handle('execCommands:list', (_event, connectionId: string) => {
    const db = getDatabase()
    return db.select().from(schema.execCommands)
      .where(eq(schema.execCommands.connectionId, connectionId))
      .all()
  })

  ipcMain.handle('execCommands:save', (_event, connectionId: string, commands: Array<{ phase: string; command: string; ask: boolean; isDefault: boolean; sortOrder: number }>) => {
    const db = getDatabase()
    // Delete existing and re-insert
    db.delete(schema.execCommands)
      .where(eq(schema.execCommands.connectionId, connectionId))
      .run()
    for (const cmd of commands) {
      db.insert(schema.execCommands)
        .values({
          id: randomUUID(),
          connectionId,
          phase: cmd.phase as 'pre' | 'post',
          command: cmd.command,
          ask: cmd.ask ?? false,
          isDefault: cmd.isDefault ?? true,
          sortOrder: cmd.sortOrder
        })
        .run()
    }
  })

  // Connection Templates
  ipcMain.handle('templates:list', () => {
    const db = getDatabase()
    return db.select().from(schema.connectionTemplates).all()
  })

  ipcMain.handle('templates:create', (_event, name: string, config: string) => {
    const db = getDatabase()
    const id = randomUUID()
    db.insert(schema.connectionTemplates).values({ id, name, config }).run()
    return id
  })

  ipcMain.handle('templates:delete', (_event, id: string) => {
    const db = getDatabase()
    db.delete(schema.connectionTemplates).where(eq(schema.connectionTemplates.id, id)).run()
  })
}
