import { useCallback, useMemo, useEffect, useRef } from 'react'
import { ArrowLeftToLine } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'

interface DetachedTerminalProps {
  tabId: string
}

export function DetachedTerminal({ tabId }: DetachedTerminalProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const connectionId = params.get('connId') || null
  // The terminal/SSH session ID from the main window
  const sessionId = params.get('sessionId') || null

  const handleReattach = useCallback(async () => {
    try {
      // Transfer ownership back to main window (main will reclaim on reattach)
      await window.bifrost?.window?.reattachTab(tabId)
    } catch (err) {
      console.error('Reattach failed:', err)
    }
  }, [tabId])

  useEffect(() => {
    if (!containerRef.current || !window.bifrost?.terminal) return

    const terminal = new Terminal({
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 14,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: '#0d0d0f',
        foreground: '#e4e4e7',
        cursor: '#c7c4d7'
      }
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())
    terminal.open(containerRef.current)
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      terminal.loadAddon(webgl)
    } catch { /* fallback */ }
    fitAddon.fit()
    terminalRef.current = terminal

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(containerRef.current)

    const isSSH = sessionId?.startsWith('ssh:')
    const actualSessionId = isSSH ? sessionId.slice(4) : sessionId

    if (sessionId && actualSessionId) {
      // EXISTING session: claim ownership and replay buffer
      const claimId = isSSH ? actualSessionId : sessionId

      // Transfer ownership so data routes here
      window.bifrost.terminal.transferOwnership(claimId)

      // Replay buffered output
      window.bifrost.terminal.getBuffer(claimId).then((buf: string) => {
        if (buf) terminal.write(buf)
      })

      if (isSSH) {
        // Wire SSH I/O
        terminal.onData((data: string) => window.bifrost.ssh.write(actualSessionId, data))
        terminal.onResize(({ cols, rows }) => window.bifrost.ssh.resize(actualSessionId, cols, rows))
        const removeData = window.bifrost.ssh.onData((id: string, data: string) => {
          if (id === actualSessionId) terminal.write(data)
        })
        const removeClose = window.bifrost.ssh.onClose((id: string) => {
          if (id === actualSessionId) terminal.write('\r\n\x1b[90m[SSH connection closed]\x1b[0m\r\n')
        })
        return () => { resizeObserver.disconnect(); removeData(); removeClose(); terminal.dispose() }
      } else {
        // Wire local PTY I/O
        terminal.onData((data: string) => window.bifrost.terminal.write(sessionId, data))
        terminal.onResize(({ cols, rows }) => window.bifrost.terminal.resize(sessionId, cols, rows))
        const removeData = window.bifrost.terminal.onData((id: string, data: string) => {
          if (id === sessionId) terminal.write(data)
        })
        const removeExit = window.bifrost.terminal.onExit((id: string) => {
          if (id === sessionId) terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
        })
        return () => { resizeObserver.disconnect(); removeData(); removeExit(); terminal.dispose() }
      }
    } else if (connectionId) {
      // No existing session — create new SSH connection
      terminal.write('\x1b[33mConnecting...\x1b[0m\r\n')
      window.bifrost.ssh.connect(connectionId).then(async (sid: string) => {
        const { cols, rows } = terminal
        await window.bifrost.ssh.openShell(sid, cols, rows)
        terminal.onData((data: string) => window.bifrost.ssh.write(sid, data))
        terminal.onResize(({ cols, rows }) => window.bifrost.ssh.resize(sid, cols, rows))
      }).catch((err: Error) => {
        terminal.write(`\x1b[31mSSH failed: ${err.message}\x1b[0m\r\n`)
      })
      const removeData = window.bifrost.ssh.onData((_id: string, data: string) => terminal.write(data))
      const removeClose = window.bifrost.ssh.onClose(() => terminal.write('\r\n\x1b[90m[Closed]\x1b[0m\r\n'))
      return () => { resizeObserver.disconnect(); removeData(); removeClose(); terminal.dispose() }
    } else {
      // New local PTY
      const { cols, rows } = terminal
      window.bifrost.terminal.create(cols, rows).then((id: string) => {
        terminal.onData((data: string) => window.bifrost.terminal.write(id, data))
        terminal.onResize(({ cols, rows }) => window.bifrost.terminal.resize(id, cols, rows))
      })
      const removeData = window.bifrost.terminal.onData((_id: string, data: string) => terminal.write(data))
      return () => { resizeObserver.disconnect(); removeData(); terminal.dispose() }
    }
  }, [sessionId, connectionId])

  return (
    <div className="flex flex-col h-screen w-screen bg-[#131316]">
      <div className="flex items-center h-8 px-3 bg-[#1b1b1e] shrink-0 select-none">
        <span className="text-xs text-[#c7c4d7]/60 flex-1">
          Bifrost — {connectionId ? 'SSH' : 'Local'} Terminal (detached)
        </span>
        <button
          onClick={handleReattach}
          className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d] rounded transition-colors"
        >
          <ArrowLeftToLine size={12} />
          Re-attach
        </button>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 32px)' }} />
    </div>
  )
}
