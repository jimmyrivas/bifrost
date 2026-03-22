import { BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export class QuakeTerminal {
  private window: BrowserWindow | null = null
  private visible = false
  private hotkey: string

  constructor(hotkey = 'F12') {
    this.hotkey = hotkey
  }

  register(): void {
    globalShortcut.register(this.hotkey, () => {
      this.toggle()
    })
  }

  unregister(): void {
    globalShortcut.unregister(this.hotkey)
  }

  toggle(): void {
    if (!this.window || this.window.isDestroyed()) {
      this.createWindow()
      this.show()
    } else if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  }

  private createWindow(): void {
    const display = screen.getPrimaryDisplay()
    const { width } = display.workAreaSize

    this.window = new BrowserWindow({
      width,
      height: 400,
      x: 0,
      y: 0,
      frame: false,
      resizable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      transparent: false,
      backgroundColor: '#0a0a0b',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/quake')
    } else {
      this.window.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: '/quake'
      })
    }

    this.window.on('blur', () => {
      this.hide()
    })

    this.window.on('closed', () => {
      this.window = null
      this.visible = false
    })
  }

  private show(): void {
    if (!this.window) return

    const display = screen.getPrimaryDisplay()
    const { width } = display.workAreaSize

    this.window.setBounds({ x: 0, y: 0, width, height: 400 })
    this.window.show()
    this.window.focus()
    this.visible = true
  }

  private hide(): void {
    if (!this.window) return
    this.window.hide()
    this.visible = false
  }

  isVisible(): boolean {
    return this.visible
  }

  destroy(): void {
    this.unregister()
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
    }
    this.window = null
    this.visible = false
  }
}
