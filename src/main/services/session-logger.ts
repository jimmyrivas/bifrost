import { app } from 'electron'
import { join } from 'path'
import { createWriteStream, mkdirSync, type WriteStream } from 'fs'

export class SessionLogger {
  private streams = new Map<string, WriteStream>()
  private logDir: string

  constructor() {
    this.logDir = join(app.getPath('userData'), 'session-logs')
    mkdirSync(this.logDir, { recursive: true })
  }

  /**
   * Start logging a session. Pattern supports:
   * %Y=year, %M=month, %D=day, %H=hour, %m=minute, %s=second,
   * %N=connection name, %H=host, %U=user
   */
  startLogging(
    sessionId: string,
    pattern: string,
    context: { name?: string; host?: string; user?: string }
  ): string {
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

    const filePath = join(this.logDir, filename)
    const stream = createWriteStream(filePath, { flags: 'a' })

    // Write header
    stream.write(`\n=== Session started: ${now.toISOString()} ===\n`)
    stream.write(`=== Connection: ${context.name} (${context.user}@${context.host}) ===\n\n`)

    this.streams.set(sessionId, stream)
    return filePath
  }

  /**
   * Append data to a session log.
   */
  write(sessionId: string, data: string): void {
    const stream = this.streams.get(sessionId)
    if (stream) {
      stream.write(data)
    }
  }

  /**
   * Stop logging a session.
   */
  stopLogging(sessionId: string): void {
    const stream = this.streams.get(sessionId)
    if (stream) {
      stream.write(`\n=== Session ended: ${new Date().toISOString()} ===\n`)
      stream.end()
      this.streams.delete(sessionId)
    }
  }

  /**
   * Stop all loggers.
   */
  stopAll(): void {
    for (const [id] of this.streams) {
      this.stopLogging(id)
    }
  }

  getLogDir(): string {
    return this.logDir
  }
}

export const sessionLogger = new SessionLogger()
