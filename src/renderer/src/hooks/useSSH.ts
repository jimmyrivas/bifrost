import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { usePreferencesStore } from '@renderer/stores/preferences.store'

interface UseSSHOptions {
  connectionId: string
  paneId: string
  onConnected?: (sessionId: string) => void
  onDisconnected?: () => void
  onError?: (error: string) => void
}

interface UseSSHReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  sessionId: string | null
  connected: boolean
  connecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

export function useSSH({
  connectionId,
  paneId,
  onConnected,
  onDisconnected,
  onError
}: UseSSHOptions): UseSSHReturn {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const prefs = usePreferencesStore((s) => s.terminal)

  // Initialize terminal
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
        selectionBackground: '#3f3f4680'
      }
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())
    terminal.open(containerRef.current)

    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => webglAddon.dispose())
      terminal.loadAddon(webglAddon)
    } catch {
      // WebGL fallback
    }

    fitAddon.fit()
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      terminal.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId])

  const connect = useCallback(async () => {
    const terminal = terminalRef.current
    if (!terminal || connecting) return

    setConnecting(true)
    terminal.write('\x1b[33mConnecting...\x1b[0m\r\n')

    try {
      const sid = await window.bifrost.ssh.connect(connectionId)
      setSessionId(sid)

      const { cols, rows } = terminal
      await window.bifrost.ssh.openShell(sid, cols, rows)

      // Wire terminal input → SSH
      terminal.onData((data) => {
        window.bifrost.ssh.write(sid, data)
      })

      // Wire terminal resize → SSH
      terminal.onResize(({ cols, rows }) => {
        window.bifrost.ssh.resize(sid, cols, rows)
      })

      setConnected(true)
      setConnecting(false)
      onConnected?.(sid)
    } catch (err) {
      setConnecting(false)
      const msg = err instanceof Error ? err.message : String(err)
      terminal.write(`\x1b[31mConnection failed: ${msg}\x1b[0m\r\n`)
      onError?.(msg)
    }
  }, [connectionId, connecting, onConnected, onError])

  // Wire SSH data → terminal
  useEffect(() => {
    if (!sessionId) return

    const removeData = window.bifrost.ssh.onData((id, data) => {
      if (id === sessionId) {
        terminalRef.current?.write(data)
      }
    })

    const removeClose = window.bifrost.ssh.onClose((id) => {
      if (id === sessionId) {
        terminalRef.current?.write('\r\n\x1b[90m[SSH connection closed]\x1b[0m\r\n')
        setConnected(false)
        setSessionId(null)
        onDisconnected?.()
      }
    })

    return () => {
      removeData()
      removeClose()
    }
  }, [sessionId, onDisconnected])

  const disconnect = useCallback(() => {
    if (sessionId) {
      window.bifrost.ssh.disconnect(sessionId)
      setConnected(false)
      setSessionId(null)
    }
  }, [sessionId])

  return { containerRef, sessionId, connected, connecting, connect, disconnect }
}
