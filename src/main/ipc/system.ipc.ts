import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { createSocket } from 'dgram'
import { sessionLogger } from '../services/session-logger'
import { getRecordingsDir } from '../services/session-recorder'
import { keepassBridge, type KeePassConfig } from '../services/keepass-bridge'
import { connectionHealthMonitor } from '../services/connection-health'
import { auditLogger } from '../services/audit-log'
import { trayManager, type TrayConnectionEntry } from '../services/tray-manager'

export function registerSystemIpc(): void {
  // Tray: the renderer owns favorites/recents (localStorage), so it pushes the
  // connection list here whenever it changes; the main process just forwards it
  // to the tray menu.
  ipcMain.on('tray:update', (_event, entries: TrayConnectionEntry[]) => {
    trayManager.updateConnections(entries)
  })

  // Wake On LAN
  ipcMain.handle('system:wol', (_event, macAddress: string, broadcastAddr?: string) => {
    return new Promise<void>((resolve, reject) => {
      // Parse MAC address
      const mac = macAddress.replace(/[:-]/g, '')
      if (mac.length !== 12) {
        reject(new Error('Invalid MAC address'))
        return
      }

      // Build magic packet: 6x FF + 16x MAC
      const macBytes = Buffer.from(mac, 'hex')
      const magicPacket = Buffer.alloc(102)
      magicPacket.fill(0xff, 0, 6)
      for (let i = 0; i < 16; i++) {
        macBytes.copy(magicPacket, 6 + i * 6)
      }

      const socket = createSocket('udp4')
      socket.on('error', (err) => {
        socket.close()
        reject(err)
      })

      socket.bind(() => {
        socket.setBroadcast(true)
        const addr = broadcastAddr ?? '255.255.255.255'
        socket.send(magicPacket, 0, magicPacket.length, 9, addr, (err) => {
          socket.close()
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })

  // Session logging
  ipcMain.handle(
    'system:startLogging',
    (_event, sessionId: string, pattern: string, context: { name?: string; host?: string; user?: string }) => {
      const filePath = sessionLogger.startLogging(sessionId, pattern, context)
      auditLogger.log({
        connectionId: sessionId,
        connectionName: context.name ?? sessionId,
        host: context.host ?? '',
        event: 'session_log_start',
        details: { sessionId, filePath }
      })
      return filePath
    }
  )

  ipcMain.on('system:logData', (_event, sessionId: string, data: string) => {
    sessionLogger.write(sessionId, data)
  })

  ipcMain.handle('system:stopLogging', (_event, sessionId: string) => {
    const filePath = sessionLogger.stopLogging(sessionId)
    if (filePath) {
      auditLogger.log({
        connectionId: sessionId,
        connectionName: sessionId,
        host: '',
        event: 'session_log_stop',
        details: { sessionId, filePath }
      })
    }
  })

  ipcMain.handle('system:getLogDir', () => {
    return sessionLogger.getLogDir()
  })

  ipcMain.handle('system:getRecordingsDir', () => {
    return getRecordingsDir()
  })

  ipcMain.handle('system:listSessionLogs', () => {
    return sessionLogger.listLogs()
  })

  ipcMain.handle('system:deleteSessionLog', (_event, filePath: string) => {
    return sessionLogger.deleteLog(filePath)
  })

  // Open a folder/file in the OS default handler; returns '' on success or an
  // error string (shell.openPath resolves to '' when it succeeds).
  ipcMain.handle('system:openPath', async (_event, targetPath: string) => {
    return shell.openPath(targetPath)
  })

  // Reveal a file in the OS file manager (highlights it inside its folder).
  ipcMain.handle('system:revealPath', (_event, targetPath: string) => {
    shell.showItemInFolder(targetPath)
  })

  // File dialogs for SFTP
  ipcMain.handle('system:showSaveDialog', async (_event, defaultName: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: defaultName,
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('system:showOpenDialog', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })

  // Connection health
  ipcMain.handle('health:ping', async (_event, connectionId: string, host: string) => {
    const result = await connectionHealthMonitor.ping(host)
    return { connectionId, host, reachable: result.reachable, latencyMs: result.latencyMs }
  })

  // KeePass
  ipcMain.handle('keepass:configure', (_event, config: KeePassConfig) => {
    keepassBridge.configure(config)
  })

  ipcMain.handle('keepass:isAvailable', () => {
    return keepassBridge.isAvailable()
  })

  ipcMain.handle('keepass:isConfigured', () => {
    return keepassBridge.isConfigured()
  })

  ipcMain.handle('keepass:resolve', (_event, field: string, entryPath: string) => {
    return keepassBridge.resolve(field, entryPath)
  })

  ipcMain.handle('keepass:listEntries', (_event, path: string) => {
    return keepassBridge.listEntries(path)
  })
}
