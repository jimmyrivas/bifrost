import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { ConnectionData, GroupData } from '../main/ipc/connections.ipc'

export interface BifrostApi {
  terminal: {
    create: (cols: number, rows: number) => Promise<string>
    write: (id: string, data: string) => void
    resize: (id: string, cols: number, rows: number) => void
    destroy: (id: string) => Promise<void>
    getDefaultShell: () => Promise<string>
    onData: (callback: (id: string, data: string) => void) => () => void
    onExit: (callback: (id: string, exitCode: number) => void) => () => void
  }
  connections: {
    list: () => Promise<ConnectionData[]>
    get: (id: string) => Promise<ConnectionData | undefined>
    create: (data: ConnectionData) => Promise<string>
    update: (id: string, data: Partial<ConnectionData>) => Promise<void>
    delete: (id: string) => Promise<void>
    reorder: (items: Array<{ id: string; sortOrder: number }>) => Promise<void>
    listGroups: () => Promise<GroupData[]>
    createGroup: (data: GroupData) => Promise<string>
    updateGroup: (id: string, data: Partial<GroupData>) => Promise<void>
    deleteGroup: (id: string) => Promise<void>
  }
  credentials: {
    isAvailable: () => Promise<boolean>
    setPassword: (connectionId: string, password: string) => Promise<void>
    setPassphrase: (connectionId: string, passphrase: string) => Promise<void>
    clearPassword: (connectionId: string) => Promise<void>
    hasPassword: (connectionId: string) => Promise<boolean>
  }
  ssh: {
    connect: (connectionId: string) => Promise<string>
    openShell: (sessionId: string, cols: number, rows: number) => Promise<void>
    write: (sessionId: string, data: string) => void
    resize: (sessionId: string, cols: number, rows: number) => void
    disconnect: (sessionId: string) => Promise<void>
    isConnected: (sessionId: string) => Promise<boolean>
    onData: (callback: (sessionId: string, data: string) => void) => () => void
    onClose: (callback: (sessionId: string) => void) => () => void
  }
}

const api: BifrostApi = {
  terminal: {
    create: (cols, rows) => ipcRenderer.invoke('terminal:create', cols, rows),
    write: (id, data) => ipcRenderer.send('terminal:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),
    destroy: (id) => ipcRenderer.invoke('terminal:destroy', id),
    getDefaultShell: () => ipcRenderer.invoke('terminal:getDefaultShell'),
    onData: (callback) => {
      const handler = (_e: IpcRendererEvent, id: string, data: string): void => callback(id, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback) => {
      const handler = (_e: IpcRendererEvent, id: string, code: number): void => callback(id, code)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    }
  },
  connections: {
    list: () => ipcRenderer.invoke('connections:list'),
    get: (id) => ipcRenderer.invoke('connections:get', id),
    create: (data) => ipcRenderer.invoke('connections:create', data),
    update: (id, data) => ipcRenderer.invoke('connections:update', id, data),
    delete: (id) => ipcRenderer.invoke('connections:delete', id),
    reorder: (items) => ipcRenderer.invoke('connections:reorder', items),
    listGroups: () => ipcRenderer.invoke('connections:listGroups'),
    createGroup: (data) => ipcRenderer.invoke('connections:createGroup', data),
    updateGroup: (id, data) => ipcRenderer.invoke('connections:updateGroup', id, data),
    deleteGroup: (id) => ipcRenderer.invoke('connections:deleteGroup', id)
  },
  credentials: {
    isAvailable: () => ipcRenderer.invoke('credentials:isAvailable'),
    setPassword: (id, pass) => ipcRenderer.invoke('credentials:setPassword', id, pass),
    setPassphrase: (id, pass) => ipcRenderer.invoke('credentials:setPassphrase', id, pass),
    clearPassword: (id) => ipcRenderer.invoke('credentials:clearPassword', id),
    hasPassword: (id) => ipcRenderer.invoke('credentials:hasPassword', id)
  },
  ssh: {
    connect: (connectionId) => ipcRenderer.invoke('ssh:connect', connectionId),
    openShell: (sessionId, cols, rows) => ipcRenderer.invoke('ssh:openShell', sessionId, cols, rows),
    write: (sessionId, data) => ipcRenderer.send('ssh:write', sessionId, data),
    resize: (sessionId, cols, rows) => ipcRenderer.send('ssh:resize', sessionId, cols, rows),
    disconnect: (sessionId) => ipcRenderer.invoke('ssh:disconnect', sessionId),
    isConnected: (sessionId) => ipcRenderer.invoke('ssh:isConnected', sessionId),
    onData: (callback) => {
      const handler = (_e: IpcRendererEvent, id: string, data: string): void => callback(id, data)
      ipcRenderer.on('ssh:data', handler)
      return () => ipcRenderer.removeListener('ssh:data', handler)
    },
    onClose: (callback) => {
      const handler = (_e: IpcRendererEvent, id: string): void => callback(id)
      ipcRenderer.on('ssh:close', handler)
      return () => ipcRenderer.removeListener('ssh:close', handler)
    }
  }
}

contextBridge.exposeInMainWorld('bifrost', api)
