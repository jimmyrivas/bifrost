import { Tray, Menu, nativeImage, app, BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { join } from 'path'

export interface TrayConnectionEntry {
  id: string
  name: string
  protocol: string
  host: string
  isFavorite?: boolean
  lastUsed?: number
}

type ConnectCallback = (connectionId: string) => void

let tray: Tray | null = null
let connections: TrayConnectionEntry[] = []
let connectCallback: ConnectCallback | null = null

function buildContextMenu(): Menu {
  const template: MenuItemConstructorOptions[] = []

  // Favorites section
  const favorites = connections.filter((c) => c.isFavorite)
  if (favorites.length > 0) {
    template.push({ label: 'Favorites', enabled: false })
    for (const conn of favorites) {
      template.push({
        label: `${conn.name} (${conn.protocol}://${conn.host})`,
        click: (): void => { connectCallback?.(conn.id) }
      })
    }
    template.push({ type: 'separator' })
  }

  // Recent connections (last 5)
  const recents = connections
    .filter((c) => c.lastUsed != null)
    .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))
    .slice(0, 5)

  if (recents.length > 0) {
    template.push({ label: 'Recent', enabled: false })
    for (const conn of recents) {
      template.push({
        label: `${conn.name} (${conn.protocol}://${conn.host})`,
        click: (): void => { connectCallback?.(conn.id) }
      })
    }
    template.push({ type: 'separator' })
  }

  // If no favorites or recents, show placeholder
  if (favorites.length === 0 && recents.length === 0) {
    template.push({ label: 'No connections', enabled: false })
    template.push({ type: 'separator' })
  }

  template.push({
    label: 'Show Bifrost',
    click: (): void => {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        const win = windows[0]
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    }
  })

  template.push({ type: 'separator' })

  template.push({
    label: 'Quit',
    click: (): void => {
      app.quit()
    }
  })

  return Menu.buildFromTemplate(template)
}

function createTrayIcon(): Electron.NativeImage {
  // Attempt to load icon from resources; fall back to an empty 16x16 image
  try {
    const iconPath = join(__dirname, '../../resources/icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) {
      return icon.resize({ width: 16, height: 16 })
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: create a simple 16x16 icon
  return nativeImage.createEmpty()
}

export class TrayManager {
  create(onConnect?: ConnectCallback): void {
    if (tray) return

    if (onConnect) {
      connectCallback = onConnect
    }

    const icon = createTrayIcon()
    tray = new Tray(icon)
    tray.setToolTip('Bifrost Connection Manager')
    tray.setContextMenu(buildContextMenu())

    tray.on('click', () => {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        const win = windows[0]
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    })
  }

  updateConnections(newConnections: TrayConnectionEntry[]): void {
    connections = newConnections
    if (tray) {
      tray.setContextMenu(buildContextMenu())
    }
  }

  setConnectCallback(callback: ConnectCallback): void {
    connectCallback = callback
  }

  destroy(): void {
    if (tray) {
      tray.destroy()
      tray = null
    }
    connections = []
    connectCallback = null
  }

  isCreated(): boolean {
    return tray !== null
  }
}

export const trayManager = new TrayManager()
