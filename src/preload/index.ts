import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { ConnectionData, GroupData } from '../main/ipc/connections.ipc'
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
    connectVNC: (host: string, port: number, password?: string) => Promise<string>
    connectTelnet: (host: string, port: number) => Promise<string>
    writeTelnet: (sessionId: string, data: string) => void
    // #41: Mosh
    connectMosh: (host: string, user?: string, port?: number, extraArgs?: string[]) => Promise<string>
    // #89: AWS SSM
    connectSSM: (instanceId: string, region: string) => Promise<string>
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
  }
  window: {
    toggleFullscreen: () => Promise<void>
    showConfirmDialog: (message: string) => Promise<boolean>
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
    connectVNC: (host, port, password) =>
      ipcRenderer.invoke('protocols:connectVNC', host, port, password),
    connectTelnet: (host, port) => ipcRenderer.invoke('protocols:connectTelnet', host, port),
    writeTelnet: (sessionId, data) => ipcRenderer.send('protocols:writeTelnet', sessionId, data),
    connectMosh: (host, user?, port?, extraArgs?) =>
      ipcRenderer.invoke('protocols:connectMosh', host, user, port, extraArgs),
    connectSSM: (instanceId, region) =>
      ipcRenderer.invoke('protocols:connectSSM', instanceId, region),
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
    validate: (code: string) => ipcRenderer.invoke('scripts:validate', code) as Promise<string | null>
  },
  window: {
    toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
    showConfirmDialog: (message: string) => ipcRenderer.invoke('window:confirmDialog', message)
  }
}

contextBridge.exposeInMainWorld('bifrost', api)
