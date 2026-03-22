import { ipcMain } from 'electron'
import { createSocket } from 'dgram'
import { sessionLogger } from '../services/session-logger'
import { keepassBridge, type KeePassConfig } from '../services/keepass-bridge'

export function registerSystemIpc(): void {
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
      return sessionLogger.startLogging(sessionId, pattern, context)
    }
  )

  ipcMain.on('system:logData', (_event, sessionId: string, data: string) => {
    sessionLogger.write(sessionId, data)
  })

  ipcMain.handle('system:stopLogging', (_event, sessionId: string) => {
    sessionLogger.stopLogging(sessionId)
  })

  ipcMain.handle('system:getLogDir', () => {
    return sessionLogger.getLogDir()
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
