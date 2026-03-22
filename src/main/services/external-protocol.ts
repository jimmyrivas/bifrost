import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { createConnection, type Socket } from 'net'

export interface RdpOptions {
  width?: number
  height?: number
  fullscreen?: boolean
  domain?: string
  clipboard?: boolean
  driveRedirect?: boolean
  printerRedirect?: boolean
  audioPlayback?: boolean
  colorDepth?: 15 | 16 | 24 | 32
  resolution?: string
  /** Additional xfreerdp flags */
  extraArgs?: string[]
}

export interface ExternalProtocolSession {
  id: string
  protocol: 'rdp' | 'vnc' | 'telnet' | 'mosh' | 'ssm'
  host: string
  port: number
  process: ChildProcess | null
  socket: Socket | null
  ptyProcess?: unknown
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
      '/cert:ignore'
    ]

    // Clipboard forwarding (default: on)
    if (options?.clipboard !== false) {
      args.push('+clipboard')
    } else {
      args.push('-clipboard')
    }

    if (password) {
      args.push(`/p:${password}`)
    }

    if (options?.domain) {
      args.push(`/d:${options.domain}`)
    }

    // Drive redirection
    if (options?.driveRedirect) {
      args.push('+drives')
    }

    // Printer redirection
    if (options?.printerRedirect) {
      args.push('+printer:')
    }

    // Audio playback
    if (options?.audioPlayback) {
      args.push('/sound:sys:alsa')
    }

    // Color depth
    if (options?.colorDepth) {
      args.push(`/bpp:${options.colorDepth}`)
    }

    if (options?.fullscreen) {
      args.push('/f')
    } else if (options?.resolution) {
      const [w, h] = options.resolution.split('x').map(Number)
      args.push(`/w:${w || 1280}`)
      args.push(`/h:${h || 800}`)
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

  /**
   * #41: Connect via Mosh (mobile shell).
   * Spawns `mosh {user}@{host}` via node-pty for proper terminal emulation.
   */
  connectMosh(
    host: string,
    user?: string,
    port?: number,
    extraArgs?: string[]
  ): string {
    const id = `mosh-${++idCounter}`
    const target = user ? `${user}@${host}` : host

    const args: string[] = []
    if (port) {
      args.push('--ssh=ssh -p ' + port)
    }
    if (extraArgs) {
      args.push(...extraArgs)
    }
    args.push(target)

    let ptyProcess: unknown
    try {
      // Use node-pty for proper PTY support
      const pty = require('node-pty') as typeof import('node-pty')
      const proc = pty.spawn('mosh', args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        env: process.env as Record<string, string>
      })

      ptyProcess = proc

      const session: ExternalProtocolSession = {
        id,
        protocol: 'mosh',
        host,
        port: port ?? 22,
        process: null,
        socket: null,
        ptyProcess: proc
      }
      sessions.set(id, session)

      proc.onData((data: string) => {
        this.emit('data', id, data)
      })

      proc.onExit(({ exitCode }: { exitCode: number }) => {
        sessions.delete(id)
        this.emit('close', id, exitCode)
      })
    } catch {
      // Fallback: spawn without PTY
      const child = spawn('mosh', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      })

      const session: ExternalProtocolSession = {
        id,
        protocol: 'mosh',
        host,
        port: port ?? 22,
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
    }

    return id
  }

  /**
   * #89: Connect to AWS SSM session.
   * Spawns `aws ssm start-session --target {instanceId} --region {region}` via node-pty.
   */
  connectSSM(instanceId: string, region: string): string {
    const id = `ssm-${++idCounter}`

    const args = [
      'ssm', 'start-session',
      '--target', instanceId,
      '--region', region
    ]

    try {
      const pty = require('node-pty') as typeof import('node-pty')
      const proc = pty.spawn('aws', args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        env: process.env as Record<string, string>
      })

      const session: ExternalProtocolSession = {
        id,
        protocol: 'ssm',
        host: instanceId,
        port: 0,
        process: null,
        socket: null,
        ptyProcess: proc
      }
      sessions.set(id, session)

      proc.onData((data: string) => {
        this.emit('data', id, data)
      })

      proc.onExit(({ exitCode }: { exitCode: number }) => {
        sessions.delete(id)
        this.emit('close', id, exitCode)
      })
    } catch {
      // Fallback without PTY
      const child = spawn('aws', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      })

      const session: ExternalProtocolSession = {
        id,
        protocol: 'ssm',
        host: instanceId,
        port: 0,
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
    }

    return id
  }

  /**
   * Write data to a PTY-based session (mosh, ssm).
   */
  writePty(sessionId: string, data: string): void {
    const session = sessions.get(sessionId)
    if (session?.ptyProcess) {
      (session.ptyProcess as { write: (data: string) => void }).write(data)
    }
  }

  /**
   * Resize a PTY-based session.
   */
  resizePty(sessionId: string, cols: number, rows: number): void {
    const session = sessions.get(sessionId)
    if (session?.ptyProcess) {
      (session.ptyProcess as { resize: (cols: number, rows: number) => void }).resize(cols, rows)
    }
  }

  disconnect(sessionId: string): void {
    const session = sessions.get(sessionId)
    if (!session) return

    if (session.ptyProcess) {
      try {
        (session.ptyProcess as { kill: () => void }).kill()
      } catch {
        // Ignore kill errors
      }
    }

    if (session.process) {
      session.process.kill('SIGTERM')
    }

    if (session.socket) {
      session.socket.destroy()
    }

    sessions.delete(sessionId)
  }

  on(event: ProtocolEvent, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener)
  }

  emit(event: ProtocolEvent, ...args: unknown[]): boolean {
    return super.emit(event, ...args)
  }
}

export const externalProtocolManager = new ExternalProtocolManager()
