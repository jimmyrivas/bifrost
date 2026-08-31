import { Tray, Menu, nativeImage, app, BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

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

/**
 * Resolve the tray icon to a REAL filesystem path. Linux SNI/AppIndicator reads
 * the tray icon from disk by path and cannot read inside app.asar, so we ship it
 * via extraResources at <resourcesPath>/icon.png. Returns a path string (best
 * for Linux) or null if none exists. Dev path resolves from the repo.
 */
function resolveTrayIconPath(): string | null {
  const candidates = [
    join(process.resourcesPath ?? '', 'icon.png'), // packaged: extraResources
    join(__dirname, '../../resources/icon.png') // dev: repo resources/
  ]
  for (const p of candidates) {
    if (p && existsSync(p)) return p
  }
  console.warn('[tray] no tray icon file found; tray may be invisible on KDE/Wayland:', candidates)
  return null
}

export class TrayManager {
  create(onConnect?: ConnectCallback): void {
    if (tray) return

    if (onConnect) {
      connectCallback = onConnect
    }

    // Pass a real file PATH (not a nativeImage) on Linux so AppIndicator/SNI can
    // read the icon from disk; fall back to a resized nativeImage otherwise.
    const iconPath = resolveTrayIconPath()
    const icon = iconPath
      ? nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 })
      : nativeImage.createEmpty()
    tray = new Tray(iconPath && process.platform === 'linux' ? iconPath : icon)
    tray.setToolTip('Bifrost Connection Manager')
    tray.setContextMenu(buildContextMenu())
    console.log(`[tray] Tray created (icon: ${iconPath ?? 'none'}). If nothing shows on KDE/Wayland, the SNI host may not have picked it up.`)

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
