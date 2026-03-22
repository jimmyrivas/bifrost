import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import { platform } from 'os'
import {
  setMainWindow,
  setOwner,
  removeOwner,
  sendToOwner,
  bufferOutput,
  getBuffer,
  transferOwnership
} from '../services/window-router'

interface PtySession {
  process: pty.IPty
  id: string
}

const sessions = new Map<string, PtySession>()
let idCounter = 0

function getDefaultShell(): string {
  if (platform() === 'win32') return 'powershell.exe'
  return process.env.SHELL || '/bin/bash'
}

export function registerTerminalIpc(mainWindow: BrowserWindow): void {
  setMainWindow(mainWindow)

  ipcMain.handle('terminal:create', (_event, cols: number, rows: number) => {
    const id = `terminal-${++idCounter}`
    const shell = getDefaultShell()

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME || '/',
      env: process.env as Record<string, string>
    })

    ptyProcess.onData((data: string) => {
      bufferOutput(id, data)
      sendToOwner(id, 'terminal:data', id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      sessions.delete(id)
      sendToOwner(id, 'terminal:exit', id, exitCode)
      removeOwner(id)
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
