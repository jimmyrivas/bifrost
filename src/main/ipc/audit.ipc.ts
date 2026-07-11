import { ipcMain } from 'electron'
import { writeFileSync } from 'fs'
import { auditLogger, auditEventsToCsv, type AuditEventType } from '../services/audit-log'

export function registerAuditIpc(): void {
  ipcMain.handle(
    'audit:query',
    async (
      _event,
      options?: {
        connectionId?: string
        event?: AuditEventType
        since?: string
        limit?: number
      }
    ) => {
      try {
        return auditLogger.query(options)
      } catch (err) {
        throw new Error(
          `Audit query failed: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  )

  ipcMain.handle('audit:getLogSize', async () => {
    return auditLogger.getLogSize()
  })

  ipcMain.handle('audit:rotate', async () => {
    auditLogger.rotate()
  })

  // Export the events matching the given filters to a user-chosen file.
  // eventTypes/search mirror the Activity view's client-side filters so the
  // exported set is exactly what the timeline shows. Returns the number of
  // events written.
  ipcMain.handle(
    'audit:export',
    async (
      _event,
      options: {
        connectionId?: string
        since?: string
        limit?: number
        eventTypes?: AuditEventType[]
        search?: string
      } | undefined,
      filePath: string,
      format: 'jsonl' | 'csv'
    ) => {
      let events = auditLogger.query({
        connectionId: options?.connectionId,
        since: options?.since,
        limit: options?.limit
      })
      if (options?.eventTypes && options.eventTypes.length > 0) {
        const allowed = new Set(options.eventTypes)
        events = events.filter((e) => allowed.has(e.event))
      }
      if (options?.search) {
        const q = options.search.toLowerCase()
        events = events.filter(
          (e) =>
            e.connectionName.toLowerCase().includes(q) || e.host.toLowerCase().includes(q)
        )
      }
      const content =
        format === 'csv'
          ? auditEventsToCsv(events)
          : events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : '')
      writeFileSync(filePath, content, 'utf-8')
      return events.length
    }
  )
}
