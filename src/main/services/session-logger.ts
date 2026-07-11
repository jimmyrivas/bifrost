import { app } from 'electron'
import { join } from 'path'
import { createWriteStream, mkdirSync, type WriteStream } from 'fs'

export class SessionLogger {
  private streams = new Map<string, WriteStream>()
  private logDir: string | null = null

  private ensureLogDir(): string {
    if (!this.logDir) {
      this.logDir = join(app.getPath('userData'), 'session-logs')
      mkdirSync(this.logDir, { recursive: true })
    }
    return this.logDir
  }

  /**
   * Start logging a session. Pattern supports:
   * %Y=year, %M=month, %D=day, %H=hour, %m=minute, %s=second,
   * %N=connection name, %h=host, %U=user
   */
  startLogging(
    sessionId: string,
    pattern: string,
    context: { name?: string; host?: string; user?: string }
  ): string {
    const logDir = this.ensureLogDir()
    const now = new Date()
    let filename = pattern
      .replace(/%Y/g, now.getFullYear().toString())
      .replace(/%M/g, String(now.getMonth() + 1).padStart(2, '0'))
      .replace(/%D/g, String(now.getDate()).padStart(2, '0'))
      .replace(/%H/g, String(now.getHours()).padStart(2, '0'))
      .replace(/%m/g, String(now.getMinutes()).padStart(2, '0'))
      .replace(/%s/g, String(now.getSeconds()).padStart(2, '0'))
      .replace(/%N/g, context.name ?? 'unknown')
      .replace(/%h/g, context.host ?? 'unknown')
      .replace(/%U/g, context.user ?? 'unknown')

    // Sanitize filename
    filename = filename.replace(/[^a-zA-Z0-9._\-]/g, '_')
    if (!filename.endsWith('.log')) filename += '.log'

    const filePath = join(logDir, filename)
    const stream = createWriteStream(filePath, { flags: 'a' })
    // The stream opens lazily; without a handler a failed open (log dir
    // removed, disk full) becomes an uncaught exception in the main process.
    stream.on('error', (err) => {
      console.error(`Session log write failed (${filePath}):`, err.message)
      this.streams.delete(sessionId)
    })

    // Write header. Local terminals have no connection context — label them
    // as such instead of printing "undefined (undefined@undefined)".
    const label = context.name || context.host || context.user
      ? `${context.name ?? context.host ?? 'unknown'} (${context.user ?? '?'}@${context.host ?? '?'})`
      : 'local terminal'
    stream.write(`\n=== Session started: ${now.toISOString()} ===\n`)
    stream.write(`=== Connection: ${label} ===\n\n`)

    this.streams.set(sessionId, stream)
    return filePath
  }

  write(sessionId: string, data: string): void {
    const stream = this.streams.get(sessionId)
    if (stream) {
      stream.write(data)
    }
  }

  stopLogging(sessionId: string): void {
    const stream = this.streams.get(sessionId)
    if (stream) {
      stream.write(`\n=== Session ended: ${new Date().toISOString()} ===\n`)
      stream.end()
      this.streams.delete(sessionId)
    }
  }

  stopAll(): void {
    for (const [id] of this.streams) {
      this.stopLogging(id)
    }
  }

  getLogDir(): string {
    return this.ensureLogDir()
  }
}

export const sessionLogger = new SessionLogger()
