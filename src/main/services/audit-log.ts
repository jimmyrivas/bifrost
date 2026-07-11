import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs'

export type AuditEventType =
  | 'connect'
  | 'disconnect'
  | 'auth_success'
  | 'auth_fail'
  | 'command'
  | 'error'
  | 'port_forward_start'
  | 'port_forward_stop'
  | 'host_key_verified'
  | 'host_key_rejected'
  | 'host_key_changed'
  | 'recording_start'
  | 'recording_stop'
  | 'session_log_start'
  | 'session_log_stop'
  | 'vault_password_changed'
  | 'key_file_stored'
  | 'mfa_prompt'

export interface AuditEvent {
  timestamp: string
  connectionId: string
  connectionName: string
  host: string
  event: AuditEventType
  details: Record<string, unknown>
}

const RETENTION_DAYS = 30
const MAX_FILE_SIZE_MB = 50

/** Quote one CSV field per RFC 4180. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Serialize audit events to CSV (RFC 4180). The details payload is kept as a
 * single JSON-string column so no information is lost.
 */
export function auditEventsToCsv(events: AuditEvent[]): string {
  const header = 'timestamp,event,connectionId,connectionName,host,details'
  const rows = events.map((e) =>
    [
      csvField(e.timestamp),
      csvField(e.event),
      csvField(e.connectionId),
      csvField(e.connectionName),
      csvField(e.host),
      csvField(JSON.stringify(e.details ?? {}))
    ].join(',')
  )
  return [header, ...rows].join('\r\n') + '\r\n'
}

class AuditLogger {
  private logPath: string | null = null

  private getLogPath(): string {
    if (!this.logPath) {
      this.logPath = join(app.getPath('userData'), 'audit.jsonl')
    }
    return this.logPath
  }

  /**
   * Append a structured audit event to the JSONL log file.
   */
  log(event: Omit<AuditEvent, 'timestamp'>): void {
    try {
      const entry: AuditEvent = {
        timestamp: new Date().toISOString(),
        ...event
      }

      const line = JSON.stringify(entry) + '\n'
      appendFileSync(this.getLogPath(), line, 'utf-8')
    } catch (err) {
      console.error('Audit log write failed:', err)
    }
  }

  /**
   * Remove log entries older than RETENTION_DAYS.
   * Should be called periodically (e.g., on app startup).
   */
  rotate(): void {
    const logPath = this.getLogPath()

    if (!existsSync(logPath)) return

    try {
      const content = readFileSync(logPath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
      const cutoffIso = cutoff.toISOString()

      const retained: string[] = []
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as AuditEvent
          if (entry.timestamp >= cutoffIso) {
            retained.push(line)
          }
        } catch {
          // Skip malformed lines
        }
      }

      writeFileSync(logPath, retained.join('\n') + (retained.length > 0 ? '\n' : ''), 'utf-8')
    } catch (err) {
      console.error('Audit log rotation failed:', err)
    }
  }

  /**
   * Read recent audit events, optionally filtered.
   */
  query(options?: {
    connectionId?: string
    event?: AuditEventType
    since?: string
    limit?: number
  }): AuditEvent[] {
    const logPath = this.getLogPath()
    if (!existsSync(logPath)) return []

    try {
      const content = readFileSync(logPath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)
      const events: AuditEvent[] = []

      // Read from end for efficiency with limit
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]) as AuditEvent

          if (options?.since && entry.timestamp < options.since) break
          if (options?.connectionId && entry.connectionId !== options.connectionId) continue
          if (options?.event && entry.event !== options.event) continue

          events.push(entry)

          if (options?.limit && events.length >= options.limit) break
        } catch {
          // Skip malformed lines
        }
      }

      return events.reverse()
    } catch {
      return []
    }
  }

  /**
   * Get the file size of the audit log in bytes.
   */
  getLogSize(): number {
    const logPath = this.getLogPath()
    if (!existsSync(logPath)) return 0

    try {
      return statSync(logPath).size
    } catch {
      return 0
    }
  }

  /**
   * Check if log rotation is needed based on file size.
   */
  shouldRotate(): boolean {
    const sizeBytes = this.getLogSize()
    return sizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024
  }
}

export const auditLogger = new AuditLogger()
