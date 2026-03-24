import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import { platform, homedir } from 'os'
import { execFileSync } from 'child_process'
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

export interface ShellInfo {
  name: string        // Display name: "Bash", "PowerShell", etc.
  path: string        // Binary path: "/bin/bash", "/usr/bin/pwsh"
  id: string          // Identifier: "bash", "zsh", "pwsh", "fish"
}

const sessions = new Map<string, PtySession>()
let idCounter = 0
let cachedShells: ShellInfo[] | null = null

function getDefaultShell(): string {
  if (platform() === 'win32') return 'powershell.exe'
  return process.env.SHELL || '/bin/bash'
}

/** Detect all available shells on the system */
function detectShells(): ShellInfo[] {
  if (cachedShells) return cachedShells

  const candidates: Array<{ id: string; name: string; bins: string[] }> = [
    { id: 'bash', name: 'Bash', bins: ['/bin/bash', '/usr/bin/bash'] },
    { id: 'zsh', name: 'Zsh', bins: ['/bin/zsh', '/usr/bin/zsh'] },
    { id: 'fish', name: 'Fish', bins: ['/usr/bin/fish', '/usr/local/bin/fish'] },
    { id: 'pwsh', name: 'PowerShell', bins: ['/usr/bin/pwsh', '/usr/local/bin/pwsh', '/snap/bin/pwsh'] },
    { id: 'sh', name: 'POSIX sh', bins: ['/bin/sh'] }
  ]

  if (platform() === 'win32') {
    cachedShells = [
      { id: 'pwsh', name: 'PowerShell 7', path: 'pwsh.exe' },
      { id: 'powershell', name: 'Windows PowerShell', path: 'powershell.exe' },
      { id: 'cmd', name: 'Command Prompt', path: 'cmd.exe' }
    ]
    return cachedShells
  }

  const shells: ShellInfo[] = []
  const { existsSync } = require('fs') as typeof import('fs')

  for (const candidate of candidates) {
    // Check known paths first
    for (const bin of candidate.bins) {
      if (existsSync(bin)) {
        shells.push({ id: candidate.id, name: candidate.name, path: bin })
        break
      }
    }
    // If not found via paths, try `which`
    if (!shells.find((s) => s.id === candidate.id)) {
      try {
        const path = execFileSync('which', [candidate.id], {
          encoding: 'utf-8', timeout: 2000, stdio: 'pipe'
        }).trim()
        if (path) {
          shells.push({ id: candidate.id, name: candidate.name, path })
        }
      } catch { /* not installed */ }
    }
  }

  cachedShells = shells
  return shells
}

export function registerTerminalIpc(mainWindow: BrowserWindow): void {
  setMainWindow(mainWindow)

  ipcMain.handle('terminal:create', (_event, cols: number, rows: number, shell?: string) => {
    const id = `terminal-${++idCounter}`
    const shellPath = shell || getDefaultShell()

    const ptyProcess = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME || homedir() || '/',
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
