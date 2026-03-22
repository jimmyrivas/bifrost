import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import { platform } from 'os'

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
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:data', id, data)
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      sessions.delete(id)
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:exit', id, exitCode)
      }
    })

    sessions.set(id, { process: ptyProcess, id })
    return id
  })

  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    const session = sessions.get(id)
    if (session) {
      session.process.write(data)
    }
  })

  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    const session = sessions.get(id)
    if (session) {
      session.process.resize(cols, rows)
    }
  })

  ipcMain.handle('terminal:destroy', (_event, id: string) => {
    const session = sessions.get(id)
    if (session) {
      session.process.kill()
      sessions.delete(id)
    }
  })

  ipcMain.handle('terminal:getDefaultShell', () => {
    return getDefaultShell()
  })
}

export function destroyAllSessions(): void {
  for (const [id, session] of sessions) {
    session.process.kill()
    sessions.delete(id)
  }
}
