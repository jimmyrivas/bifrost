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
        background: '#0a0a0b',
        foreground: '#e4e4e7',
        cursor: '#a1a1aa',
        selectionBackground: '#3f3f4680',
        black: '#18181b',
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

    // Create PTY in main process
    const { cols, rows } = terminal
    window.bifrost.terminal.create(cols, rows).then((id: string) => {
      terminalIdRef.current = id
      onTerminalCreated?.(id)

      // Wire terminal input → PTY
      terminal.onData((data: string) => {
        window.bifrost.terminal.write(id, data)
      })

      // Wire terminal resize → PTY
      terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        window.bifrost.terminal.resize(id, cols, rows)
      })
    })

    // Wire PTY output → terminal
    const removeDataListener = window.bifrost.terminal.onData(
      (id: string, data: string) => {
        if (id === terminalIdRef.current) {
          terminal.write(data)
        }
      }
    )

    const removeExitListener = window.bifrost.terminal.onExit(
      (id: string, _exitCode: number) => {
        if (id === terminalIdRef.current) {
          terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
        }
      }
    )

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      removeDataListener()
      removeExitListener()
      if (terminalIdRef.current) {
        window.bifrost.terminal.destroy(terminalIdRef.current)
      }
      terminal.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId])

  return { containerRef, terminalIdRef, fitToContainer }
}
