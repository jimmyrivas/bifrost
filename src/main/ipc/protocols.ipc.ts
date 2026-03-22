import { ipcMain, BrowserWindow } from 'electron'
import { externalProtocolManager, type RdpOptions } from '../services/external-protocol'

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

  // VNC
  ipcMain.handle(
    'protocols:connectVNC',
    (_event, host: string, port: number, password?: string): string => {
      return externalProtocolManager.connectVNC(host, port, password)
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
  })

  externalProtocolManager.on('close', (...args: unknown[]) => {
    const [sessionId, code] = args as [string, number]
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('protocols:close', sessionId, code)
    }
  })

  externalProtocolManager.on('error', (...args: unknown[]) => {
    const [sessionId, message] = args as [string, string]
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('protocols:error', sessionId, message)
    }
  })
}
