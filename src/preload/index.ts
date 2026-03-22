import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { ConnectionData, GroupData } from '../main/ipc/connections.ipc'
import type { SftpFileEntry, SftpFileStat } from '../main/services/sftp-manager'
import type { RdpOptions } from '../main/services/external-protocol'
import type { SshConfigEntry } from '../main/services/ssh-config-parser'
import type { AnsibleHost } from '../main/services/ansible-parser'
import type { DiscoveredHost } from '../main/services/cloud-discovery'
import type { HostKeyInfo, PortForward } from '../main/services/ssh-manager'
import type { AuditEvent, AuditEventType } from '../main/services/audit-log'

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
    // Host key verification
    verifyHostKey: (sessionId: string, accepted: boolean) => Promise<void>
    getKnownHosts: () => Promise<HostKeyInfo[]>
    removeKnownHost: (host: string, port: number) => Promise<void>
    onHostKeyUnknown: (
      callback: (
        sessionId: string,
        host: string,
        port: number,
        fingerprint: string,
        algorithm: string
      ) => void
    ) => () => void
    onHostKeyChanged: (
      callback: (
        sessionId: string,
        host: string,
        port: number,
        oldFingerprint: string,
        newFingerprint: string,
        algorithm: string
      ) => void
    ) => () => void
    // Port forwarding
    addLocalForward: (
      sessionId: string,
      localPort: number,
      remoteHost: string,
      remotePort: number
    ) => Promise<string>
    addRemoteForward: (
      sessionId: string,
      remotePort: number,
      localHost: string,
      localPort: number
    ) => Promise<string>
    listForwards: (sessionId: string) => Promise<Array<Omit<PortForward, 'server'>>>
    removeForward: (sessionId: string, forwardId: string) => Promise<void>
  }
  sftp: {
    open: (sshSessionId: string) => Promise<string>
    listDirectory: (sftpId: string, path: string) => Promise<SftpFileEntry[]>
    readFile: (sftpId: string, remotePath: string, localPath: string) => Promise<void>
    writeFile: (sftpId: string, localPath: string, remotePath: string) => Promise<void>
    mkdir: (sftpId: string, path: string) => Promise<void>
    delete: (sftpId: string, path: string) => Promise<void>
    rename: (sftpId: string, oldPath: string, newPath: string) => Promise<void>
    stat: (sftpId: string, path: string) => Promise<SftpFileStat>
    close: (sftpId: string) => Promise<void>
    isOpen: (sftpId: string) => Promise<boolean>
  }
  protocols: {
    connectRDP: (
      host: string,
      port: number,
      username: string,
      password?: string,
      options?: RdpOptions
    ) => Promise<string>
    connectVNC: (host: string, port: number, password?: string) => Promise<string>
    connectTelnet: (host: string, port: number) => Promise<string>
    writeTelnet: (sessionId: string, data: string) => void
    disconnect: (sessionId: string) => Promise<void>
    isConnected: (sessionId: string) => Promise<boolean>
    onData: (callback: (sessionId: string, data: string) => void) => () => void
    onClose: (callback: (sessionId: string, code: number) => void) => () => void
    onError: (callback: (sessionId: string, message: string) => void) => () => void
  }
  system: {
    wol: (macAddress: string, broadcastAddr?: string) => Promise<void>
    startLogging: (
      sessionId: string,
      pattern: string,
      context: { name?: string; host?: string; user?: string }
    ) => Promise<string>
    logData: (sessionId: string, data: string) => void
    stopLogging: (sessionId: string) => Promise<void>
    getLogDir: () => Promise<string>
  }
  import: {
    sshConfig: (configPath?: string) => Promise<SshConfigEntry[]>
    sshConfigApply: (entries: SshConfigEntry[], groupId?: string) => Promise<string[]>
    ansibleInventory: (filePath?: string) => Promise<AnsibleHost[]>
    ansibleInventoryApply: (hosts: AnsibleHost[], groupId?: string) => Promise<string[]>
    exportConnections: () => Promise<string | null>
    importConnections: () => Promise<{ imported: number }>
  }
  discovery: {
    aws: () => Promise<DiscoveredHost[]>
    gcp: () => Promise<DiscoveredHost[]>
    docker: () => Promise<DiscoveredHost[]>
    kubernetes: () => Promise<DiscoveredHost[]>
    available: () => Promise<Record<string, boolean>>
  }
  audit: {
    query: (options?: {
      connectionId?: string
      event?: AuditEventType
      since?: string
      limit?: number
    }) => Promise<AuditEvent[]>
    getLogSize: () => Promise<number>
    rotate: () => Promise<void>
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
    },
    // Host key verification
    verifyHostKey: (sessionId, accepted) =>
      ipcRenderer.invoke('ssh:verifyHostKey', sessionId, accepted),
    getKnownHosts: () => ipcRenderer.invoke('ssh:getKnownHosts'),
    removeKnownHost: (host, port) => ipcRenderer.invoke('ssh:removeKnownHost', host, port),
    onHostKeyUnknown: (callback) => {
      const handler = (
        _e: IpcRendererEvent,
        sessionId: string,
        host: string,
        port: number,
        fingerprint: string,
        algorithm: string
      ): void => callback(sessionId, host, port, fingerprint, algorithm)
      ipcRenderer.on('ssh:hostKeyUnknown', handler)
      return () => ipcRenderer.removeListener('ssh:hostKeyUnknown', handler)
    },
    onHostKeyChanged: (callback) => {
      const handler = (
        _e: IpcRendererEvent,
        sessionId: string,
        host: string,
        port: number,
        oldFingerprint: string,
        newFingerprint: string,
        algorithm: string
      ): void => callback(sessionId, host, port, oldFingerprint, newFingerprint, algorithm)
      ipcRenderer.on('ssh:hostKeyChanged', handler)
      return () => ipcRenderer.removeListener('ssh:hostKeyChanged', handler)
    },
    // Port forwarding
    addLocalForward: (sessionId, localPort, remoteHost, remotePort) =>
      ipcRenderer.invoke('ssh:addLocalForward', sessionId, localPort, remoteHost, remotePort),
    addRemoteForward: (sessionId, remotePort, localHost, localPort) =>
      ipcRenderer.invoke('ssh:addRemoteForward', sessionId, remotePort, localHost, localPort),
    listForwards: (sessionId) => ipcRenderer.invoke('ssh:listForwards', sessionId),
    removeForward: (sessionId, forwardId) =>
      ipcRenderer.invoke('ssh:removeForward', sessionId, forwardId)
  },
  sftp: {
    open: (sshSessionId) => ipcRenderer.invoke('sftp:open', sshSessionId),
    listDirectory: (sftpId, path) => ipcRenderer.invoke('sftp:listDirectory', sftpId, path),
    readFile: (sftpId, remotePath, localPath) =>
      ipcRenderer.invoke('sftp:readFile', sftpId, remotePath, localPath),
    writeFile: (sftpId, localPath, remotePath) =>
      ipcRenderer.invoke('sftp:writeFile', sftpId, localPath, remotePath),
    mkdir: (sftpId, path) => ipcRenderer.invoke('sftp:mkdir', sftpId, path),
    delete: (sftpId, path) => ipcRenderer.invoke('sftp:delete', sftpId, path),
    rename: (sftpId, oldPath, newPath) => ipcRenderer.invoke('sftp:rename', sftpId, oldPath, newPath),
    stat: (sftpId, path) => ipcRenderer.invoke('sftp:stat', sftpId, path),
    close: (sftpId) => ipcRenderer.invoke('sftp:close', sftpId),
    isOpen: (sftpId) => ipcRenderer.invoke('sftp:isOpen', sftpId)
  },
  protocols: {
    connectRDP: (host, port, username, password, options) =>
      ipcRenderer.invoke('protocols:connectRDP', host, port, username, password, options),
    connectVNC: (host, port, password) =>
      ipcRenderer.invoke('protocols:connectVNC', host, port, password),
    connectTelnet: (host, port) => ipcRenderer.invoke('protocols:connectTelnet', host, port),
    writeTelnet: (sessionId, data) => ipcRenderer.send('protocols:writeTelnet', sessionId, data),
    disconnect: (sessionId) => ipcRenderer.invoke('protocols:disconnect', sessionId),
    isConnected: (sessionId) => ipcRenderer.invoke('protocols:isConnected', sessionId),
    onData: (callback) => {
      const handler = (_e: IpcRendererEvent, id: string, data: string): void => callback(id, data)
      ipcRenderer.on('protocols:data', handler)
      return () => ipcRenderer.removeListener('protocols:data', handler)
    },
    onClose: (callback) => {
      const handler = (_e: IpcRendererEvent, id: string, code: number): void => callback(id, code)
      ipcRenderer.on('protocols:close', handler)
      return () => ipcRenderer.removeListener('protocols:close', handler)
    },
    onError: (callback) => {
      const handler = (_e: IpcRendererEvent, id: string, msg: string): void => callback(id, msg)
      ipcRenderer.on('protocols:error', handler)
      return () => ipcRenderer.removeListener('protocols:error', handler)
    }
  },
  system: {
    wol: (macAddress, broadcastAddr) =>
      ipcRenderer.invoke('system:wol', macAddress, broadcastAddr),
    startLogging: (sessionId, pattern, context) =>
      ipcRenderer.invoke('system:startLogging', sessionId, pattern, context),
    logData: (sessionId, data) => ipcRenderer.send('system:logData', sessionId, data),
    stopLogging: (sessionId) => ipcRenderer.invoke('system:stopLogging', sessionId),
    getLogDir: () => ipcRenderer.invoke('system:getLogDir')
  },
  import: {
    sshConfig: (configPath?) => ipcRenderer.invoke('import:sshConfig', configPath),
    sshConfigApply: (entries, groupId?) =>
      ipcRenderer.invoke('import:sshConfigApply', entries, groupId),
    ansibleInventory: (filePath?) => ipcRenderer.invoke('import:ansibleInventory', filePath),
    ansibleInventoryApply: (hosts, groupId?) =>
      ipcRenderer.invoke('import:ansibleInventoryApply', hosts, groupId),
    exportConnections: () => ipcRenderer.invoke('import:exportConnections'),
    importConnections: () => ipcRenderer.invoke('import:importConnections')
  },
  discovery: {
    aws: () => ipcRenderer.invoke('discovery:aws'),
    gcp: () => ipcRenderer.invoke('discovery:gcp'),
    docker: () => ipcRenderer.invoke('discovery:docker'),
    kubernetes: () => ipcRenderer.invoke('discovery:kubernetes'),
    available: () => ipcRenderer.invoke('discovery:available')
  },
  audit: {
    query: (options?) => ipcRenderer.invoke('audit:query', options),
    getLogSize: () => ipcRenderer.invoke('audit:getLogSize'),
    rotate: () => ipcRenderer.invoke('audit:rotate')
  }
}

contextBridge.exposeInMainWorld('bifrost', api)
