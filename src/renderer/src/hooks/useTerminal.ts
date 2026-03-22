import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { usePreferencesStore } from '@renderer/stores/preferences.store'

interface UseTerminalOptions {
  paneId: string
  onTerminalCreated?: (terminalId: string) => void
}

interface UseTerminalReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  terminalIdRef: React.RefObject<string | null>
  fitToContainer: () => void
}

export function useTerminal({ paneId, onTerminalCreated }: UseTerminalOptions): UseTerminalReturn {
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
      theme: {
        background: '#0d0d0f',        // surface_container_lowest
        foreground: '#e4e4e7',         // on_surface
        cursor: '#c7c4d7',            // on_surface_variant
        cursorAccent: '#0d0d0f',
        selectionBackground: '#39393c80', // surface_bright with opacity
        selectionForeground: '#ffffff',
        selectionInactiveBackground: '#2a2a2d60',
        black: '#1b1b1e',             // surface_container_low
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
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(searchAddon)
    terminal.loadAddon(webLinksAddon)

    terminal.open(containerRef.current)

    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
      })
      terminal.loadAddon(webglAddon)
    } catch {
      // WebGL not available, fall back to DOM renderer
    }

    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    resizeObserver.observe(containerRef.current)

    // Guard: bifrost API only available inside Electron (preload)
    if (!window.bifrost?.terminal) {
      terminal.write('\x1b[33mBifrost terminal API not available.\x1b[0m\r\n')
      terminal.write('\x1b[90mRunning outside Electron — terminal IPC disabled.\x1b[0m\r\n')
      return () => {
        resizeObserver.disconnect()
        terminal.dispose()
      }
    }

    // Create PTY in main process
    const { cols, rows } = terminal
    let removeDataListener: (() => void) | null = null
    let removeExitListener: (() => void) | null = null

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

    removeDataListener = window.bifrost.terminal.onData(
      (id: string, data: string) => {
        if (id === terminalIdRef.current) {
          terminal.write(data)
        }
      }
    )

    removeExitListener = window.bifrost.terminal.onExit(
      (id: string, _exitCode: number) => {
        if (id === terminalIdRef.current) {
          terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
        }
      }
    )

    return () => {
      resizeObserver.disconnect()
      removeDataListener?.()
      removeExitListener?.()
      if (terminalIdRef.current) {
        window.bifrost.terminal.destroy(terminalIdRef.current)
      }
      terminal.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId])

  return { containerRef, terminalIdRef, fitToContainer }
}
