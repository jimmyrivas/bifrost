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
import { registerClipboardIpc } from './ipc/clipboard.ipc'
import { hasPendingCleanup, cleanupImagePastes } from './services/image-paste'
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
import { activatePlugins, deactivatePlugins } from './services/plugin-manager'
import { registerFontsIpc } from './ipc/fonts.ipc'
import { registerRemoteCommandsIpc } from './ipc/remote-commands.ipc'
import { registerTunnelsIpc, autoStartTunnels } from './ipc/tunnels.ipc'
import { registerNotesIpc } from './ipc/notes.ipc'
import { registerMcpIpc, autoStartMcp, stopMcpOnExit } from './ipc/mcp.ipc'
import { registerMultiplexerIpc } from './ipc/multiplexer.ipc'
import { macroExecutor } from './services/macro-executor'
import { auditLogger } from './services/audit-log'
import { sessionLogger } from './services/session-logger'
import { stopAllRecordings } from './services/session-recorder'
import { runMigrations } from './db/migrate'
import { registerDbEncryptionIpc, setOnUnlocked } from './ipc/db-encryption.ipc'
import { isLockedAtRest, finalizeOnQuit } from './services/db-encryption'
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

let unlockWindow: BrowserWindow | null = null

/**
 * If the DB is encrypted at rest, show a small unlock window and block startup
 * until the passphrase is accepted (which decrypts the file). The `db:unlock`
 * IPC handler calls back on success. Closing the window without unlocking quits.
 */
function ensureDatabaseUnlocked(): Promise<void> {
  if (!isLockedAtRest()) return Promise.resolve()

  return new Promise<void>((resolve) => {
    let unlocked = false
    setOnUnlocked(() => {
      unlocked = true
      setOnUnlocked(null)
      unlockWindow?.close()
      unlockWindow = null
      resolve()
    })

    const win = new BrowserWindow({
      width: 420,
      height: 320,
      resizable: false,
      show: false,
      title: 'Unlock Bifrost',
      backgroundColor: '#131316',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    unlockWindow = win
    win.on('ready-to-show', () => win.show())
    win.on('closed', () => {
      // Cancelled without unlocking → nothing can proceed, so quit.
      if (!unlocked) app.exit(0)
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#unlock`)
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'unlock' })
    }
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.bifrost.app')

  // Register db-encryption IPC once (db:unlock/enable/disable/status).
  registerDbEncryptionIpc()
  // Gate: if the DB is encrypted at rest, prompt for the passphrase and decrypt
  // before anything touches the database.
  await ensureDatabaseUnlocked()

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
  registerClipboardIpc()
  registerPasswordManagerIpc()
  registerSnippetsIpc()
  registerScriptsIpc()
  registerImportIpc()
  registerDiscoveryIpc()
  registerAuditIpc()
  registerConfigSyncIpc()
  registerSshCaIpc()
  registerPluginsIpc()

  // Activate all installed plugins
  activatePlugins()
  registerFontsIpc()
  registerRemoteCommandsIpc()
  registerTunnelsIpc()
  registerNotesIpc()
  registerMcpIpc()

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

  // Auto-start MCP server if configured
  try {
    autoStartMcp()
  } catch (err) {
    console.warn('MCP auto-start failed (non-critical):', err)
  }

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

  // === AI Assistant detach/reattach (enhance-ai-assistant-panel) ===
  // The detached window loads with ?aiDetach=1 and renders only the assistant.
  let aiDetachedWindow: BrowserWindow | null = null

  ipcMain.handle('window:detachAi', (_event, connectionId?: string) => {
    if (aiDetachedWindow && !aiDetachedWindow.isDestroyed()) {
      aiDetachedWindow.focus()
      return
    }
    aiDetachedWindow = new BrowserWindow({
      width: 420,
      height: 640,
      title: 'Bifrost — AI Assistant',
      backgroundColor: '#131316',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    const query: Record<string, string> = { aiDetach: '1' }
    if (connectionId) query.connId = connectionId

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const params = new URLSearchParams(query).toString()
      aiDetachedWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?${params}`)
    } else {
      aiDetachedWindow.loadFile(join(__dirname, '../renderer/index.html'), { query })
    }

    aiDetachedWindow.on('closed', () => {
      aiDetachedWindow = null
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('window:aiReattached')
      }
    })
  })

  ipcMain.handle('window:reattachAi', () => {
    if (aiDetachedWindow && !aiDetachedWindow.isDestroyed()) {
      aiDetachedWindow.close() // triggers 'closed' → sends aiReattached
    }
  })

  // Main window forwards active-context changes to the detached assistant so it
  // follows the active tab live.
  ipcMain.on('window:notifyAiContext', (_event, ctx: { connectionId?: string | null; terminalId?: string | null }) => {
    if (aiDetachedWindow && !aiDetachedWindow.isDestroyed()) {
      aiDetachedWindow.webContents.send('window:aiActiveContextChanged', ctx)
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
  registerMultiplexerIpc()

  try {
    // Clicking a connection in the tray opens it in the main window. The
    // connection list itself is pushed by the renderer via `tray:update`
    // (system.ipc) because favorites/recents live in renderer localStorage.
    trayManager.create((connectionId) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.webContents.send('tray:open-connection', connectionId)
      }
    })
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

let imageCleanupStarted = false

app.on('before-quit', (event) => {
  // Delete pasted-image uploads first, while SSH channels are still alive.
  // Defer the actual teardown until that async work finishes, then re-quit.
  if (!imageCleanupStarted && hasPendingCleanup()) {
    imageCleanupStarted = true
    event.preventDefault()
    cleanupImagePastes().finally(() => app.quit())
    return
  }

  stopMcpOnExit()
  deactivatePlugins()
  stopAllRecordings()
  destroyAllSessions()
  sftpManager.closeAll()
  sshManager.disconnectAll()
  externalProtocolManager.disconnectAll()
  sessionLogger.stopAll()
  connectionHealthMonitor.stopAll()
  trayManager.destroy()
  // Re-encrypt the DB to disk (if enabled) and close it. finalizeOnQuit handles
  // the close itself; falls back to a plain close when encryption is off.
  finalizeOnQuit()
})
