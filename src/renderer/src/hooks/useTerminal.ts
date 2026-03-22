import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { usePreferencesStore } from '@renderer/stores/preferences.store'
import { useSessionsStore } from '@renderer/stores/sessions.store'
import { getSchemeByName, getDefaultScheme } from '@renderer/lib/color-schemes'
import { scanForErrors, type DetectedError } from '@renderer/lib/error-patterns'
import { detectZmodem, notifyZmodemDetected } from '@renderer/lib/zmodem-handler'

interface UseTerminalOptions {
  paneId: string
  connectionId?: string | null // null/undefined = local PTY, string = SSH connection
  onTerminalCreated?: (terminalId: string) => void
}

interface PasteRequest {
  text: string
  resolve: (confirmed: boolean) => void
}

interface UseTerminalReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  terminalIdRef: React.RefObject<string | null>
  fitToContainer: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  pendingPaste: PasteRequest | null
  confirmPaste: () => void
  cancelPaste: () => void
  dynamicTitle: string | null
  detectedErrors: DetectedError[]
}

const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 32

function getThemeColors(schemeName: string) {
  const scheme = getSchemeByName(schemeName) ?? getDefaultScheme()
  return scheme.colors
}

/**
 * Write data to a terminal by its ID, routing to SSH or local PTY as appropriate.
 */
function writeToTerminal(terminalId: string, data: string): void {
  if (!window.bifrost) return
  if (terminalId.startsWith('ssh:')) {
    const sshSessionId = terminalId.slice(4)
    window.bifrost.ssh.write(sshSessionId, data)
  } else {
    window.bifrost.terminal.write(terminalId, data)
  }
}

/**
 * Broadcast input data to sibling terminals based on the current broadcast mode.
 * Excludes the originating terminal to avoid echo.
 */
function broadcastInput(originTerminalId: string, data: string): void {
  const { broadcastMode } = useSessionsStore.getState()
  if (broadcastMode === 'off') return

  let targetIds: string[]
  if (broadcastMode === 'panes') {
    targetIds = useSessionsStore.getState().getActiveTabTerminalIds()
  } else {
    targetIds = useSessionsStore.getState().getAllTerminalIds()
  }

  for (const id of targetIds) {
    if (id !== originTerminalId) {
      writeToTerminal(id, data)
    }
  }
}

export function useTerminal({ paneId, connectionId, onTerminalCreated }: UseTerminalOptions): UseTerminalReturn {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalIdRef = useRef<string | null>(null)
  const currentFontSizeRef = useRef<number>(0)
  const fontFamily = usePreferencesStore((s) => s.terminal.fontFamily)
  const fontSize = usePreferencesStore((s) => s.terminal.fontSize)
  const cursorStyle = usePreferencesStore((s) => s.terminal.cursorStyle)
  const cursorBlink = usePreferencesStore((s) => s.terminal.cursorBlink)
  const scrollback = usePreferencesStore((s) => s.terminal.scrollback)
  const colorScheme = usePreferencesStore((s) => s.terminal.colorScheme)
  const fontLigatures = usePreferencesStore((s) => s.terminal.fontLigatures)

  const [pendingPaste, setPendingPaste] = useState<PasteRequest | null>(null)
  const detectedErrorsRef = useRef<DetectedError[]>([])
  const dynamicTitleRef = useRef<string | null>(null)
  const errorBufferRef = useRef('')
  const lastOutputTimeRef = useRef<number>(0)
  const outputActiveRef = useRef<boolean>(false)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fitToContainer = useCallback(() => {
    fitAddonRef.current?.fit()
  }, [])

  const zoomIn = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    const current = terminal.options.fontSize ?? fontSize
    if (current < MAX_FONT_SIZE) {
      const next = current + 1
      terminal.options.fontSize = next
      currentFontSizeRef.current = next
      fitAddonRef.current?.fit()
    }
  }, [fontSize])

  const zoomOut = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    const current = terminal.options.fontSize ?? fontSize
    if (current > MIN_FONT_SIZE) {
      const next = current - 1
      terminal.options.fontSize = next
      currentFontSizeRef.current = next
      fitAddonRef.current?.fit()
    }
  }, [fontSize])

  const resetZoom = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    terminal.options.fontSize = fontSize
    currentFontSizeRef.current = fontSize
    fitAddonRef.current?.fit()
  }, [fontSize])

  const confirmPaste = useCallback(() => {
    if (pendingPaste) {
      pendingPaste.resolve(true)
      setPendingPaste(null)
    }
  }, [pendingPaste])

  const cancelPaste = useCallback(() => {
    if (pendingPaste) {
      pendingPaste.resolve(false)
      setPendingPaste(null)
    }
  }, [pendingPaste])

  // Update theme when colorScheme preference changes
  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    const theme = getThemeColors(colorScheme)
    terminal.options.theme = theme
  }, [colorScheme])

  // Listen for zoom custom events dispatched from global keybindings
  useEffect(() => {
    const handleZoomIn = (): void => zoomIn()
    const handleZoomOut = (): void => zoomOut()
    const handleZoomReset = (): void => resetZoom()

    document.addEventListener('terminal:zoom-in', handleZoomIn)
    document.addEventListener('terminal:zoom-out', handleZoomOut)
    document.addEventListener('terminal:zoom-reset', handleZoomReset)

    return () => {
      document.removeEventListener('terminal:zoom-in', handleZoomIn)
      document.removeEventListener('terminal:zoom-out', handleZoomOut)
      document.removeEventListener('terminal:zoom-reset', handleZoomReset)
    }
  }, [zoomIn, zoomOut, resetZoom])

  useEffect(() => {
    if (!containerRef.current) return

    const theme = getThemeColors(colorScheme)
    currentFontSizeRef.current = fontSize

    const terminal = new Terminal({
      fontFamily: fontFamily,
      fontSize: fontSize,
      cursorStyle: cursorStyle,
      cursorBlink: cursorBlink,
      scrollback: scrollback,
      allowProposedApi: true,
      fontLigatures: fontLigatures,
      theme
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new SearchAddon())
    terminal.loadAddon(new WebLinksAddon())
    terminal.open(containerRef.current)

    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => webglAddon.dispose())
      terminal.loadAddon(webglAddon)
    } catch {
      // WebGL fallback to DOM renderer
    }

    fitAddon.fit()
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(containerRef.current)

    // ── Copy-on-select (#11) ──
    terminal.onSelectionChange(() => {
      const copyOnSelect = usePreferencesStore.getState().terminal.copyOnSelect
      if (!copyOnSelect) return
      const selection = terminal.getSelection()
      if (selection && selection.length > 0) {
        navigator.clipboard.writeText(selection)
      }
    })

    // ── Dynamic tab titles via OSC 0/2 (#8) ──
    terminal.onTitleChange((title: string) => {
      dynamicTitleRef.current = title
    })

    // ── Progress detection (#14) ──
    // Detect prompt reappearing after a period of output
    const IDLE_THRESHOLD = 3000
    let progressCheckTimer: ReturnType<typeof setInterval> | null = null

    progressCheckTimer = setInterval(() => {
      if (!outputActiveRef.current) return
      const now = Date.now()
      if (now - lastOutputTimeRef.current > IDLE_THRESHOLD && outputActiveRef.current) {
        outputActiveRef.current = false
        // Show desktop notification if window is not focused
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const sessStore = useSessionsStore.getState()
          const tab = sessStore.tabs.find((t) =>
            t.id === sessStore.activeTabId
          )
          const tabName = tab?.title ?? 'Terminal'
          new Notification('Process completed', {
            body: `Process completed in ${tabName}`,
            silent: false
          })
        }
      }
    }, 1000)

    progressTimerRef.current = progressCheckTimer

    // ── Intelligent Ctrl+C: copy selection or send ^C ──
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type === 'keydown' && event.ctrlKey && event.key === 'c') {
        const selection = terminal.getSelection()
        if (selection && selection.length > 0) {
          navigator.clipboard.writeText(selection)
          terminal.clearSelection()
          return false // prevent xterm from processing this key
        }
        // No selection: let xterm send ^C as normal
      }
      return true
    })

    // Guard: bifrost API only available inside Electron
    if (!window.bifrost?.terminal) {
      terminal.write('\x1b[33mBifrost terminal API not available.\x1b[0m\r\n')
      terminal.write('\x1b[90mRunning outside Electron — terminal IPC disabled.\x1b[0m\r\n')
      return () => {
        resizeObserver.disconnect()
        terminal.dispose()
      }
    }

    let removeDataListener: (() => void) | null = null
    let removeExitListener: (() => void) | null = null
    let sshSessionId: string | null = null
    let reconnectTimerId: ReturnType<typeof setTimeout> | null = null
    let userDisconnected = false

    /**
     * Prompt a paste warning if necessary.
     * Returns true if paste should proceed, false otherwise.
     */
    const shouldAllowPaste = (data: string): Promise<boolean> => {
      // Only intercept multiline pastes
      if (!data.includes('\n') && !data.includes('\r\n')) return Promise.resolve(true)

      // Check session-level dismissal
      const store = usePreferencesStore.getState()
      if (!store.terminal.pasteWarningEnabled) return Promise.resolve(true)
      if (store.pasteWarningDismissedForSession) return Promise.resolve(true)

      return new Promise<boolean>((resolve) => {
        setPendingPaste({ text: data, resolve })
      })
    }

    // ── Auto-reconnect helper for SSH ──
    const attemptReconnect = (connId: string): void => {
      const sessionsStore = useSessionsStore.getState()
      const attempt = sessionsStore.incrementReconnectAttempts(connId)
      const maxAttempts = sessionsStore.maxReconnectAttempts

      if (attempt > maxAttempts) {
        terminal.write(
          `\r\n\x1b[31mConnection lost after ${maxAttempts} attempts.\x1b[0m\r\n` +
          '\x1b[90mPress Enter to reconnect manually.\x1b[0m\r\n'
        )
        // Listen for Enter to retry
        const disposable = terminal.onData((d: string) => {
          if (d === '\r' || d === '\n') {
            disposable.dispose()
            sessionsStore.resetReconnectAttempts(connId)
            attemptReconnect(connId)
          }
        })
        return
      }

      // Exponential backoff: 3s, 6s, 12s, 24s, 48s, 60s (cap)
      const delay = Math.min(3000 * Math.pow(2, attempt - 1), 60000)
      terminal.write(
        `\r\n\x1b[33mReconnecting (attempt ${attempt}/${maxAttempts})...\x1b[0m `
      )
      terminal.write(`\x1b[90m[retry in ${Math.round(delay / 1000)}s]\x1b[0m\r\n`)

      reconnectTimerId = setTimeout(() => {
        if (userDisconnected) return

        window.bifrost.ssh
          .connect(connId)
          .then(async (sid: string) => {
            sshSessionId = sid
            terminalIdRef.current = `ssh:${sid}`
            onTerminalCreated?.(`ssh:${sid}`)
            useSessionsStore.getState().resetReconnectAttempts(connId)

            const { cols, rows } = terminal
            await window.bifrost.ssh.openShell(sid, cols, rows)

            terminal.write('\x1b[32mReconnected.\x1b[0m\r\n')

            terminal.onData(async (data: string) => {
              if (data.includes('\n') || data.includes('\r\n')) {
                const allowed = await shouldAllowPaste(data)
                if (!allowed) return
              }
              window.bifrost.ssh.write(sid, data)
              broadcastInput(`ssh:${sid}`, data)
            })

            terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
              window.bifrost.ssh.resize(sid, cols, rows)
            })
          })
          .catch(() => {
            attemptReconnect(connId)
          })
      }, delay)
    }

    if (connectionId) {
      // === SSH MODE ===
      terminal.write('\x1b[33mConnecting...\x1b[0m\r\n')

      window.bifrost.ssh
        .connect(connectionId)
        .then(async (sid: string) => {
          sshSessionId = sid
          terminalIdRef.current = `ssh:${sid}`
          onTerminalCreated?.(`ssh:${sid}`)

          const { cols, rows } = terminal
          await window.bifrost.ssh.openShell(sid, cols, rows)

          // Wire xterm input -> SSH (with paste interception + broadcast)
          terminal.onData(async (data: string) => {
            if (data.includes('\n') || data.includes('\r\n')) {
              const allowed = await shouldAllowPaste(data)
              if (!allowed) return
            }
            window.bifrost.ssh.write(sid, data)
            broadcastInput(`ssh:${sid}`, data)
          })

          // Wire xterm resize -> SSH
          terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
            window.bifrost.ssh.resize(sid, cols, rows)
          })
        })
        .catch((err: Error) => {
          terminal.write(`\x1b[31mSSH connection failed: ${err.message}\x1b[0m\r\n`)
        })

      // Wire SSH output -> xterm (with error detection #99, zmodem detection #15)
      removeDataListener = window.bifrost.ssh.onData((id: string, data: string) => {
        if (id === sshSessionId) {
          terminal.write(data)
          lastOutputTimeRef.current = Date.now()
          outputActiveRef.current = true
          // Zmodem detection (#15)
          if (detectZmodem(data)) {
            notifyZmodemDetected()
          }
          // Error detection (#99)
          errorBufferRef.current += data
          if (errorBufferRef.current.length > 4096) {
            errorBufferRef.current = errorBufferRef.current.slice(-2048)
          }
          const errors = scanForErrors(data)
          if (errors.length > 0) {
            detectedErrorsRef.current = [...detectedErrorsRef.current.slice(-9), ...errors]
          }
        }
      })

      removeExitListener = window.bifrost.ssh.onClose((id: string) => {
        if (id === sshSessionId) {
          terminal.write('\r\n\x1b[90m[SSH connection closed]\x1b[0m\r\n')
          sshSessionId = null

          // Auto-reconnect if enabled and not user-initiated
          if (!userDisconnected && connectionId) {
            const autoReconnect = usePreferencesStore.getState().terminal.autoReconnect
            if (autoReconnect) {
              attemptReconnect(connectionId)
            }
          }
        }
      })
    } else {
      // === LOCAL PTY MODE ===
      const { cols, rows } = terminal
      window.bifrost.terminal.create(cols, rows).then((id: string) => {
        terminalIdRef.current = id
        onTerminalCreated?.(id)

        // Wire xterm input -> PTY (with paste interception + broadcast)
        terminal.onData(async (data: string) => {
          if (data.includes('\n') || data.includes('\r\n')) {
            const allowed = await shouldAllowPaste(data)
            if (!allowed) return
          }
          window.bifrost.terminal.write(id, data)
          broadcastInput(id, data)
        })

        terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          window.bifrost.terminal.resize(id, cols, rows)
        })
      })

      removeDataListener = window.bifrost.terminal.onData((id: string, data: string) => {
        if (id === terminalIdRef.current) {
          terminal.write(data)
          lastOutputTimeRef.current = Date.now()
          outputActiveRef.current = true
          // Zmodem detection (#15)
          if (detectZmodem(data)) {
            notifyZmodemDetected()
          }
          // Error detection (#99)
          errorBufferRef.current += data
          if (errorBufferRef.current.length > 4096) {
            errorBufferRef.current = errorBufferRef.current.slice(-2048)
          }
          const errors = scanForErrors(data)
          if (errors.length > 0) {
            detectedErrorsRef.current = [...detectedErrorsRef.current.slice(-9), ...errors]
          }
        }
      })

      removeExitListener = window.bifrost.terminal.onExit((id: string, _exitCode: number) => {
        if (id === terminalIdRef.current) {
          terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
        }
      })
    }

    return () => {
      userDisconnected = true
      if (reconnectTimerId) clearTimeout(reconnectTimerId)
      if (progressCheckTimer) clearInterval(progressCheckTimer)
      resizeObserver.disconnect()
      removeDataListener?.()
      removeExitListener?.()
      if (connectionId && sshSessionId) {
        window.bifrost.ssh.disconnect(sshSessionId)
      } else if (terminalIdRef.current && !connectionId) {
        window.bifrost.terminal.destroy(terminalIdRef.current)
      }
      terminal.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId])

  return {
    containerRef,
    terminalIdRef,
    fitToContainer,
    zoomIn,
    zoomOut,
    resetZoom,
    pendingPaste,
    confirmPaste,
    cancelPaste,
    dynamicTitle: dynamicTitleRef.current,
    detectedErrors: detectedErrorsRef.current
  }
}
