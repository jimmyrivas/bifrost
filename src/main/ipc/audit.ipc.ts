import { ipcMain } from 'electron'
import { auditLogger, type AuditEventType } from '../services/audit-log'

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
}
