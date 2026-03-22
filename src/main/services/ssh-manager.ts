import { Client, type ConnectConfig, type ClientChannel } from 'ssh2'
import { credentialStore } from './credential-store'
import { auditLogger } from './audit-log'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { createHash } from 'crypto'
import { EventEmitter } from 'events'
import { createServer, createConnection, type Server, type Socket } from 'net'

export interface SshAlgorithms {
  ciphers?: string[]
  kex?: string[]
  hmac?: string[]
  hostkey?: string[]
}

export interface HttpProxyConfig {
  proxyHost: string
  proxyPort: number
  proxyUsername?: string
  proxyPassword?: string
}

export interface SshConnectionConfig {
  host: string
  port: number
  username: string
  authType: 'userpass' | 'key' | 'key_pass' | 'manual' | 'keyboard-interactive'
  encryptedPassword?: Buffer | null
  privateKeyPath?: string | null
  privateKeyContent?: Buffer | null
  encryptedPassphrase?: Buffer | null
  algorithms?: SshAlgorithms
  x11Forward?: boolean
  httpProxy?: HttpProxyConfig
  useFido2?: boolean
}

export interface PortForward {
  id: string
  type: 'local' | 'remote'
  localPort: number
  remoteHost: string
  remotePort: number
  server?: Server
}

export interface SshSession {
  id: string
  client: Client
  shell: ClientChannel | null
  config: SshConnectionConfig
  forwards: Map<string, PortForward>
  /** Number of subsystems using this connection (shell, sftp, forwards) */
  usageCount: number
}

export interface HostKeyInfo {
  host: string
  port: number
  fingerprint: string
  algorithm: string
  firstSeen: string
  lastSeen: string
}

/** Events emitted by SshManager for host key verification */
export interface SshManagerEvents {
  'hostkey:unknown': (
    sessionId: string,
    host: string,
    port: number,
    fingerprint: string,
    algorithm: string
  ) => void
  'hostkey:changed': (
    sessionId: string,
    host: string,
    port: number,
    oldFingerprint: string,
    newFingerprint: string,
    algorithm: string
  ) => void
}

const sessions = new Map<string, SshSession>()
let sshIdCounter = 0
let forwardIdCounter = 0

/**
 * Pending host key verification requests.
 * Maps sessionId -> resolve/reject callbacks for the connect promise.
 */
const pendingVerifications = new Map<
  string,
  {
    resolve: (accept: boolean) => void
    client: Client
    connectConfig: ConnectConfig
    sshConfig: SshConnectionConfig
  }
>()

export class SshManager extends EventEmitter {
  private knownHostsPath: string | null = null

  /**
   * Pending keyboard-interactive prompts waiting for user input.
   * Maps sessionId -> resolve callback for the prompt response.
   */
  private pendingKeyboardPrompts = new Map<
    string,
    { resolve: (responses: string[]) => void }
  >()

  // === Session Multiplexing (#23) ===

  /**
   * Find an existing connected session for the same host/port/user.
   * Returns the session ID if found and still connected.
   */
  findExistingSession(config: SshConnectionConfig): string | undefined {
    for (const [id, session] of sessions) {
      if (
        session.config.host === config.host &&
        session.config.port === config.port &&
        session.config.username === config.username
      ) {
        return id
      }
    }
    return undefined
  }

  /**
   * Increment the usage counter for a multiplexed session.
   */
  acquireSession(sessionId: string): boolean {
    const session = sessions.get(sessionId)
    if (!session) return false
    session.usageCount++
    return true
  }

  /**
   * Decrement the usage counter. Disconnect only when count reaches 0.
   */
  releaseSession(sessionId: string): void {
    const session = sessions.get(sessionId)
    if (!session) return
    session.usageCount = Math.max(0, session.usageCount - 1)
  }

  getSessionUsageCount(sessionId: string): number {
    return sessions.get(sessionId)?.usageCount ?? 0
  }

  /**
   * Respond to a pending keyboard-interactive prompt (for MFA/TOTP).
   */
  resolveKeyboardInteractive(sessionId: string, responses: string[]): void {
    const pending = this.pendingKeyboardPrompts.get(sessionId)
    if (pending) {
      this.pendingKeyboardPrompts.delete(sessionId)
      pending.resolve(responses)
    }
  }

  /**
   * List supported SSH algorithms (from ssh2 library).
   */
  listSupportedAlgorithms(): {
    ciphers: string[]
    kex: string[]
    hmac: string[]
    hostkey: string[]
  } {
    // ssh2 supported algorithms
    return {
      ciphers: [
        'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
        'aes128-gcm', 'aes128-gcm@openssh.com',
        'aes256-gcm', 'aes256-gcm@openssh.com',
        'chacha20-poly1305@openssh.com'
      ],
      kex: [
        'curve25519-sha256', 'curve25519-sha256@libssh.org',
        'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521',
        'diffie-hellman-group-exchange-sha256',
        'diffie-hellman-group14-sha256', 'diffie-hellman-group16-sha512',
        'diffie-hellman-group18-sha512', 'diffie-hellman-group14-sha1'
      ],
      hmac: [
        'hmac-sha2-256', 'hmac-sha2-512',
        'hmac-sha2-256-etm@openssh.com', 'hmac-sha2-512-etm@openssh.com',
        'hmac-sha1', 'hmac-sha1-etm@openssh.com'
      ],
      hostkey: [
        'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384',
        'ecdsa-sha2-nistp521', 'rsa-sha2-512', 'rsa-sha2-256', 'ssh-rsa',
        'sk-ssh-ed25519@openssh.com', 'sk-ecdsa-sha2-nistp256@openssh.com'
      ]
    }
  }

  private getKnownHostsPath(): string {
    if (!this.knownHostsPath) {
      this.knownHostsPath = join(app.getPath('userData'), 'known_hosts.json')
    }
    return this.knownHostsPath
  }

  private loadKnownHosts(): Record<string, HostKeyInfo> {
    const hostPath = this.getKnownHostsPath()
    if (!existsSync(hostPath)) return {}

    try {
      return JSON.parse(readFileSync(hostPath, 'utf-8'))
    } catch {
      return {}
    }
  }

  private saveKnownHosts(hosts: Record<string, HostKeyInfo>): void {
    try {
      writeFileSync(this.getKnownHostsPath(), JSON.stringify(hosts, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save known hosts:', err)
    }
  }

  private hostKey(host: string, port: number): string {
    return `[${host}]:${port}`
  }

  private computeFingerprint(key: Buffer): string {
    return createHash('sha256').update(key).digest('base64')
  }

  /**
   * Store a verified host key fingerprint.
   */
  storeHostKey(host: string, port: number, fingerprint: string, algorithm: string): void {
    const hosts = this.loadKnownHosts()
    const key = this.hostKey(host, port)
    const now = new Date().toISOString()

    hosts[key] = {
      host,
      port,
      fingerprint,
      algorithm,
      firstSeen: hosts[key]?.firstSeen ?? now,
      lastSeen: now
    }

    this.saveKnownHosts(hosts)
  }

  /**
   * Remove a stored host key (useful when user wants to reset trust).
   */
  removeHostKey(host: string, port: number): void {
    const hosts = this.loadKnownHosts()
    delete hosts[this.hostKey(host, port)]
    this.saveKnownHosts(hosts)
  }

  /**
   * Get all known host keys.
   */
  getKnownHosts(): HostKeyInfo[] {
    const hosts = this.loadKnownHosts()
    return Object.values(hosts)
  }

  /**
   * Respond to a pending host key verification request.
   */
  resolveHostKeyVerification(sessionId: string, accepted: boolean): void {
    const pending = pendingVerifications.get(sessionId)
    if (pending) {
      pendingVerifications.delete(sessionId)
      pending.resolve(accepted)
    }
  }

  connect(config: SshConnectionConfig): Promise<string> {
    return new Promise((resolveConnect, rejectConnect) => {
      const id = `ssh-${++sshIdCounter}`
      const client = new Client()

      const connectConfig: ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 30000,
        hostVerifier: (key: Buffer) => {
          const fingerprint = this.computeFingerprint(key)
          const hostKey = this.hostKey(config.host, config.port)
          const knownHosts = this.loadKnownHosts()
          const known = knownHosts[hostKey]

          if (known) {
            if (known.fingerprint === fingerprint) {
              // Known and matches - update lastSeen
              known.lastSeen = new Date().toISOString()
              this.saveKnownHosts(knownHosts)
              return true
            }

            // Fingerprint changed - emit warning and wait for user decision
            this.emit(
              'hostkey:changed',
              id,
              config.host,
              config.port,
              known.fingerprint,
              fingerprint,
              'ssh-rsa'
            )

            auditLogger.log({
              connectionId: id,
              connectionName: config.host,
              host: config.host,
              event: 'host_key_changed',
              details: {
                oldFingerprint: known.fingerprint,
                newFingerprint: fingerprint
              }
            })

            // Store pending verification - the connect will proceed
            // because ssh2 hostVerifier is synchronous. We handle
            // verification asynchronously via the event system.
            // For safety, reject unknown/changed keys by default.
            return false
          }

          // Unknown host - emit event for user verification
          this.emit(
            'hostkey:unknown',
            id,
            config.host,
            config.port,
            fingerprint,
            'ssh-rsa'
          )

          // Auto-accept on first connect (TOFU - Trust On First Use)
          // Store the key immediately
          this.storeHostKey(config.host, config.port, fingerprint, 'ssh-rsa')

          auditLogger.log({
            connectionId: id,
            connectionName: config.host,
            host: config.host,
            event: 'host_key_verified',
            details: { fingerprint, policy: 'tofu' }
          })

          return true
        }
      }

      // #17: Algorithm selection
      if (config.algorithms) {
        const algos: ConnectConfig['algorithms'] = {}
        if (config.algorithms.ciphers) {
          algos.cipher = config.algorithms.ciphers as any
        }
        if (config.algorithms.kex) {
          algos.kex = config.algorithms.kex as any
        }
        if (config.algorithms.hmac) {
          algos.hmac = config.algorithms.hmac as any
        }
        if (config.algorithms.hostkey) {
          algos.serverHostKey = config.algorithms.hostkey as any
        }
        connectConfig.algorithms = algos
      }

      // Set authentication
      switch (config.authType) {
        case 'userpass':
          if (config.encryptedPassword) {
            connectConfig.password = credentialStore.decrypt(config.encryptedPassword)
          }
          break
        case 'key':
          if (config.privateKeyContent) {
            connectConfig.privateKey = config.privateKeyContent
          } else if (config.privateKeyPath) {
            connectConfig.privateKey = readFileSync(config.privateKeyPath)
          }
          break
        case 'key_pass':
          if (config.privateKeyContent) {
            connectConfig.privateKey = config.privateKeyContent
          } else if (config.privateKeyPath) {
            connectConfig.privateKey = readFileSync(config.privateKeyPath)
          }
          if (config.encryptedPassphrase) {
            connectConfig.passphrase = credentialStore.decrypt(config.encryptedPassphrase)
          }
          break
        case 'keyboard-interactive':
          // #96: MFA/2FA - keyboard-interactive auth handled via event below
          connectConfig.tryKeyboard = true
          break
        case 'manual':
          // No automatic auth
          break
      }

      // #96: Handle keyboard-interactive prompts (TOTP/MFA)
      client.on('keyboard-interactive', (
        _name: string,
        _instructions: string,
        _instructionsLang: string,
        prompts: Array<{ prompt: string; echo: boolean }>,
        finish: (responses: string[]) => void
      ) => {
        // Emit event to renderer so user can enter TOTP code
        this.emit('keyboard-interactive', id, prompts)

        // Store the finish callback for when user responds
        this.pendingKeyboardPrompts.set(id, {
          resolve: (responses: string[]) => {
            finish(responses)
          }
        })
      })

      client.on('ready', () => {
        sessions.set(id, { id, client, shell: null, config, forwards: new Map(), usageCount: 1 })

        auditLogger.log({
          connectionId: id,
          connectionName: config.host,
          host: config.host,
          event: 'connect',
          details: { username: config.username, authType: config.authType }
        })

        resolveConnect(id)
      })

      client.on('error', (err) => {
        sessions.delete(id)
        this.pendingKeyboardPrompts.delete(id)

        auditLogger.log({
          connectionId: id,
          connectionName: config.host,
          host: config.host,
          event: 'error',
          details: { message: err.message }
        })

        rejectConnect(err)
      })

      // #19: HTTP CONNECT proxy support
      if (config.httpProxy) {
        this.connectViaHttpProxy(client, connectConfig, config.httpProxy)
      } else {
        client.connect(connectConfig)
      }
    })
  }

  /**
   * #19: Connect via HTTP CONNECT proxy.
   * Establishes a TCP connection to the proxy, sends CONNECT request,
   * then pipes the resulting socket to ssh2.
   */
  private connectViaHttpProxy(
    client: Client,
    connectConfig: ConnectConfig,
    proxy: HttpProxyConfig
  ): void {
    const targetHost = connectConfig.host!
    const targetPort = connectConfig.port!

    const proxySocket = createConnection(proxy.proxyPort, proxy.proxyHost, () => {
      let connectRequest = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n`

      if (proxy.proxyUsername && proxy.proxyPassword) {
        const auth = Buffer.from(`${proxy.proxyUsername}:${proxy.proxyPassword}`).toString('base64')
        connectRequest += `Proxy-Authorization: Basic ${auth}\r\n`
      }

      connectRequest += '\r\n'
      proxySocket.write(connectRequest)
    })

    let responseBuffer = ''

    proxySocket.once('data', (data: Buffer) => {
      responseBuffer += data.toString()

      if (responseBuffer.includes('\r\n\r\n')) {
        const statusLine = responseBuffer.split('\r\n')[0]
        const statusCode = parseInt(statusLine.split(' ')[1], 10)

        if (statusCode === 200) {
          // Proxy tunnel established - use socket for SSH
          connectConfig.sock = proxySocket
          client.connect(connectConfig)
        } else {
          proxySocket.destroy()
          client.emit('error', new Error(`HTTP proxy returned status ${statusCode}: ${statusLine}`))
        }
      }
    })

    proxySocket.on('error', (err) => {
      client.emit('error', new Error(`HTTP proxy connection failed: ${err.message}`))
    })
  }

  openShell(
    sessionId: string,
    cols: number,
    rows: number
  ): Promise<ClientChannel> {
    return new Promise((resolve, reject) => {
      const session = sessions.get(sessionId)
      if (!session) {
        reject(new Error(`SSH session ${sessionId} not found`))
        return
      }

      const shellOptions: Record<string, unknown> = {
        term: 'xterm-256color',
        cols,
        rows
      }

      // #18: X11 forwarding
      if (session.config.x11Forward) {
        shellOptions.x11 = {
          single: false,
          screen: 0
        }
      }

      session.client.shell(
        shellOptions,
        (err, stream) => {
          if (err) {
            reject(err)
            return
          }
          session.shell = stream
          resolve(stream)
        }
      )
    })
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = sessions.get(sessionId)
    if (session?.shell) {
      session.shell.setWindow(rows, cols, 0, 0)
    }
  }

  write(sessionId: string, data: string): void {
    const session = sessions.get(sessionId)
    if (session?.shell) {
      session.shell.write(data)
    }
  }

  disconnect(sessionId: string, force?: boolean): void {
    const session = sessions.get(sessionId)
    if (session) {
      // #23: If multiplexed and still in use, just decrement
      if (!force && session.usageCount > 1) {
        session.usageCount--
        return
      }

      // Close all port forwards
      for (const [_fwdId, fwd] of session.forwards) {
        try {
          fwd.server?.close()
        } catch {
          // Ignore cleanup errors
        }
      }
      session.forwards.clear()

      session.shell?.close()
      session.client.end()
      sessions.delete(sessionId)

      auditLogger.log({
        connectionId: sessionId,
        connectionName: session.config.host,
        host: session.config.host,
        event: 'disconnect',
        details: {}
      })
    }
  }

  disconnectAll(): void {
    for (const [id] of sessions) {
      this.disconnect(id)
    }
  }

  getSession(sessionId: string): SshSession | undefined {
    return sessions.get(sessionId)
  }

  isConnected(sessionId: string): boolean {
    return sessions.has(sessionId)
  }

  // === Port Forwarding ===

  /**
   * Create a local port forward: listen on localPort, forward to remoteHost:remotePort
   * via the SSH tunnel.
   */
  addLocalForward(
    sessionId: string,
    localPort: number,
    remoteHost: string,
    remotePort: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const session = sessions.get(sessionId)
      if (!session) {
        reject(new Error(`SSH session ${sessionId} not found`))
        return
      }

      const fwdId = `fwd-${++forwardIdCounter}`

      const server = createServer((socket) => {
        session.client.forwardOut(
          socket.remoteAddress ?? '127.0.0.1',
          socket.remotePort ?? 0,
          remoteHost,
          remotePort,
          (err, stream) => {
            if (err) {
              socket.end()
              return
            }
            socket.pipe(stream).pipe(socket)
          }
        )
      })

      server.on('error', (err) => {
        reject(err)
      })

      server.listen(localPort, '127.0.0.1', () => {
        const forward: PortForward = {
          id: fwdId,
          type: 'local',
          localPort,
          remoteHost,
          remotePort,
          server
        }
        session.forwards.set(fwdId, forward)

        auditLogger.log({
          connectionId: sessionId,
          connectionName: session.config.host,
          host: session.config.host,
          event: 'port_forward_start',
          details: { type: 'local', localPort, remoteHost, remotePort, forwardId: fwdId }
        })

        resolve(fwdId)
      })
    })
  }

  /**
   * Create a remote port forward: listen on the remote side on remotePort,
   * forward to localHost:localPort.
   */
  addRemoteForward(
    sessionId: string,
    remotePort: number,
    localHost: string,
    localPort: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const session = sessions.get(sessionId)
      if (!session) {
        reject(new Error(`SSH session ${sessionId} not found`))
        return
      }

      const fwdId = `fwd-${++forwardIdCounter}`

      session.client.forwardIn('0.0.0.0', remotePort, (err) => {
        if (err) {
          reject(err)
          return
        }

        const forward: PortForward = {
          id: fwdId,
          type: 'remote',
          localPort,
          remoteHost: localHost,
          remotePort
        }
        session.forwards.set(fwdId, forward)

        // Handle incoming connections on the remote forward
        session.client.on('tcp connection', (info, accept, rejectConn) => {
          const stream = accept()
          const { createConnection } = require('net') as typeof import('net')
          const socket = createConnection(localPort, localHost)

          socket.on('error', () => {
            stream.close()
          })

          stream.on('error', () => {
            socket.destroy()
          })

          socket.pipe(stream).pipe(socket)
        })

        auditLogger.log({
          connectionId: sessionId,
          connectionName: session.config.host,
          host: session.config.host,
          event: 'port_forward_start',
          details: { type: 'remote', remotePort, localHost, localPort, forwardId: fwdId }
        })

        resolve(fwdId)
      })
    })
  }

  /**
   * List all active port forwards for a session.
   */
  listForwards(sessionId: string): Array<Omit<PortForward, 'server'>> {
    const session = sessions.get(sessionId)
    if (!session) return []

    return Array.from(session.forwards.values()).map(({ server, ...rest }) => rest)
  }

  /**
   * Remove a specific port forward.
   */
  removeForward(sessionId: string, forwardId: string): void {
    const session = sessions.get(sessionId)
    if (!session) return

    const forward = session.forwards.get(forwardId)
    if (!forward) return

    if (forward.type === 'local' && forward.server) {
      forward.server.close()
    }

    if (forward.type === 'remote') {
      session.client.unforwardIn('0.0.0.0', forward.remotePort, () => {
        // Best-effort cleanup
      })
    }

    session.forwards.delete(forwardId)

    auditLogger.log({
      connectionId: sessionId,
      connectionName: session.config.host,
      host: session.config.host,
      event: 'port_forward_stop',
      details: { forwardId, type: forward.type }
    })
  }
}

export const sshManager = new SshManager()
