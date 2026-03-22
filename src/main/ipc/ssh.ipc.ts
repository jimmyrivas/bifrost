import { ipcMain, BrowserWindow } from 'electron'
import { sshManager, type SshConnectionConfig } from '../services/ssh-manager'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'

export function registerSshIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle(
    'ssh:connect',
    async (_event, connectionId: string): Promise<string> => {
      const db = getDatabase()
      const conn = db
        .select()
        .from(schema.connections)
        .where(eq(schema.connections.id, connectionId))
        .get()

      if (!conn) throw new Error(`Connection ${connectionId} not found`)
      if (!conn.host) throw new Error('Host is required for SSH connection')

      const config: SshConnectionConfig = {
        host: conn.host,
        port: conn.port ?? 22,
        username: conn.username ?? '',
        authType: (conn.authType as SshConnectionConfig['authType']) ?? 'manual',
        encryptedPassword: conn.encryptedPassword,
        privateKeyPath: conn.privateKeyPath,
        encryptedPassphrase: conn.encryptedPassphrase
      }

      return sshManager.connect(config)
    }
  )

  ipcMain.handle(
    'ssh:openShell',
    async (_event, sessionId: string, cols: number, rows: number): Promise<void> => {
      const stream = await sshManager.openShell(sessionId, cols, rows)

      stream.on('data', (data: Buffer) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ssh:data', sessionId, data.toString())
        }
      })

      stream.on('close', () => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ssh:close', sessionId)
        }
        sshManager.disconnect(sessionId)
      })
    }
  )

  ipcMain.on('ssh:write', (_event, sessionId: string, data: string) => {
    sshManager.write(sessionId, data)
  })

  ipcMain.on('ssh:resize', (_event, sessionId: string, cols: number, rows: number) => {
    sshManager.resize(sessionId, cols, rows)
  })

  ipcMain.handle('ssh:disconnect', (_event, sessionId: string) => {
    sshManager.disconnect(sessionId)
  })

  ipcMain.handle('ssh:isConnected', (_event, sessionId: string) => {
    return sshManager.isConnected(sessionId)
  })

  // === Host Key Verification ===

  // Forward host key events to the renderer
  sshManager.on(
    'hostkey:unknown',
    (sessionId: string, host: string, port: number, fingerprint: string, algorithm: string) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          'ssh:hostKeyUnknown',
          sessionId,
          host,
          port,
          fingerprint,
          algorithm
        )
      }
    }
  )

  sshManager.on(
    'hostkey:changed',
    (
      sessionId: string,
      host: string,
      port: number,
      oldFingerprint: string,
      newFingerprint: string,
      algorithm: string
    ) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          'ssh:hostKeyChanged',
          sessionId,
          host,
          port,
          oldFingerprint,
          newFingerprint,
          algorithm
        )
      }
    }
  )

  ipcMain.handle(
    'ssh:verifyHostKey',
    (_event, sessionId: string, accepted: boolean) => {
      sshManager.resolveHostKeyVerification(sessionId, accepted)
    }
  )

  ipcMain.handle('ssh:getKnownHosts', () => {
    return sshManager.getKnownHosts()
  })

  ipcMain.handle(
    'ssh:removeKnownHost',
    (_event, host: string, port: number) => {
      sshManager.removeHostKey(host, port)
    }
  )

  // === Port Forwarding ===

  ipcMain.handle(
    'ssh:addLocalForward',
    async (
      _event,
      sessionId: string,
      localPort: number,
      remoteHost: string,
      remotePort: number
    ): Promise<string> => {
      return sshManager.addLocalForward(sessionId, localPort, remoteHost, remotePort)
    }
  )

  ipcMain.handle(
    'ssh:addRemoteForward',
    async (
      _event,
      sessionId: string,
      remotePort: number,
      localHost: string,
      localPort: number
    ): Promise<string> => {
      return sshManager.addRemoteForward(sessionId, remotePort, localHost, localPort)
    }
  )

  ipcMain.handle('ssh:listForwards', (_event, sessionId: string) => {
    return sshManager.listForwards(sessionId)
  })

  ipcMain.handle(
    'ssh:removeForward',
    (_event, sessionId: string, forwardId: string) => {
      sshManager.removeForward(sessionId, forwardId)
    }
  )
}
