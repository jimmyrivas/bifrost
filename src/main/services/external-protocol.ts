import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { createConnection, type Socket } from 'net'
import { isWindows, isMac } from './platform'

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
  protocol: 'rdp' | 'vnc' | 'telnet' | 'mosh' | 'ssm' | 'ftp' | 'tn3270' | 'webdav'
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

    // Audio playback (platform-specific backend)
    if (options?.audioPlayback) {
      const soundBackend = isWindows() ? 'sys:winmm' : isMac() ? 'sys:mac' : 'sys:alsa'
      args.push(`/sound:${soundBackend}`)
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

    // Windows: use native mstsc.exe; Linux/macOS: use xfreerdp
    let child: ChildProcess
    if (isWindows()) {
      const mstscArgs = [`/v:${host}:${port}`]
      if (username) mstscArgs.push(`/u:${username}`)
      if (options?.fullscreen) mstscArgs.push('/f')
      if (options?.resolution) {
        const [w, h] = options.resolution.split('x').map(Number)
        mstscArgs.push(`/w:${w || 1280}`, `/h:${h || 800}`)
      }
      child = spawn('mstsc.exe', mstscArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      })
    } else {
      child = spawn('xfreerdp', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      })
    }

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

  connectVNC(host: string, port: number, password?: string, preferredViewer?: string): string {
    const id = `vnc-${++idCounter}`

    const args: string[] = [`${host}:${port}`]

    if (password) {
      args.push(`-passwd`, `/dev/stdin`)
    }

    // #44: Try preferred viewer, then fall back through options
    const defaultViewers = isWindows()
      ? ['vncviewer', 'tvnviewer', 'ultravnc', 'realvnc']
      : ['vncviewer', 'tigervnc', 'xtigervncviewer', 'realvnc']
    const viewers = preferredViewer
      ? [preferredViewer, ...defaultViewers]
      : defaultViewers
    // Deduplicate
    const uniqueViewers = [...new Set(viewers)]

    let child: ChildProcess | null = null
    let lastError: Error | null = null

    for (const viewer of uniqueViewers) {
      try {
        child = spawn(viewer, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false
        })
        // Test if spawn succeeded by checking pid
        if (child.pid) break
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        child = null
      }
    }

    if (!child) {
      const errMsg = lastError?.message ?? 'No VNC viewer found'
      this.emit('error', id, errMsg)
      return id
    }

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
   *
   * Accepts an optional resolved jump chain (decrypted credentials).
   * When set, mosh's `--ssh=` flag is built from the chain via OpenSSH `-J`.
   */
  connectMosh(
    host: string,
    user?: string,
    port?: number,
    extraArgs?: string[],
    jumpChain?: import('./jump-host/types').ResolvedHop[]
  ): string {
    if (isWindows()) {
      throw new Error('Mosh is not available on Windows. Use SSH instead, or install Mosh via WSL.')
    }
    const id = `mosh-${++idCounter}`
    const target = user ? `${user}@${host}` : host

    const args: string[] = []

    let sshFlag: string | null = null
    if (jumpChain && jumpChain.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { buildMoshSshFlag } = require('./jump-host/mosh') as typeof import('./jump-host/mosh')
      const r = buildMoshSshFlag(jumpChain)
      if (!r.flag) {
        throw new Error(`Mosh + jump host: ${r.reason ?? 'unsupported configuration'}`)
      }
      sshFlag = r.flag
      if (port && port !== 22) sshFlag += ` -p ${port}`
    } else if (port) {
      sshFlag = `ssh -p ${port}`
    }
    if (sshFlag) args.push(`--ssh=${sshFlag}`)

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

  /**
   * #42: Connect via FTP client.
   * Spawns `lftp` or falls back to `ftp` via node-pty.
   */
  connectFTP(host: string, port: number, user?: string, password?: string): string {
    const id = `ftp-${++idCounter}`

    // Try lftp first, then fall back to ftp
    const lftpArgs = user && password
      ? ['-u', `${user},${password}`, `${host}:${port}`]
      : [`${host}:${port}`]

    const ftpArgs = [host, String(port)]

    try {
      const pty = require('node-pty') as typeof import('node-pty')
      let proc: ReturnType<typeof pty.spawn>

      try {
        proc = pty.spawn('lftp', lftpArgs, {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          env: process.env as Record<string, string>
        })
      } catch {
        // Fall back to ftp
        proc = pty.spawn('ftp', ftpArgs, {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          env: process.env as Record<string, string>
        })
      }

      const session: ExternalProtocolSession = {
        id,
        protocol: 'ftp',
        host,
        port,
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
      let child: ChildProcess
      try {
        child = spawn('lftp', lftpArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        child = spawn('ftp', ftpArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const session: ExternalProtocolSession = {
        id,
        protocol: 'ftp',
        host,
        port,
        process: child,
        socket: null
      }
      sessions.set(id, session)

      child.stdout?.on('data', (data: Buffer) => this.emit('data', id, data.toString()))
      child.stderr?.on('data', (data: Buffer) => this.emit('data', id, data.toString()))
      child.on('close', (code) => { sessions.delete(id); this.emit('close', id, code ?? 0) })
      child.on('error', (err) => { sessions.delete(id); this.emit('error', id, err.message) })
    }

    return id
  }

  /**
   * #43: Connect via TN3270 terminal emulator.
   * Tries c3270, x3270, then tn3270.
   */
  connect3270(host: string, port: number): string {
    const id = `tn3270-${++idCounter}`
    const target = `${host}:${port}`

    const emulators: Array<{ cmd: string; args: string[] }> = [
      { cmd: 'c3270', args: [target] },
      { cmd: 'x3270', args: [target] },
      { cmd: 'tn3270', args: [host, String(port)] }
    ]

    try {
      const pty = require('node-pty') as typeof import('node-pty')
      let proc: ReturnType<typeof pty.spawn> | null = null

      for (const { cmd, args } of emulators) {
        try {
          proc = pty.spawn(cmd, args, {
            name: 'xterm-256color',
            cols: 80,
            rows: 24,
            env: process.env as Record<string, string>
          })
          if (proc) break
        } catch {
          proc = null
        }
      }

      if (!proc) {
        this.emit('error', id, 'No TN3270 emulator found (tried c3270, x3270, tn3270)')
        return id
      }

      const session: ExternalProtocolSession = {
        id,
        protocol: 'tn3270',
        host,
        port,
        process: null,
        socket: null,
        ptyProcess: proc
      }
      sessions.set(id, session)

      proc.onData((data: string) => this.emit('data', id, data))
      proc.onExit(({ exitCode }: { exitCode: number }) => {
        sessions.delete(id)
        this.emit('close', id, exitCode)
      })
    } catch {
      // Fallback without PTY
      let child: ChildProcess | null = null
      for (const { cmd, args } of emulators) {
        try {
          child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
          if (child.pid) break
        } catch {
          child = null
        }
      }

      if (!child) {
        this.emit('error', id, 'No TN3270 emulator found')
        return id
      }

      const session: ExternalProtocolSession = {
        id,
        protocol: 'tn3270',
        host,
        port,
        process: child,
        socket: null
      }
      sessions.set(id, session)

      child.stdout?.on('data', (data: Buffer) => this.emit('data', id, data.toString()))
      child.stderr?.on('data', (data: Buffer) => this.emit('data', id, data.toString()))
      child.on('close', (code) => { sessions.delete(id); this.emit('close', id, code ?? 0) })
      child.on('error', (err) => { sessions.delete(id); this.emit('error', id, err.message) })
    }

    return id
  }

  /**
   * #45: Connect via WebDAV using cadaver.
   */
  connectWebDAV(host: string, port: number, user?: string, password?: string): string {
    const id = `webdav-${++idCounter}`
    const url = `https://${host}:${port}/`

    try {
      const pty = require('node-pty') as typeof import('node-pty')
      const env: Record<string, string> = { ...process.env as Record<string, string> }

      // cadaver uses ~/.netrc for auth, but we can also pipe credentials
      const proc = pty.spawn('cadaver', [url], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        env
      })

      const session: ExternalProtocolSession = {
        id,
        protocol: 'webdav',
        host,
        port,
        process: null,
        socket: null,
        ptyProcess: proc
      }
      sessions.set(id, session)

      // Send credentials if provided (cadaver will prompt)
      if (user) {
        setTimeout(() => proc.write(user + '\n'), 500)
        if (password) {
          setTimeout(() => proc.write(password + '\n'), 1000)
        }
      }

      proc.onData((data: string) => this.emit('data', id, data))
      proc.onExit(({ exitCode }: { exitCode: number }) => {
        sessions.delete(id)
        this.emit('close', id, exitCode)
      })
    } catch {
      // Fallback without PTY
      const child = spawn('cadaver', [url], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      const session: ExternalProtocolSession = {
        id,
        protocol: 'webdav',
        host,
        port,
        process: child,
        socket: null
      }
      sessions.set(id, session)

      if (user && child.stdin) {
        setTimeout(() => { child.stdin?.write(user + '\n') }, 500)
        if (password) {
          setTimeout(() => { child.stdin?.write(password + '\n') }, 1000)
        }
      }

      child.stdout?.on('data', (data: Buffer) => this.emit('data', id, data.toString()))
      child.stderr?.on('data', (data: Buffer) => this.emit('data', id, data.toString()))
      child.on('close', (code) => { sessions.delete(id); this.emit('close', id, code ?? 0) })
      child.on('error', (err) => { sessions.delete(id); this.emit('error', id, err.message) })
    }

    return id
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
      const { killProcess } = require('./platform') as typeof import('./platform')
      killProcess(session.process)
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
