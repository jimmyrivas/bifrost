import { ipcMain, BrowserWindow } from 'electron'
import { sendToOwner, bufferOutput, setOwner, removeOwner } from '../services/window-router'
import { sshManager, type SshConnectionConfig, type SshAlgorithms, type HttpProxyConfig } from '../services/ssh-manager'
import { generateTOTP } from '../services/totp'
import { getDatabase, schema } from '../db'
import { eq, and } from 'drizzle-orm'
import {
  startRecording,
  feedData as feedRecording,
  stopRecording,
  isRecording,
  listRecordings,
  getRecording,
  deleteRecording
} from '../services/session-recorder'
import { auditLogger } from '../services/audit-log'
import { sessionLogger } from '../services/session-logger'
import { resolveJumpChainForJson } from '../services/jump-host/runtime'
import { macroExecutor } from '../services/macro-executor'
import type { VariableContext } from '../services/variable-engine'

export function registerSshIpc(mainWindow: BrowserWindow): void {
  // === Pre/Post-connection hooks (#55) ===
  // Maps an SSH sessionId back to the connectionId that created it, so
  // post-connection hooks (which only receive a sessionId on disconnect) can be
  // resolved from the stored execCommands.
  const sessionConnections = new Map<string, string>()

  // Reuse the same native confirm dialog that index.ts already wires for exec
  // commands (#55). Renderer/preload confirm channels are out of scope here, and
  // this is an already-working UI prompt for ask:true hooks.
  async function confirmHookExecution(phase: 'pre' | 'post', command: string): Promise<boolean> {
    const { dialog } = await import('electron')
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Cancel', 'Execute'],
      defaultId: 1,
      title: 'Confirm Hook Execution',
      message: `Execute ${phase}-connection command?`,
      detail: command
    })
    return result.response === 1
  }

  // Load and execute stored pre/post exec commands for a connection via the real
  // macro-executor engine, honoring ask:true and audit-logging each hook.
  async function runConnectionHooks(
    sessionId: string,
    connectionId: string,
    phase: 'pre' | 'post'
  ): Promise<void> {
    try {
      const db = getDatabase()
      const conn = db
        .select()
        .from(schema.connections)
        .where(eq(schema.connections.id, connectionId))
        .get()
      if (!conn) return

      const commands = db
        .select()
        .from(schema.execCommands)
        .where(
          and(
            eq(schema.execCommands.connectionId, connectionId),
            eq(schema.execCommands.phase, phase)
          )
        )
        .all()
        .filter((c) => c.isDefault !== false)
        .sort((a, b) => a.sortOrder - b.sortOrder)

      if (commands.length === 0) return

      const context: VariableContext = {
        connectionId,
        ip: conn.host ?? undefined,
        port: conn.port ?? undefined,
        user: conn.username ?? undefined,
        uuid: conn.id,
        name: conn.name ?? undefined
      }

      for (const cmd of commands) {
        if (cmd.ask) {
          const confirmed = await confirmHookExecution(phase, cmd.command)
          if (!confirmed) {
            auditLogger.log({
              connectionId,
              connectionName: conn.name ?? connectionId,
              host: conn.host ?? '',
              event: 'command',
              details: { hook: phase, command: cmd.command, status: 'skipped', sessionId }
            })
            continue
          }
        }

        try {
          // ask already handled above; pass ask:false so the engine's own confirm
          // callback isn't invoked a second time.
          await macroExecutor.executeExecCommands(
            [
              {
                id: cmd.id,
                phase,
                command: cmd.command,
                ask: false,
                isDefault: true,
                sortOrder: cmd.sortOrder
              }
            ],
            context
          )
          auditLogger.log({
            connectionId,
            connectionName: conn.name ?? connectionId,
            host: conn.host ?? '',
            event: 'command',
            details: { hook: phase, command: cmd.command, status: 'executed', sessionId }
          })
        } catch (err) {
          auditLogger.log({
            connectionId,
            connectionName: conn.name ?? connectionId,
            host: conn.host ?? '',
            event: 'error',
            details: {
              hook: phase,
              command: cmd.command,
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
              sessionId
            }
          })
        }
      }
    } catch (err) {
      console.error(`Failed to run ${phase}-connection hooks:`, err)
    }
  }

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

      const jumpChain = await resolveJumpChainForJson(conn.jumpServerConfig)

      const config: SshConnectionConfig = {
        host: conn.host,
        port: conn.port ?? 22,
        username: conn.username ?? '',
        authType: (conn.authType as SshConnectionConfig['authType']) ?? 'manual',
        encryptedPassword: conn.encryptedPassword,
        privateKeyPath: conn.privateKeyPath,
        encryptedPassphrase: conn.encryptedPassphrase,
        useFido2: conn.authType === 'fido2',
        jumpChain: jumpChain.length > 0 ? jumpChain : undefined
      }

      const sessionId = await sshManager.connect(config)
      sessionConnections.set(sessionId, connectionId)

      // Run pre-connection hooks right after a successful connect (#55).
      await runConnectionHooks(sessionId, connectionId, 'pre')

      return sessionId
    }
  )

  // Track TOTP secrets per session for auto-injection
  const totpSecrets = new Map<string, string>()

  ipcMain.handle(
    'ssh:openShell',
    async (
      _event,
      sessionId: string,
      cols: number,
      rows: number,
      connectionId?: string,
      multiplexerCmd?: string
    ): Promise<void> => {
      const stream = await sshManager.openShell(sessionId, cols, rows, multiplexerCmd)

      // Set owner to the window that opened the shell
      const senderWin = BrowserWindow.fromWebContents(_event.sender)
      if (senderWin) setOwner(sessionId, senderWin)

      // Load TOTP secret if configured for this connection
      if (connectionId) {
        try {
          const db = getDatabase()
          const conn = db.select().from(schema.connections).where(eq(schema.connections.id, connectionId)).get()
          if (conn?.sshConfig) {
            const cfg = JSON.parse(conn.sshConfig)
            if (cfg.totpSecret) totpSecrets.set(sessionId, cfg.totpSecret)
          }
        } catch { /* ok */ }
      }

      let totpBuffer = ''

      stream.on('data', (data: Buffer) => {
        const str = data.toString()
        bufferOutput(sessionId, str)
        sendToOwner(sessionId, 'ssh:data', sessionId, str)
        // Feed the live shell output into an active asciicast recording (#93).
        // No-ops when no recording is active for this session.
        feedRecording(sessionId, str, 'output')
        // Feed the same output into an active session log (plain-text transcript).
        // No-ops when logging isn't started for this session.
        sessionLogger.write(sessionId, str)

        // TOTP auto-inject: detect verification prompts
        const secret = totpSecrets.get(sessionId)
        if (secret) {
          totpBuffer += str
          if (totpBuffer.length > 512) totpBuffer = totpBuffer.slice(-256)
          const totpPattern = /(?:verification code|otp|token|2fa|two.factor|authenticator).*?[:>]\s*$/i
          if (totpPattern.test(totpBuffer)) {
            const code = generateTOTP(secret)
            setTimeout(() => sshManager.write(sessionId, code + '\n'), 200)
            // Security: remove secret after single use to prevent replay by malicious server
            totpSecrets.delete(sessionId)
            totpBuffer = ''
          }
        }
      })

      stream.on('close', () => {
        sendToOwner(sessionId, 'ssh:close', sessionId)
        removeOwner(sessionId)
        totpSecrets.delete(sessionId)
        sessionConnections.delete(sessionId)
        // Finalize any active capture so files aren't left open and the
        // renderer's capture indicators can settle. Both are no-ops when
        // nothing is active for this session.
        stopRecording(sessionId)
        sessionLogger.stopLogging(sessionId)
        sshManager.disconnect(sessionId)
      })
    }
  )

  ipcMain.on('ssh:write', (_event, sessionId: string, data: string) => {
    sshManager.write(sessionId, data)
    // Record user keystrokes into an active recording (#93). No-op if inactive.
    feedRecording(sessionId, data, 'input')
  })

  ipcMain.on('ssh:resize', (_event, sessionId: string, cols: number, rows: number) => {
    sshManager.resize(sessionId, cols, rows)
  })

  ipcMain.handle('ssh:disconnect', async (_event, sessionId: string) => {
    // Run post-connection hooks before tearing down the session (#55).
    const connectionId = sessionConnections.get(sessionId)
    if (connectionId) {
      await runConnectionHooks(sessionId, connectionId, 'post')
      sessionConnections.delete(sessionId)
    }
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

  // === Algorithm Selection (#17) ===

  ipcMain.handle('ssh:listSupportedAlgorithms', () => {
    return sshManager.listSupportedAlgorithms()
  })

  // === Session Multiplexing (#23) ===

  ipcMain.handle(
    'ssh:findExistingSession',
    (_event, config: SshConnectionConfig): string | undefined => {
      return sshManager.findExistingSession(config)
    }
  )

  ipcMain.handle(
    'ssh:acquireSession',
    (_event, sessionId: string): boolean => {
      return sshManager.acquireSession(sessionId)
    }
  )

  ipcMain.handle(
    'ssh:releaseSession',
    (_event, sessionId: string) => {
      sshManager.releaseSession(sessionId)
    }
  )

  // === MFA/2FA Keyboard Interactive (#96) ===

  sshManager.on(
    'keyboard-interactive',
    (sessionId: string, prompts: Array<{ prompt: string; echo: boolean }>) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ssh:keyboardInteractive', sessionId, prompts)
      }
    }
  )

  ipcMain.handle(
    'ssh:respondKeyboardInteractive',
    (_event, sessionId: string, responses: string[]) => {
      sshManager.resolveKeyboardInteractive(sessionId, responses)
    }
  )

  // === Session Recording (#93) ===

  ipcMain.handle(
    'ssh:startRecording',
    (_event, sessionId: string, options?: { width?: number; height?: number; title?: string }): string => {
      const recordingId = startRecording(sessionId, options)
      auditLogger.log({
        connectionId: sessionId,
        connectionName: sessionId,
        host: '',
        event: 'recording_start',
        details: { recordingId }
      })
      return recordingId
    }
  )

  ipcMain.handle(
    'ssh:stopRecording',
    (_event, sessionId: string): string | null => {
      const filePath = stopRecording(sessionId)
      auditLogger.log({
        connectionId: sessionId,
        connectionName: sessionId,
        host: '',
        event: 'recording_stop',
        details: { filePath }
      })
      return filePath
    }
  )

  ipcMain.handle(
    'ssh:isRecording',
    (_event, sessionId: string): boolean => {
      return isRecording(sessionId)
    }
  )

  ipcMain.handle('ssh:listRecordings', () => {
    return listRecordings()
  })

  ipcMain.handle(
    'ssh:getRecording',
    (_event, recordingId: string): string | null => {
      return getRecording(recordingId)
    }
  )

  ipcMain.handle(
    'ssh:deleteRecording',
    (_event, recordingId: string): boolean => {
      return deleteRecording(recordingId)
    }
  )

}
