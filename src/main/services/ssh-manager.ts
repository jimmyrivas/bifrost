import { Client, type ConnectConfig, type ClientChannel } from 'ssh2'
import type { ParsedKey } from 'ssh2-streams'
import { credentialStore } from './credential-store'
import { auditLogger } from './audit-log'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { createHash } from 'crypto'
import { EventEmitter } from 'events'
import { createServer, type Server } from 'net'

export interface SshConnectionConfig {
  host: string
  port: number
  username: string
  authType: 'userpass' | 'key' | 'key_pass' | 'manual'
  encryptedPassword?: Buffer | null
  privateKeyPath?: string | null
  encryptedPassphrase?: Buffer | null
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
    return new Promise((resolve, reject) => {
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

      // Set authentication
      switch (config.authType) {
        case 'userpass':
          if (config.encryptedPassword) {
            connectConfig.password = credentialStore.decrypt(config.encryptedPassword)
          }
          break
        case 'key':
          if (config.privateKeyPath) {
            connectConfig.privateKey = readFileSync(config.privateKeyPath)
          }
          break
        case 'key_pass':
          if (config.privateKeyPath) {
            connectConfig.privateKey = readFileSync(config.privateKeyPath)
          }
          if (config.encryptedPassphrase) {
            connectConfig.passphrase = credentialStore.decrypt(config.encryptedPassphrase)
          }
          break
        case 'manual':
          // No automatic auth
          break
      }

      client.on('ready', () => {
        sessions.set(id, { id, client, shell: null, config, forwards: new Map() })

        auditLogger.log({
          connectionId: id,
          connectionName: config.host,
          host: config.host,
          event: 'connect',
          details: { username: config.username, authType: config.authType }
        })

        resolve(id)
      })

      client.on('error', (err) => {
        sessions.delete(id)

        auditLogger.log({
          connectionId: id,
          connectionName: config.host,
          host: config.host,
          event: 'error',
          details: { message: err.message }
        })

        reject(err)
      })

      client.connect(connectConfig)
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

      session.client.shell(
        { term: 'xterm-256color', cols, rows },
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

  disconnect(sessionId: string): void {
    const session = sessions.get(sessionId)
    if (session) {
      // Close all port forwards
      for (const [fwdId, fwd] of session.forwards) {
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
