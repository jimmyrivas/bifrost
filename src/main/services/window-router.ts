import { BrowserWindow } from 'electron'

/**
 * Routes IPC messages to the correct window based on terminal/session ownership.
 * Maintains output buffers for replay when transferring terminals between windows.
 */

const owners = new Map<string, BrowserWindow>()
const buffers = new Map<string, string[]>()
const BUFFER_MAX = 5000

let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export function setOwner(sessionId: string, win: BrowserWindow): void {
  owners.set(sessionId, win)
}

export function getOwner(sessionId: string): BrowserWindow | null {
  const owner = owners.get(sessionId)
  if (owner && !owner.isDestroyed()) return owner
  return getMainWindow()
}

export function removeOwner(sessionId: string): void {
  owners.delete(sessionId)
  buffers.delete(sessionId)
}

export function sendToOwner(sessionId: string, channel: string, ...args: unknown[]): void {
  const win = getOwner(sessionId)
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args)
  }
}

export function bufferOutput(sessionId: string, data: string): void {
  let buf = buffers.get(sessionId)
  if (!buf) {
    buf = []
    buffers.set(sessionId, buf)
  }
  buf.push(data)
  if (buf.length > BUFFER_MAX) {
    buffers.set(sessionId, buf.slice(-BUFFER_MAX))
  }
}

export function getBuffer(sessionId: string): string {
  const buf = buffers.get(sessionId)
  return buf ? buf.join('') : ''
}

export function transferOwnership(sessionId: string, newWin: BrowserWindow): void {
  owners.set(sessionId, newWin)
}

export function clearAll(): void {
  owners.clear()
  buffers.clear()
}
