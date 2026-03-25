import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { ConnectionData, GroupData } from '../main/ipc/connections.ipc'
import type { RemoteCommandData } from '../main/ipc/remote-commands.ipc'
import type { TunnelData } from '../main/ipc/tunnels.ipc'
import type { SftpFileEntry, SftpFileStat } from '../main/services/sftp-manager'
import type { RdpOptions } from '../main/services/external-protocol'
import type { SshConfigEntry } from '../main/services/ssh-config-parser'
import type { AnsibleHost } from '../main/services/ansible-parser'
import type { DiscoveredHost } from '../main/services/cloud-discovery'
import type { HostKeyInfo, PortForward, SshAlgorithms, SshConnectionConfig } from '../main/services/ssh-manager'
import type { AuditEvent, AuditEventType } from '../main/services/audit-log'
import type { SignedCertificateResult, VaultSignOptions, LocalCaSignOptions } from '../main/services/ssh-ca'
import type { RecordingInfo } from '../main/services/session-recorder'
import type { TerraformHost } from '../main/services/terraform-parser'

export interface AiChunkCallback {
  (text: string, done: boolean): void
}

export interface BifrostApi {
  terminal: {
    create: (cols: number, rows: number, shell?: string, shellArgs?: string[]) => Promise<string>
    write: (id: string, data: string) => void
    resize: (id: string, cols: number, rows: number) => void
    destroy: (id: string) => Promise<void>
    getDefaultShell: () => Promise<string>
    listShells: () => Promise<Array<{ id: string; name: string; path: string; args?: string[]; elevated?: boolean }>>
    onData: (callback: (id: string, data: string) => void) => () => void
    onExit: (callback: (id: string, exitCode: number) => void) => () => void
    transferOwnership: (terminalId: string) => Promise<void>
    getBuffer: (terminalId: string) => Promise<string>
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
    resolveTabTitle: (template: string, connectionId?: string) => Promise<string>
  }
  execCommands: {
    list: (connectionId: string) => Promise<Array<{ id: string; phase: string; command: string; ask: boolean; isDefault: boolean; sortOrder: number }>>
    save: (connectionId: string, commands: Array<{ phase: string; command: string; ask: boolean; isDefault: boolean; sortOrder: number }>) => Promise<void>
  }
  credentials: {
    isAvailable: () => Promise<boolean>
    setPassword: (connectionId: string, password: string) => Promise<void>
    setPassphrase: (connectionId: string, passphrase: string) => Promise<void>
    clearPassword: (connectionId: string) => Promise<void>
    hasPassword: (connectionId: string) => Promise<boolean>
    // #26: Vault password change
    changeVaultPassword: () => Promise<{ reEncrypted: number }>
    // #27: Key file storage
    storeKeyFile: (connectionId: string, keyContent: string) => Promise<void>
    getKeyFile: (connectionId: string) => Promise<string | null>
    // #28: Config encryption
    encryptDatabase: (password: string) => Promise<string>
    decryptDatabase: (encryptedPath: string, password: string) => Promise<string>
    // #92: FIDO2
    detectFido2Key: (keyPath: string) => Promise<{ isFido2: boolean; keyType: string }>
    generateFido2Key: (
      keyPath: string,
      keyType: 'ed25519-sk' | 'ecdsa-sk',
      resident: boolean
    ) => Promise<{ success: boolean; keyPath: string }>
  }
  ssh: {
    connect: (connectionId: string) => Promise<string>
    openShell: (sessionId: string, cols: number, rows: number, connectionId?: string) => Promise<void>
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
    // #17: Algorithm selection
    listSupportedAlgorithms: () => Promise<{
      ciphers: string[]
      kex: string[]
      hmac: string[]
      hostkey: string[]
    }>
    // #23: Session multiplexing
    findExistingSession: (config: SshConnectionConfig) => Promise<string | undefined>
    acquireSession: (sessionId: string) => Promise<boolean>
    releaseSession: (sessionId: string) => Promise<void>
    // #96: MFA/2FA keyboard interactive
    respondKeyboardInteractive: (sessionId: string, responses: string[]) => Promise<void>
    onKeyboardInteractive: (
      callback: (sessionId: string, prompts: Array<{ prompt: string; echo: boolean }>) => void
    ) => () => void
    // #93: Session recording
    startRecording: (
      sessionId: string,
      options?: { width?: number; height?: number; title?: string }
    ) => Promise<string>
    stopRecording: (sessionId: string) => Promise<string | null>
    isRecording: (sessionId: string) => Promise<boolean>
    listRecordings: () => Promise<RecordingInfo[]>
    getRecording: (recordingId: string) => Promise<string | null>
    deleteRecording: (recordingId: string) => Promise<boolean>
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
    connectVNC: (host: string, port: number, password?: string, preferredViewer?: string) => Promise<string>
    connectTelnet: (host: string, port: number) => Promise<string>
    writeTelnet: (sessionId: string, data: string) => void
    // #41: Mosh
    connectMosh: (host: string, user?: string, port?: number, extraArgs?: string[]) => Promise<string>
    // #89: AWS SSM
    connectSSM: (instanceId: string, region: string) => Promise<string>
    // #42: FTP
    connectFTP: (host: string, port: number, user?: string, password?: string) => Promise<string>
    // #43: TN3270
    connect3270: (host: string, port: number) => Promise<string>
    // #45: WebDAV
    connectWebDAV: (host: string, port: number, user?: string, password?: string) => Promise<string>
    writePty: (sessionId: string, data: string) => void
    resizePty: (sessionId: string, cols: number, rows: number) => void
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
    healthPing: (connectionId: string, host: string) => Promise<{ connectionId: string; host: string; reachable: boolean; latencyMs: number | null }>
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
    azure: () => Promise<DiscoveredHost[]>
    docker: () => Promise<DiscoveredHost[]>
    podman: () => Promise<DiscoveredHost[]>
    kubernetes: () => Promise<DiscoveredHost[]>
    terraform: (filePath: string) => Promise<TerraformHost[]>
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
  ai: {
    checkAvailable: () => Promise<boolean>
    listModels: () => Promise<string[]>
    generate: (prompt: string, context?: string) => Promise<string>
    explain: (command: string) => Promise<string>
    onChunk: (callback: (text: string, done: boolean) => void) => () => void
    getConfig: () => Promise<{ provider: string; apiKey: string; model: string; ollamaUrl: string }>
    setConfig: (cfg: { provider?: string; apiKey?: string; model?: string; ollamaUrl?: string }) => Promise<void>
  }
  configSync: {
    exportToGit: (repoPath: string) => Promise<{ exported: number }>
    importFromGit: (repoPath: string) => Promise<{ imported: number }>
    sync: (repoPath: string) => Promise<{ exported: number; imported: number }>
  }
  // #91: SSH CA
  sshCa: {
    signWithVault: (options: VaultSignOptions) => Promise<SignedCertificateResult>
    signWithLocalCa: (options: LocalCaSignOptions) => Promise<SignedCertificateResult>
    isSshKeygenAvailable: () => Promise<boolean>
    isVaultCliAvailable: () => Promise<boolean>
  }
  // #78, #79, #80: Extended password managers
  passwordManagers: {
    detect: () => Promise<Record<string, unknown>>
    // Vault SSH Engine
    vaultSignSSHKey: (pubKeyPath: string, role: string, addr: string, token: string) => Promise<string>
    vaultListRoles: (addr: string, token: string) => Promise<string[]>
    vaultGetSecret: (path: string, addr: string, token: string) => Promise<string>
    vaultIsAvailable: () => Promise<boolean>
    // AWS Secrets Manager
    awsSMGetSecret: (secretId: string) => Promise<string>
    awsSMListSecrets: () => Promise<Array<{ name: string; arn: string; description: string }>>
    awsSMIsAvailable: () => Promise<boolean>
    // Azure Key Vault
    azureKVGetSecret: (vaultName: string, secretName: string) => Promise<string>
    azureKVListSecrets: (vaultName: string) => Promise<Array<{ name: string; id: string; enabled: boolean }>>
    azureKVIsAvailable: () => Promise<boolean>
  }
  scripts: {
    list: () => Promise<Array<{ id: string; name: string; description: string; code: string; createdAt: string; updatedAt: string }>>
    get: (id: string) => Promise<{ id: string; name: string; description: string; code: string; createdAt: string; updatedAt: string } | null>
    save: (script: { name: string; description: string; code: string }) => Promise<{ id: string; name: string; description: string; code: string; createdAt: string; updatedAt: string }>
    update: (id: string, updates: Record<string, unknown>) => Promise<void>
    delete: (id: string) => Promise<void>
    validate: (code: string) => Promise<string | null>
    execute: (code: string) => Promise<void>
    onOutput: (callback: (msg: { type: string; text?: string; message?: string }) => void) => () => void
  }
  fonts: {
    listMonospace: () => Promise<string[]>
  }
  notes: {
    list: (tag?: string) => Promise<Array<{ id: string; content: string; connectionId: string | null; connectionName: string; host: string; user: string; tag: string; tabTitle: string; createdAt: string }>>
    search: (query: string) => Promise<Array<{ id: string; content: string; connectionId: string | null; connectionName: string; host: string; user: string; tag: string; tabTitle: string; createdAt: string }>>
    create: (data: { content: string; connectionId?: string; connectionName?: string; host?: string; user?: string; tag?: string; tabTitle?: string }) => Promise<string>
    delete: (id: string) => Promise<void>
  }
  remoteCommands: {
    list: (connectionId?: string) => Promise<RemoteCommandData[]>
    create: (data: RemoteCommandData) => Promise<string>
    update: (id: string, data: Partial<RemoteCommandData>) => Promise<void>
    delete: (id: string) => Promise<void>
  }
  templates: {
    list: () => Promise<Array<{ id: string; name: string; config: string }>>
    create: (name: string, config: string) => Promise<string>
    delete: (id: string) => Promise<void>
  }
  expect: {
    setDebug: (sessionId: string, enabled: boolean) => Promise<void>
    getStatus: (sessionId: string) => Promise<{ active: boolean; rulesCount: number; currentRule: { id: string; pattern: string } | null; debug: boolean; log: string[] }>
  }
  tunnels: {
    list: () => Promise<TunnelData[]>
    get: (id: string) => Promise<TunnelData | undefined>
    create: (data: TunnelData) => Promise<string>
    update: (id: string, data: Partial<TunnelData>) => Promise<void>
    delete: (id: string) => Promise<void>
    start: (id: string) => Promise<{ ok: boolean; message: string }>
    stop: (id: string) => Promise<{ ok: boolean; message: string }>
    stopAll: () => Promise<{ ok: boolean; message: string }>
    status: (id: string) => Promise<{ active: boolean; uptime: number }>
    listActive: () => Promise<Array<{ tunnelId: string; sessionId: string; uptime: number }>>
  }
  // #29-31: Plugin system
  plugins: {
    list: () => Promise<Array<{ name: string; version: string; description: string; path: string; valid: boolean }>>
    install: (packageName: string) => Promise<{ name: string; version: string; description: string; path: string; valid: boolean }>
    uninstall: (pluginName: string) => Promise<void>
  }
  window: {
    toggleFullscreen: () => Promise<void>
    showConfirmDialog: (message: string) => Promise<boolean>
    showSaveDialog: (defaultName: string) => Promise<string | null>
    showOpenDialog: () => Promise<string[]>
    detachTab: (tabId: string, title: string, connectionId?: string, sessionId?: string) => Promise<void>
    reattachTab: (tabId: string) => Promise<void>
    onTabReattached: (callback: (tabId: string) => void) => () => void
  }
}

const api: BifrostApi = {
  terminal: {
    create: (cols, rows, shell?, shellArgs?) => ipcRenderer.invoke('terminal:create', cols, rows, shell, shellArgs),
    write: (id, data) => ipcRenderer.send('terminal:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),
    destroy: (id) => ipcRenderer.invoke('terminal:destroy', id),
    getDefaultShell: () => ipcRenderer.invoke('terminal:getDefaultShell'),
    listShells: () => ipcRenderer.invoke('terminal:listShells'),
    onData: (callback) => {
      const handler = (_e: IpcRendererEvent, id: string, data: string): void => callback(id, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback) => {
      const handler = (_e: IpcRendererEvent, id: string, code: number): void => callback(id, code)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },
    transferOwnership: (terminalId) => ipcRenderer.invoke('terminal:transferOwnership', terminalId),
    getBuffer: (terminalId) => ipcRenderer.invoke('terminal:getBuffer', terminalId)
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
    deleteGroup: (id) => ipcRenderer.invoke('connections:deleteGroup', id),
    resolveTabTitle: (template, connectionId) => ipcRenderer.invoke('connections:resolveTabTitle', template, connectionId)
  },
  execCommands: {
    list: (connectionId) => ipcRenderer.invoke('execCommands:list', connectionId),
    save: (connectionId, commands) => ipcRenderer.invoke('execCommands:save', connectionId, commands)
  },
  credentials: {
    isAvailable: () => ipcRenderer.invoke('credentials:isAvailable'),
    setPassword: (id, pass) => ipcRenderer.invoke('credentials:setPassword', id, pass),
    setPassphrase: (id, pass) => ipcRenderer.invoke('credentials:setPassphrase', id, pass),
    clearPassword: (id) => ipcRenderer.invoke('credentials:clearPassword', id),
    hasPassword: (id) => ipcRenderer.invoke('credentials:hasPassword', id),
    changeVaultPassword: () => ipcRenderer.invoke('credentials:changeVaultPassword'),
    storeKeyFile: (id, keyContent) => ipcRenderer.invoke('credentials:storeKeyFile', id, keyContent),
    getKeyFile: (id) => ipcRenderer.invoke('credentials:getKeyFile', id),
    encryptDatabase: (password) => ipcRenderer.invoke('credentials:encryptDatabase', password),
    decryptDatabase: (encryptedPath, password) =>
      ipcRenderer.invoke('credentials:decryptDatabase', encryptedPath, password),
    detectFido2Key: (keyPath) => ipcRenderer.invoke('credentials:detectFido2Key', keyPath),
    generateFido2Key: (keyPath, keyType, resident) =>
      ipcRenderer.invoke('credentials:generateFido2Key', keyPath, keyType, resident)
  },
  ssh: {
    connect: (connectionId) => ipcRenderer.invoke('ssh:connect', connectionId),
    openShell: (sessionId, cols, rows, connectionId?) => ipcRenderer.invoke('ssh:openShell', sessionId, cols, rows, connectionId),
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
      ipcRenderer.invoke('ssh:removeForward', sessionId, forwardId),
    // Algorithm selection
    listSupportedAlgorithms: () => ipcRenderer.invoke('ssh:listSupportedAlgorithms'),
    // Session multiplexing
    findExistingSession: (config) => ipcRenderer.invoke('ssh:findExistingSession', config),
    acquireSession: (sessionId) => ipcRenderer.invoke('ssh:acquireSession', sessionId),
    releaseSession: (sessionId) => ipcRenderer.invoke('ssh:releaseSession', sessionId),
    // MFA/2FA
    respondKeyboardInteractive: (sessionId, responses) =>
      ipcRenderer.invoke('ssh:respondKeyboardInteractive', sessionId, responses),
    onKeyboardInteractive: (callback) => {
      const handler = (
        _e: IpcRendererEvent,
        sessionId: string,
        prompts: Array<{ prompt: string; echo: boolean }>
      ): void => callback(sessionId, prompts)
      ipcRenderer.on('ssh:keyboardInteractive', handler)
      return () => ipcRenderer.removeListener('ssh:keyboardInteractive', handler)
    },
    // Session recording
    startRecording: (sessionId, options?) =>
      ipcRenderer.invoke('ssh:startRecording', sessionId, options),
    stopRecording: (sessionId) => ipcRenderer.invoke('ssh:stopRecording', sessionId),
    isRecording: (sessionId) => ipcRenderer.invoke('ssh:isRecording', sessionId),
    listRecordings: () => ipcRenderer.invoke('ssh:listRecordings'),
    getRecording: (recordingId) => ipcRenderer.invoke('ssh:getRecording', recordingId),
    deleteRecording: (recordingId) => ipcRenderer.invoke('ssh:deleteRecording', recordingId)
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
    connectVNC: (host, port, password, preferredViewer?) =>
      ipcRenderer.invoke('protocols:connectVNC', host, port, password, preferredViewer),
    connectTelnet: (host, port) => ipcRenderer.invoke('protocols:connectTelnet', host, port),
    writeTelnet: (sessionId, data) => ipcRenderer.send('protocols:writeTelnet', sessionId, data),
    connectMosh: (host, user?, port?, extraArgs?) =>
      ipcRenderer.invoke('protocols:connectMosh', host, user, port, extraArgs),
    connectSSM: (instanceId, region) =>
      ipcRenderer.invoke('protocols:connectSSM', instanceId, region),
    connectFTP: (host, port, user?, password?) =>
      ipcRenderer.invoke('protocols:connectFTP', host, port, user, password),
    connect3270: (host, port) =>
      ipcRenderer.invoke('protocols:connect3270', host, port),
    connectWebDAV: (host, port, user?, password?) =>
      ipcRenderer.invoke('protocols:connectWebDAV', host, port, user, password),
    writePty: (sessionId, data) => ipcRenderer.send('protocols:writePty', sessionId, data),
    resizePty: (sessionId, cols, rows) =>
      ipcRenderer.send('protocols:resizePty', sessionId, cols, rows),
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
    getLogDir: () => ipcRenderer.invoke('system:getLogDir'),
    healthPing: (connectionId, host) => ipcRenderer.invoke('health:ping', connectionId, host)
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
    azure: () => ipcRenderer.invoke('discovery:azure'),
    docker: () => ipcRenderer.invoke('discovery:docker'),
    podman: () => ipcRenderer.invoke('discovery:podman'),
    kubernetes: () => ipcRenderer.invoke('discovery:kubernetes'),
    terraform: (filePath) => ipcRenderer.invoke('discovery:terraform', filePath),
    available: () => ipcRenderer.invoke('discovery:available')
  },
  audit: {
    query: (options?) => ipcRenderer.invoke('audit:query', options),
    getLogSize: () => ipcRenderer.invoke('audit:getLogSize'),
    rotate: () => ipcRenderer.invoke('audit:rotate')
  },
  ai: {
    checkAvailable: () => ipcRenderer.invoke('ai:checkAvailable'),
    listModels: () => ipcRenderer.invoke('ai:listModels'),
    generate: (prompt, context?) => ipcRenderer.invoke('ai:generate', prompt, context),
    explain: (command) => ipcRenderer.invoke('ai:explain', command),
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    setConfig: (cfg) => ipcRenderer.invoke('ai:setConfig', cfg),
    onChunk: (callback) => {
      const handler = (_e: IpcRendererEvent, text: string, done: boolean): void =>
        callback(text, done)
      ipcRenderer.on('ai:chunk', handler)
      return () => ipcRenderer.removeListener('ai:chunk', handler)
    }
  },
  configSync: {
    exportToGit: (repoPath) => ipcRenderer.invoke('configSync:export', repoPath),
    importFromGit: (repoPath) => ipcRenderer.invoke('configSync:import', repoPath),
    sync: (repoPath) => ipcRenderer.invoke('configSync:sync', repoPath)
  },
  sshCa: {
    signWithVault: (options) => ipcRenderer.invoke('sshCa:signWithVault', options),
    signWithLocalCa: (options) => ipcRenderer.invoke('sshCa:signWithLocalCa', options),
    isSshKeygenAvailable: () => ipcRenderer.invoke('sshCa:isSshKeygenAvailable'),
    isVaultCliAvailable: () => ipcRenderer.invoke('sshCa:isVaultCliAvailable')
  },
  passwordManagers: {
    detect: () => ipcRenderer.invoke('pm:detect'),
    vaultSignSSHKey: (pubKeyPath, role, addr, token) =>
      ipcRenderer.invoke('pm:vault:signSSHKey', pubKeyPath, role, addr, token),
    vaultListRoles: (addr, token) => ipcRenderer.invoke('pm:vault:listRoles', addr, token),
    vaultGetSecret: (path, addr, token) => ipcRenderer.invoke('pm:vault:getSecret', path, addr, token),
    vaultIsAvailable: () => ipcRenderer.invoke('pm:vault:isAvailable'),
    awsSMGetSecret: (secretId) => ipcRenderer.invoke('pm:awsSM:getSecret', secretId),
    awsSMListSecrets: () => ipcRenderer.invoke('pm:awsSM:listSecrets'),
    awsSMIsAvailable: () => ipcRenderer.invoke('pm:awsSM:isAvailable'),
    azureKVGetSecret: (vaultName, secretName) =>
      ipcRenderer.invoke('pm:azureKV:getSecret', vaultName, secretName),
    azureKVListSecrets: (vaultName) => ipcRenderer.invoke('pm:azureKV:listSecrets', vaultName),
    azureKVIsAvailable: () => ipcRenderer.invoke('pm:azureKV:isAvailable')
  },
  scripts: {
    list: () => ipcRenderer.invoke('scripts:list'),
    get: (id: string) => ipcRenderer.invoke('scripts:get', id),
    save: (script: { name: string; description: string; code: string }) =>
      ipcRenderer.invoke('scripts:save', script),
    update: (id: string, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('scripts:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('scripts:delete', id),
    validate: (code: string) => ipcRenderer.invoke('scripts:validate', code) as Promise<string | null>,
    execute: (code: string) => ipcRenderer.invoke('scripts:execute', code) as Promise<void>,
    onOutput: (callback: (msg: { type: string; text?: string; message?: string }) => void) => {
      const handler = (_event: unknown, msg: { type: string; text?: string; message?: string }): void => {
        callback(msg)
      }
      ipcRenderer.on('script:output', handler)
      return () => { ipcRenderer.removeListener('script:output', handler) }
    }
  },
  fonts: {
    listMonospace: () => ipcRenderer.invoke('fonts:listMonospace') as Promise<string[]>
  },
  notes: {
    list: (tag?: string) => ipcRenderer.invoke('notes:list', tag),
    search: (query: string) => ipcRenderer.invoke('notes:search', query),
    create: (data: { content: string; connectionId?: string; connectionName?: string; host?: string; user?: string; tag?: string; tabTitle?: string }) =>
      ipcRenderer.invoke('notes:create', data),
    delete: (id: string) => ipcRenderer.invoke('notes:delete', id)
  },
  remoteCommands: {
    list: (connectionId?: string) => ipcRenderer.invoke('remoteCommands:list', connectionId),
    create: (data) => ipcRenderer.invoke('remoteCommands:create', data),
    update: (id, data) => ipcRenderer.invoke('remoteCommands:update', id, data),
    delete: (id) => ipcRenderer.invoke('remoteCommands:delete', id)
  },
  templates: {
    list: () => ipcRenderer.invoke('templates:list'),
    create: (name, config) => ipcRenderer.invoke('templates:create', name, config),
    delete: (id) => ipcRenderer.invoke('templates:delete', id)
  },
  expect: {
    setDebug: (sessionId, enabled) => ipcRenderer.invoke('expect:setDebug', sessionId, enabled),
    getStatus: (sessionId) => ipcRenderer.invoke('expect:getStatus', sessionId)
  },
  tunnels: {
    list: () => ipcRenderer.invoke('tunnels:list'),
    get: (id) => ipcRenderer.invoke('tunnels:get', id),
    create: (data) => ipcRenderer.invoke('tunnels:create', data),
    update: (id, data) => ipcRenderer.invoke('tunnels:update', id, data),
    delete: (id) => ipcRenderer.invoke('tunnels:delete', id),
    start: (id) => ipcRenderer.invoke('tunnels:start', id),
    stop: (id) => ipcRenderer.invoke('tunnels:stop', id),
    stopAll: () => ipcRenderer.invoke('tunnels:stopAll'),
    status: (id) => ipcRenderer.invoke('tunnels:status', id),
    listActive: () => ipcRenderer.invoke('tunnels:listActive')
  },
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    install: (packageName: string) => ipcRenderer.invoke('plugins:install', packageName),
    uninstall: (pluginName: string) => ipcRenderer.invoke('plugins:uninstall', pluginName)
  },
  window: {
    toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
    showConfirmDialog: (message: string) => ipcRenderer.invoke('window:confirmDialog', message),
    showSaveDialog: (defaultName: string) => ipcRenderer.invoke('system:showSaveDialog', defaultName),
    showOpenDialog: () => ipcRenderer.invoke('system:showOpenDialog'),
    detachTab: (tabId: string, title: string, connectionId?: string, sessionId?: string) => ipcRenderer.invoke('window:detachTab', tabId, title, connectionId, sessionId),
    reattachTab: (tabId: string) => ipcRenderer.invoke('window:reattachTab', tabId),
    onTabReattached: (callback: (tabId: string) => void) => {
      const handler = (_e: IpcRendererEvent, tabId: string): void => callback(tabId)
      ipcRenderer.on('window:tabReattached', handler)
      return () => ipcRenderer.removeListener('window:tabReattached', handler)
    }
  }
}

contextBridge.exposeInMainWorld('bifrost', api)
