import { Client, type ConnectConfig, type ClientChannel } from 'ssh2'
import { credentialStore } from './credential-store'
import { readFileSync } from 'fs'

export interface SshConnectionConfig {
  host: string
  port: number
  username: string
  authType: 'userpass' | 'key' | 'key_pass' | 'manual'
  encryptedPassword?: Buffer | null
  privateKeyPath?: string | null
  encryptedPassphrase?: Buffer | null
}

export interface SshSession {
  id: string
  client: Client
  shell: ClientChannel | null
  config: SshConnectionConfig
}

const sessions = new Map<string, SshSession>()
let sshIdCounter = 0

export class SshManager {
  connect(config: SshConnectionConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      const id = `ssh-${++sshIdCounter}`
      const client = new Client()

      const connectConfig: ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 30000
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
        sessions.set(id, { id, client, shell: null, config })
        resolve(id)
      })

      client.on('error', (err) => {
        sessions.delete(id)
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
      session.shell?.close()
      session.client.end()
      sessions.delete(sessionId)
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
}

export const sshManager = new SshManager()
