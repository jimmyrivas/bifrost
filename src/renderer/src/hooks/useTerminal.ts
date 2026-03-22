import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { usePreferencesStore } from '@renderer/stores/preferences.store'

interface UseTerminalOptions {
  paneId: string
  connectionId?: string | null // null/undefined = local PTY, string = SSH connection
  onTerminalCreated?: (terminalId: string) => void
}

interface UseTerminalReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  terminalIdRef: React.RefObject<string | null>
  fitToContainer: () => void
}

const THEME = {
  background: '#0d0d0f',
  foreground: '#e4e4e7',
  cursor: '#c7c4d7',
  cursorAccent: '#0d0d0f',
  selectionBackground: '#39393c80',
  selectionForeground: '#ffffff',
  selectionInactiveBackground: '#2a2a2d60',
  black: '#1b1b1e',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#e4e4e7',
  brightBlack: '#71717a',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#fafafa'
}

export function useTerminal({ paneId, connectionId, onTerminalCreated }: UseTerminalOptions): UseTerminalReturn {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalIdRef = useRef<string | null>(null)
  const prefs = usePreferencesStore((s) => s.terminal)

  const fitToContainer = useCallback(() => {
    fitAddonRef.current?.fit()
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      fontFamily: prefs.fontFamily,
      fontSize: prefs.fontSize,
      cursorStyle: prefs.cursorStyle,
      cursorBlink: prefs.cursorBlink,
      scrollback: prefs.scrollback,
      allowProposedApi: true,
      theme: THEME
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

          // Wire xterm input → SSH
          terminal.onData((data: string) => {
            window.bifrost.ssh.write(sid, data)
          })

          // Wire xterm resize → SSH
          terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
            window.bifrost.ssh.resize(sid, cols, rows)
          })
        })
        .catch((err: Error) => {
          terminal.write(`\x1b[31mSSH connection failed: ${err.message}\x1b[0m\r\n`)
        })

      // Wire SSH output → xterm
      removeDataListener = window.bifrost.ssh.onData((id: string, data: string) => {
        if (id === sshSessionId) {
          terminal.write(data)
        }
      })

      removeExitListener = window.bifrost.ssh.onClose((id: string) => {
        if (id === sshSessionId) {
          terminal.write('\r\n\x1b[90m[SSH connection closed]\x1b[0m\r\n')
          sshSessionId = null
        }
      })
    } else {
      // === LOCAL PTY MODE ===
      const { cols, rows } = terminal
      window.bifrost.terminal.create(cols, rows).then((id: string) => {
        terminalIdRef.current = id
        onTerminalCreated?.(id)

        terminal.onData((data: string) => {
          window.bifrost.terminal.write(id, data)
        })

        terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          window.bifrost.terminal.resize(id, cols, rows)
        })
      })

      removeDataListener = window.bifrost.terminal.onData((id: string, data: string) => {
        if (id === terminalIdRef.current) {
          terminal.write(data)
        }
      })

      removeExitListener = window.bifrost.terminal.onExit((id: string, _exitCode: number) => {
        if (id === terminalIdRef.current) {
          terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
        }
      })
    }

    return () => {
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

  return { containerRef, terminalIdRef, fitToContainer }
}
