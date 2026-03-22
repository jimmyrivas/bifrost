import { ipcMain, dialog } from 'electron'
import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { parseSshConfig, type SshConfigEntry } from '../services/ssh-config-parser'
import { parseAnsibleInventory, type AnsibleHost } from '../services/ansible-parser'
import { getDatabase, schema } from '../db'
import type { ConnectionData } from './connections.ipc'

export function registerImportIpc(): void {
  /**
   * Parse ~/.ssh/config and return structured entries.
   */
  ipcMain.handle(
    'import:sshConfig',
    async (_event, configPath?: string): Promise<SshConfigEntry[]> => {
      try {
        return parseSshConfig(configPath)
      } catch (err) {
        throw new Error(
          `Failed to parse SSH config: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  )

  /**
   * Create Bifrost connections from parsed SSH config entries.
   */
  ipcMain.handle(
    'import:sshConfigApply',
    async (
      _event,
      entries: SshConfigEntry[],
      groupId?: string
    ): Promise<string[]> => {
      const db = getDatabase()
      const ids: string[] = []
      const now = new Date().toISOString()

      for (const entry of entries) {
        const id = randomUUID()
        const authType = entry.identityFile ? 'key' : 'manual'

        db.insert(schema.connections)
          .values({
            id,
            groupId: groupId ?? null,
            name: entry.host,
            method: 'ssh',
            host: entry.hostName ?? entry.host,
            port: entry.port ?? 22,
            authType,
            username: entry.user ?? null,
            privateKeyPath: entry.identityFile ?? null,
            launchOnStartup: false,
            reconnectOnDisconnect: false,
            runWithSudo: false,
            useAutossh: false,
            autoSaveLog: false,
            sendIdleOnly: false,
            networkMode: entry.proxyJump ? 'jump' : 'global',
            jumpServerConfig: entry.proxyJump ? JSON.stringify({ proxyJump: entry.proxyJump }) : null,
            terminalOverride: false,
            sshConfig: entry.forwardAgent !== undefined
              ? JSON.stringify({ forwardAgent: entry.forwardAgent })
              : null,
            sortOrder: 0,
            templateId: null,
            createdAt: now,
            updatedAt: now
          })
          .run()

        ids.push(id)
      }

      return ids
    }
  )

  /**
   * Parse an Ansible inventory file (INI or YAML).
   * Shows a file picker dialog if no path is provided.
   */
  ipcMain.handle(
    'import:ansibleInventory',
    async (_event, filePath?: string): Promise<AnsibleHost[]> => {
      let targetPath = filePath

      if (!targetPath) {
        const result = await dialog.showOpenDialog({
          title: 'Select Ansible Inventory File',
          properties: ['openFile'],
          filters: [
            { name: 'Inventory Files', extensions: ['ini', 'yml', 'yaml', 'cfg', 'hosts'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })
        if (result.canceled || result.filePaths.length === 0) {
          return []
        }
        targetPath = result.filePaths[0]
      }

      try {
        return parseAnsibleInventory(targetPath)
      } catch (err) {
        throw new Error(
          `Failed to parse Ansible inventory: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  )

  /**
   * Create Bifrost connections from parsed Ansible inventory entries.
   */
  ipcMain.handle(
    'import:ansibleInventoryApply',
    async (
      _event,
      hosts: AnsibleHost[],
      groupId?: string
    ): Promise<string[]> => {
      const db = getDatabase()
      const ids: string[] = []
      const now = new Date().toISOString()

      for (const ansibleHost of hosts) {
        const id = randomUUID()
        const authType = ansibleHost.privateKeyFile ? 'key' : 'manual'

        db.insert(schema.connections)
          .values({
            id,
            groupId: groupId ?? null,
            name: ansibleHost.name,
            method: 'ssh',
            host: ansibleHost.host,
            port: ansibleHost.port ?? 22,
            authType,
            username: ansibleHost.user ?? null,
            privateKeyPath: ansibleHost.privateKeyFile ?? null,
            launchOnStartup: false,
            reconnectOnDisconnect: false,
            runWithSudo: false,
            useAutossh: false,
            autoSaveLog: false,
            sendIdleOnly: false,
            networkMode: 'global',
            terminalOverride: false,
            sortOrder: 0,
            templateId: null,
            createdAt: now,
            updatedAt: now
          })
          .run()

        ids.push(id)
      }

      return ids
    }
  )

  /**
   * Export all connections as YAML-like structured text.
   * Uses a simple key: value format to avoid external YAML dependencies.
   */
  ipcMain.handle('import:exportConnections', async () => {
    const db = getDatabase()
    const connections = db.select().from(schema.connections).all()
    const groups = db.select().from(schema.groups).all()

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        parentId: g.parentId,
        sortOrder: g.sortOrder,
        icon: g.icon
      })),
      connections: connections.map((c) => ({
        name: c.name,
        method: c.method,
        host: c.host,
        port: c.port,
        authType: c.authType,
        username: c.username,
        privateKeyPath: c.privateKeyPath,
        groupId: c.groupId,
        launchOnStartup: c.launchOnStartup,
        reconnectOnDisconnect: c.reconnectOnDisconnect,
        runWithSudo: c.runWithSudo,
        useAutossh: c.useAutossh,
        tabTitle: c.tabTitle,
        autoSaveLog: c.autoSaveLog,
        logPattern: c.logPattern,
        sendString: c.sendString,
        sendIntervalSeconds: c.sendIntervalSeconds,
        sendIdleOnly: c.sendIdleOnly,
        networkMode: c.networkMode,
        proxyConfig: c.proxyConfig,
        jumpServerConfig: c.jumpServerConfig,
        terminalOverride: c.terminalOverride,
        terminalConfig: c.terminalConfig,
        sshConfig: c.sshConfig,
        sortOrder: c.sortOrder
      }))
    }

    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Export Connections',
      defaultPath: join(homedir(), 'bifrost-connections.json'),
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ]
    })

    if (result.canceled || !result.filePath) return null

    writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
    return result.filePath
  })

  /**
   * Import connections from a previously exported JSON file.
   */
  ipcMain.handle('import:importConnections', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Connections',
      properties: ['openFile'],
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) return { imported: 0 }

    const content = readFileSync(result.filePaths[0], 'utf-8')
    const data = JSON.parse(content) as {
      version: number
      groups?: Array<Record<string, unknown>>
      connections?: Array<ConnectionData>
    }

    if (!data.version || !data.connections) {
      throw new Error('Invalid import file format')
    }

    const db = getDatabase()
    const now = new Date().toISOString()
    let imported = 0

    // Import groups first
    if (data.groups) {
      for (const group of data.groups) {
        const id = randomUUID()
        db.insert(schema.groups)
          .values({
            id,
            name: (group.name as string) ?? 'Imported',
            parentId: null, // Don't preserve parent references across imports
            sortOrder: (group.sortOrder as number) ?? 0,
            icon: (group.icon as string) ?? null
          })
          .run()
      }
    }

    // Import connections
    for (const conn of data.connections) {
      const id = randomUUID()
      db.insert(schema.connections)
        .values({
          id,
          groupId: null,
          name: conn.name,
          method: conn.method ?? 'ssh',
          host: conn.host ?? null,
          port: conn.port ?? null,
          authType: conn.authType ?? null,
          username: conn.username ?? null,
          privateKeyPath: conn.privateKeyPath ?? null,
          launchOnStartup: conn.launchOnStartup ?? false,
          reconnectOnDisconnect: conn.reconnectOnDisconnect ?? false,
          runWithSudo: conn.runWithSudo ?? false,
          useAutossh: conn.useAutossh ?? false,
          tabTitle: conn.tabTitle ?? null,
          autoSaveLog: conn.autoSaveLog ?? false,
          logPattern: conn.logPattern ?? null,
          sendString: conn.sendString ?? null,
          sendIntervalSeconds: conn.sendIntervalSeconds ?? null,
          sendIdleOnly: conn.sendIdleOnly ?? false,
          networkMode: conn.networkMode ?? 'global',
          proxyConfig: conn.proxyConfig ?? null,
          jumpServerConfig: conn.jumpServerConfig ?? null,
          terminalOverride: conn.terminalOverride ?? false,
          terminalConfig: conn.terminalConfig ?? null,
          sshConfig: conn.sshConfig ?? null,
          sortOrder: conn.sortOrder ?? 0,
          templateId: null,
          createdAt: now,
          updatedAt: now
        })
        .run()
      imported++
    }

    return { imported }
  })
}
