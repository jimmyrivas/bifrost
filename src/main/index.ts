import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerTerminalIpc, destroyAllSessions } from './ipc/terminal.ipc'
import { registerConnectionsIpc } from './ipc/connections.ipc'
import { registerCredentialsIpc } from './ipc/credentials.ipc'
import { registerSshIpc } from './ipc/ssh.ipc'
import { registerExpectIpc } from './ipc/expect.ipc'
import { registerClusterIpc } from './ipc/cluster.ipc'
import { registerSystemIpc } from './ipc/system.ipc'
import { registerSftpIpc } from './ipc/sftp.ipc'
import { registerProtocolsIpc } from './ipc/protocols.ipc'
import { sessionLogger } from './services/session-logger'
import { runMigrations } from './db/migrate'
import { closeDatabase } from './db'
import { sshManager } from './services/ssh-manager'
import { sftpManager } from './services/sftp-manager'
import { externalProtocolManager } from './services/external-protocol'
import { trayManager } from './services/tray-manager'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Bifrost',
    backgroundColor: '#0a0a0b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.bifrost.app')

  // Run database migrations
  try {
    runMigrations()
  } catch (err) {
    console.error('Failed to run migrations:', err)
  }

  // Register IPC handlers (non-window-dependent)
  registerConnectionsIpc()
  registerCredentialsIpc()
  registerClusterIpc()
  registerSystemIpc()
  registerSftpIpc()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()

  // Register window-dependent IPC handlers
  registerTerminalIpc(mainWindow)
  registerSshIpc(mainWindow)
  registerExpectIpc(mainWindow)
  registerProtocolsIpc(mainWindow)

  // Initialize tray (may fail on some Linux environments)
  try {
    trayManager.create()
  } catch (err) {
    console.warn('Tray initialization failed (non-critical):', err)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow()
      registerTerminalIpc(win)
      registerSshIpc(win)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  destroyAllSessions()
  sftpManager.closeAll()
  sshManager.disconnectAll()
  externalProtocolManager.disconnectAll()
  sessionLogger.stopAll()
  trayManager.destroy()
  closeDatabase()
})
