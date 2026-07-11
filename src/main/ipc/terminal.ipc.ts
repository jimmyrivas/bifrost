import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import {
  setMainWindow,
  setOwner,
  removeOwner,
  sendToOwner,
  bufferOutput,
  getBuffer,
  transferOwnership
} from '../services/window-router'
import {
  getDefaultShell,
  getHomeDir,
  detectShells,
  type ShellInfo
} from '../services/platform'
import { sessionLogger } from '../services/session-logger'
import { auditLogger } from '../services/audit-log'

interface PtySession {
  process: pty.IPty
  id: string
}

export type { ShellInfo }

const sessions = new Map<string, PtySession>()
let idCounter = 0

export function registerTerminalIpc(mainWindow: BrowserWindow): void {
  setMainWindow(mainWindow)

  ipcMain.handle('terminal:create', (_event, cols: number, rows: number, shell?: string, shellArgs?: string[], multiplexerCmd?: string) => {
    const id = `terminal-${++idCounter}`
    const shellPath = shell || getDefaultShell()
    const args = shellArgs ?? []

    // When a multiplexer command is provided, wrap with /bin/sh -c so the
    // local PTY runs dtach/tmux directly instead of an interactive shell.
    const spawnPath = multiplexerCmd ? '/bin/sh' : shellPath
    const spawnArgs = multiplexerCmd ? ['-c', multiplexerCmd] : args

    const ptyProcess = pty.spawn(spawnPath, spawnArgs, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: getHomeDir(),
      env: process.env as Record<string, string>
    })

    ptyProcess.onData((data: string) => {
      bufferOutput(id, data)
      sendToOwner(id, 'terminal:data', id, data)
      // Feed an active session log (no-op when logging isn't started for this
      // terminal) — SSH output is fed the same way in ssh.ipc.ts.
      sessionLogger.write(id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      sessions.delete(id)
      sendToOwner(id, 'terminal:exit', id, exitCode)
      removeOwner(id)
      // Close out an active session log (no-op when none is active).
      const logPath = sessionLogger.stopLogging(id)
      if (logPath) {
        auditLogger.log({
          connectionId: id,
          connectionName: id,
          host: '',
          event: 'session_log_stop',
          details: { sessionId: id, filePath: logPath, reason: 'session_closed' }
        })
      }
    })

    // Owner = the window that created it
    const senderWindow = BrowserWindow.fromWebContents(_event.sender)
    if (senderWindow) {
      setOwner(id, senderWindow)
    }

    sessions.set(id, { process: ptyProcess, id })
    return id
  })

  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    sessions.get(id)?.process.write(data)
  })

  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    sessions.get(id)?.process.resize(cols, rows)
  })

  ipcMain.handle('terminal:destroy', (_event, id: string) => {
    const session = sessions.get(id)
    if (session) {
      session.process.kill()
      sessions.delete(id)
      removeOwner(id)
    }
  })

  ipcMain.handle('terminal:getDefaultShell', () => getDefaultShell())

  ipcMain.handle('terminal:listShells', () => detectShells())

  // Transfer terminal ownership to the calling window (for detach/reattach)
  ipcMain.handle('terminal:transferOwnership', (_event, terminalId: string) => {
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (win) {
      transferOwnership(terminalId, win)
    }
  })

  // Get buffered output for replay after transfer
  ipcMain.handle('terminal:getBuffer', (_event, terminalId: string) => {
    return getBuffer(terminalId)
  })
}

export function destroyAllSessions(): void {
  for (const [, session] of sessions) {
    session.process.kill()
  }
  sessions.clear()
}
