import { ipcMain, BrowserWindow } from 'electron'
import { externalProtocolManager, type RdpOptions } from '../services/external-protocol'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'
import { resolveJumpChainForJson } from '../services/jump-host/runtime'
import { sessionLogger } from '../services/session-logger'

export function registerProtocolsIpc(mainWindow: BrowserWindow): void {
  // RDP
  ipcMain.handle(
    'protocols:connectRDP',
    (
      _event,
      host: string,
      port: number,
      username: string,
      password?: string,
      options?: RdpOptions
    ): string => {
      return externalProtocolManager.connectRDP(host, port, username, password, options)
    }
  )

  // VNC (#44: multi-viewer support)
  ipcMain.handle(
    'protocols:connectVNC',
    (_event, host: string, port: number, password?: string, preferredViewer?: string): string => {
      return externalProtocolManager.connectVNC(host, port, password, preferredViewer)
    }
  )

  // Telnet
  ipcMain.handle(
    'protocols:connectTelnet',
    (_event, host: string, port: number): string => {
      return externalProtocolManager.connectTelnet(host, port)
    }
  )

  // Telnet write
  ipcMain.on('protocols:writeTelnet', (_event, sessionId: string, data: string) => {
    externalProtocolManager.writeTelnet(sessionId, data)
  })

  // === #41: Mosh ===
  ipcMain.handle(
    'protocols:connectMosh',
    async (
      _event,
      host: string,
      user?: string,
      port?: number,
      extraArgs?: string[],
      connectionId?: string
    ): Promise<string> => {
      let jumpChain: Awaited<ReturnType<typeof resolveJumpChainForJson>> = []
      if (connectionId) {
        const db = getDatabase()
        const conn = db
          .select()
          .from(schema.connections)
          .where(eq(schema.connections.id, connectionId))
          .get()
        if (conn?.jumpServerConfig) {
          jumpChain = await resolveJumpChainForJson(conn.jumpServerConfig)
        }
      }
      return externalProtocolManager.connectMosh(host, user, port, extraArgs, jumpChain)
    }
  )

  // === #89: AWS SSM ===
  ipcMain.handle(
    'protocols:connectSSM',
    (_event, instanceId: string, region: string): string => {
      return externalProtocolManager.connectSSM(instanceId, region)
    }
  )

  // PTY write (for mosh, ssm)
  ipcMain.on('protocols:writePty', (_event, sessionId: string, data: string) => {
    externalProtocolManager.writePty(sessionId, data)
  })

  // PTY resize (for mosh, ssm)
  ipcMain.on('protocols:resizePty', (_event, sessionId: string, cols: number, rows: number) => {
    externalProtocolManager.resizePty(sessionId, cols, rows)
  })

  // === #42: FTP ===
  ipcMain.handle(
    'protocols:connectFTP',
    (_event, host: string, port: number, user?: string, password?: string): string => {
      return externalProtocolManager.connectFTP(host, port, user, password)
    }
  )

  // === #43: TN3270 ===
  ipcMain.handle(
    'protocols:connect3270',
    (_event, host: string, port: number): string => {
      return externalProtocolManager.connect3270(host, port)
    }
  )

  // === #45: WebDAV ===
  ipcMain.handle(
    'protocols:connectWebDAV',
    (_event, host: string, port: number, user?: string, password?: string): string => {
      return externalProtocolManager.connectWebDAV(host, port, user, password)
    }
  )

  // Disconnect
  ipcMain.handle('protocols:disconnect', (_event, sessionId: string) => {
    externalProtocolManager.disconnect(sessionId)
  })

  // Status
  ipcMain.handle('protocols:isConnected', (_event, sessionId: string) => {
    return externalProtocolManager.isConnected(sessionId)
  })

  // Forward events to renderer
  externalProtocolManager.on('data', (...args: unknown[]) => {
    const [sessionId, data] = args as [string, string]
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('protocols:data', sessionId, data)
    }
    // Feed an active session log (no-op when logging isn't started for this
    // session) — covers mosh and the other PTY-backed protocols.
    sessionLogger.write(sessionId, data)
  })

  externalProtocolManager.on('close', (...args: unknown[]) => {
    const [sessionId, code] = args as [string, number]
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('protocols:close', sessionId, code)
    }
    // Close out an active session log (no-op when none is active).
    sessionLogger.stopLogging(sessionId)
  })

  externalProtocolManager.on('error', (...args: unknown[]) => {
    const [sessionId, message] = args as [string, string]
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('protocols:error', sessionId, message)
    }
  })
}
