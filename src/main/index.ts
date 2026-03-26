import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
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
import { registerPasswordManagerIpc } from './ipc/password-manager.ipc'
import { registerSnippetsIpc } from './ipc/snippets.ipc'
import { registerScriptsIpc } from './ipc/scripts.ipc'
import { registerImportIpc } from './ipc/import.ipc'
import { registerDiscoveryIpc } from './ipc/discovery.ipc'
import { registerAuditIpc } from './ipc/audit.ipc'
import { registerAiIpc } from './ipc/ai.ipc'
import { loadAiConfig } from './services/ai-assistant'
import { registerConfigSyncIpc } from './ipc/config-sync.ipc'
import { registerSshCaIpc } from './ipc/ssh-ca.ipc'
import { registerPluginsIpc } from './ipc/plugins.ipc'
import { registerFontsIpc } from './ipc/fonts.ipc'
import { registerRemoteCommandsIpc } from './ipc/remote-commands.ipc'
import { registerTunnelsIpc, autoStartTunnels } from './ipc/tunnels.ipc'
import { registerNotesIpc } from './ipc/notes.ipc'
import { macroExecutor } from './services/macro-executor'
import { auditLogger } from './services/audit-log'
import { sessionLogger } from './services/session-logger'
import { stopAllRecordings } from './services/session-recorder'
import { runMigrations } from './db/migrate'
import { closeDatabase } from './db'
import { sshManager } from './services/ssh-manager'
import { sftpManager } from './services/sftp-manager'
import { externalProtocolManager } from './services/external-protocol'
import { trayManager } from './services/tray-manager'
import { connectionHealthMonitor } from './services/connection-health'

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized?: boolean
}

function getWindowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState(): WindowState {
  try {
    const statePath = getWindowStatePath()
    if (existsSync(statePath)) {
      return JSON.parse(readFileSync(statePath, 'utf-8')) as WindowState
    }
  } catch {
    // Ignore
  }
  return { width: 1280, height: 800 }
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const bounds = win.getBounds()
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: win.isMaximized()
    }
    writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch {
    // Non-critical
  }
}

function createWindow(): BrowserWindow {
  const savedState = loadWindowState()

  const mainWindow = new BrowserWindow({
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Bifrost',
    backgroundColor: '#131316',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (savedState.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Save window state on close (#39)
  mainWindow.on('close', () => {
    saveWindowState(mainWindow)
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

  try {
    runMigrations()
  } catch (err) {
    console.error('Failed to run migrations:', err)
  }

  // Load persisted AI config from DB
  loadAiConfig()

  // Register non-window-dependent IPC handlers
  registerConnectionsIpc()
  registerCredentialsIpc()
  registerClusterIpc()
  registerSystemIpc()
  registerSftpIpc()
  registerPasswordManagerIpc()
  registerSnippetsIpc()
  registerScriptsIpc()
  registerImportIpc()
  registerDiscoveryIpc()
  registerAuditIpc()
  registerConfigSyncIpc()
  registerSshCaIpc()
  registerPluginsIpc()
  registerFontsIpc()
  registerRemoteCommandsIpc()
  registerTunnelsIpc()
  registerNotesIpc()

  // Rotate audit log on startup (remove entries older than 30 days)
  try {
    auditLogger.rotate()
  } catch (err) {
    console.warn('Audit log rotation failed (non-critical):', err)
  }

  // Auto-start tunnels marked with autoStart
  autoStartTunnels().catch((err) => {
    console.warn('Tunnel auto-start failed (non-critical):', err)
  })

  // Custom menu: remove default Ctrl+R/Ctrl+Shift+R/F5 that conflict with terminal
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => BrowserWindow.getFocusedWindow()?.webContents.send('menu:new-tab') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { type: 'separator' },
        // Dev tools only in development — no Ctrl+R reload
        ...(is.dev ? [
          { role: 'toggleDevTools' as const, accelerator: 'F12' },
          { label: 'Reload', accelerator: 'CmdOrCtrl+F5', role: 'reload' as const }
        ] : [])
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

  // NOTE: intentionally NOT calling optimizer.watchWindowShortcuts()
  // It registers Ctrl+R as reload which conflicts with bash reverse-search

  const mainWindow = createWindow()

  // Fullscreen toggle (#73)
  ipcMain.handle('window:toggleFullscreen', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
  })

  // Detach tab to separate window (#72)
  // The detached window loads with ?detach=tabId — the renderer checks this
  // and renders only that terminal (no sidebar, no tab bar).
  // Main window removes the tab from its store via IPC event.
  const detachedWindows = new Map<string, BrowserWindow>()

  ipcMain.handle('window:detachTab', (_event, tabId: string, title: string, connectionId?: string, sessionId?: string) => {
    const detachedWindow = new BrowserWindow({
      width: 900,
      height: 600,
      title: `Bifrost — ${title}`,
      backgroundColor: '#131316',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    detachedWindows.set(tabId, detachedWindow)

    const query: Record<string, string> = { detach: tabId }
    if (connectionId) query.connId = connectionId
    if (sessionId) query.sessionId = sessionId

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const params = new URLSearchParams(query).toString()
      detachedWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?${params}`)
    } else {
      detachedWindow.loadFile(join(__dirname, '../renderer/index.html'), { query })
    }

    detachedWindow.on('closed', () => {
      detachedWindows.delete(tabId)
      // Notify main window to re-attach the tab
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('window:tabReattached', tabId)
      }
    })
  })

  // Re-attach: close the detached window, main window gets the event above
  ipcMain.handle('window:reattachTab', (_event, tabId: string) => {
    const win = detachedWindows.get(tabId)
    if (win && !win.isDestroyed()) {
      win.close() // This triggers the 'closed' event which sends tabReattached
    }
  })

  // Confirm dialog for pre/post exec commands (#55)
  ipcMain.handle('window:confirmDialog', async (_event, message: string) => {
    const { dialog } = await import('electron')
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Cancel', 'Execute'],
      defaultId: 1,
      title: 'Confirm Execution',
      message
    })
    return result.response === 1
  })

  // Wire macro executor confirm callback to IPC (#55)
  macroExecutor.setConfirmCallback(async (message: string) => {
    const { dialog } = await import('electron')
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Cancel', 'Execute'],
      defaultId: 1,
      title: 'Confirm Execution',
      message
    })
    return result.response === 1
  })

  // Register window-dependent IPC handlers
  registerTerminalIpc(mainWindow)
  registerSshIpc(mainWindow)
  registerExpectIpc(mainWindow)
  registerProtocolsIpc(mainWindow)
  registerAiIpc(mainWindow)

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
  stopAllRecordings()
  destroyAllSessions()
  sftpManager.closeAll()
  sshManager.disconnectAll()
  externalProtocolManager.disconnectAll()
  sessionLogger.stopAll()
  connectionHealthMonitor.stopAll()
  trayManager.destroy()
  closeDatabase()
})
