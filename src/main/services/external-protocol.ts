import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { createConnection, type Socket } from 'net'

export interface RdpOptions {
  width?: number
  height?: number
  fullscreen?: boolean
  domain?: string
  /** Additional xfreerdp flags */
  extraArgs?: string[]
}

export interface ExternalProtocolSession {
  id: string
  protocol: 'rdp' | 'vnc' | 'telnet'
  host: string
  port: number
  process: ChildProcess | null
  socket: Socket | null
}

type ProtocolEvent = 'data' | 'close' | 'error'

const sessions = new Map<string, ExternalProtocolSession>()
let idCounter = 0

class ExternalProtocolManager extends EventEmitter {
  connectRDP(
    host: string,
    port: number,
    username: string,
    password?: string,
    options?: RdpOptions
  ): string {
    const id = `rdp-${++idCounter}`

    const args: string[] = [
      `/v:${host}:${port}`,
      `/u:${username}`,
      '+clipboard',
      '/cert:ignore'
    ]

    if (password) {
      args.push(`/p:${password}`)
    }

    if (options?.domain) {
      args.push(`/d:${options.domain}`)
    }

    if (options?.fullscreen) {
      args.push('/f')
    } else {
      const width = options?.width ?? 1280
      const height = options?.height ?? 800
      args.push(`/w:${width}`)
      args.push(`/h:${height}`)
    }

    if (options?.extraArgs) {
      args.push(...options.extraArgs)
    }

    const child = spawn('xfreerdp', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    })

    const session: ExternalProtocolSession = {
      id,
      protocol: 'rdp',
      host,
      port,
      process: child,
      socket: null
    }

    sessions.set(id, session)

    child.stdout?.on('data', (data: Buffer) => {
      this.emit('data', id, data.toString())
    })

    child.stderr?.on('data', (data: Buffer) => {
      this.emit('data', id, data.toString())
    })

    child.on('close', (code) => {
      sessions.delete(id)
      this.emit('close', id, code ?? 0)
    })

    child.on('error', (err) => {
      sessions.delete(id)
      this.emit('error', id, err.message)
    })

    return id
  }

  connectVNC(host: string, port: number, password?: string): string {
    const id = `vnc-${++idCounter}`

    const args: string[] = [`${host}:${port}`]

    if (password) {
      args.push(`-passwd`, `/dev/stdin`)
    }

    const child = spawn('vncviewer', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    })

    // If password provided, write it to stdin
    if (password && child.stdin) {
      child.stdin.write(password)
      child.stdin.end()
    }

    const session: ExternalProtocolSession = {
      id,
      protocol: 'vnc',
      host,
      port,
      process: child,
      socket: null
    }

    sessions.set(id, session)

    child.stdout?.on('data', (data: Buffer) => {
      this.emit('data', id, data.toString())
    })

    child.stderr?.on('data', (data: Buffer) => {
      this.emit('data', id, data.toString())
    })

    child.on('close', (code) => {
      sessions.delete(id)
      this.emit('close', id, code ?? 0)
    })

    child.on('error', (err) => {
      sessions.delete(id)
      this.emit('error', id, err.message)
    })

    return id
  }

  connectTelnet(host: string, port: number): string {
    const id = `telnet-${++idCounter}`

    const socket = createConnection({ host, port }, () => {
      this.emit('data', id, `Connected to ${host}:${port}\r\n`)
    })

    const session: ExternalProtocolSession = {
      id,
      protocol: 'telnet',
      host,
      port,
      process: null,
      socket
    }

    sessions.set(id, session)

    socket.on('data', (data: Buffer) => {
      this.emit('data', id, data.toString())
    })

    socket.on('close', () => {
      sessions.delete(id)
      this.emit('close', id, 0)
    })

    socket.on('error', (err) => {
      sessions.delete(id)
      this.emit('error', id, err.message)
    })

    return id
  }

  writeTelnet(sessionId: string, data: string): void {
    const session = sessions.get(sessionId)
    if (session?.socket) {
      session.socket.write(data)
    }
  }

  disconnect(sessionId: string): void {
    const session = sessions.get(sessionId)
    if (!session) return

    if (session.process) {
      session.process.kill('SIGTERM')
    }

    if (session.socket) {
      session.socket.destroy()
    }

    sessions.delete(sessionId)
  }

  disconnectAll(): void {
    for (const [id] of sessions) {
      this.disconnect(id)
    }
  }

  isConnected(sessionId: string): boolean {
    return sessions.has(sessionId)
  }

  getSession(sessionId: string): ExternalProtocolSession | undefined {
    return sessions.get(sessionId)
  }

  on(event: ProtocolEvent, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener)
  }

  emit(event: ProtocolEvent, ...args: unknown[]): boolean {
    return super.emit(event, ...args)
  }
}

export const externalProtocolManager = new ExternalProtocolManager()
