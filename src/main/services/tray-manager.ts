import { Tray, Menu, nativeImage, app, BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { join } from 'path'

export interface TrayConnectionEntry {
  id: string
  name: string
  protocol: string
  host: string
}

type ConnectCallback = (connectionId: string) => void

let tray: Tray | null = null
let connections: TrayConnectionEntry[] = []
let connectCallback: ConnectCallback | null = null

function buildContextMenu(): Menu {
  const connectionItems: MenuItemConstructorOptions[] = connections.map((conn) => ({
    label: `${conn.name} (${conn.protocol}://${conn.host})`,
    click: (): void => {
      if (connectCallback) {
        connectCallback(conn.id)
      }
    }
  }))

  const template: MenuItemConstructorOptions[] = [
    {
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
    },
    { type: 'separator' }
  ]

  if (connectionItems.length > 0) {
    template.push(
      { label: 'Connections', enabled: false },
      ...connectionItems,
      { type: 'separator' }
    )
  } else {
    template.push({ label: 'No connections', enabled: false }, { type: 'separator' })
  }

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
