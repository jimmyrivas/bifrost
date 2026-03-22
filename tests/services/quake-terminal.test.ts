import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron modules
const mockShow = vi.fn()
const mockHide = vi.fn()
const mockFocus = vi.fn()
const mockDestroy = vi.fn()
const mockSetBounds = vi.fn()
const mockIsDestroyed = vi.fn(() => false)
const mockLoadURL = vi.fn()
const mockLoadFile = vi.fn()
const mockOn = vi.fn()

vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation(() => ({
    show: mockShow,
    hide: mockHide,
    focus: mockFocus,
    destroy: mockDestroy,
    setBounds: mockSetBounds,
    isDestroyed: mockIsDestroyed,
    loadURL: mockLoadURL,
    loadFile: mockLoadFile,
    on: mockOn
  })),
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn()
  },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 }
    }))
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import { QuakeTerminal } from '../../src/main/services/quake-terminal'
import { globalShortcut } from 'electron'

describe('QuakeTerminal', () => {
  let quake: QuakeTerminal

  beforeEach(() => {
    quake = new QuakeTerminal('F12')
    vi.clearAllMocks()
    process.env['ELECTRON_RENDERER_URL'] = 'http://localhost:5173'
  })

  it('initializes not visible', () => {
    expect(quake.isVisible()).toBe(false)
  })

  it('registers global shortcut', () => {
    quake.register()
    expect(globalShortcut.register).toHaveBeenCalledWith('F12', expect.any(Function))
  })

  it('unregisters global shortcut', () => {
    quake.unregister()
    expect(globalShortcut.unregister).toHaveBeenCalledWith('F12')
  })

  it('destroys cleanly', () => {
    quake.destroy()
    expect(quake.isVisible()).toBe(false)
  })
})
