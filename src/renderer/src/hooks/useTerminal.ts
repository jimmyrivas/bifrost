import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { usePreferencesStore } from '@renderer/stores/preferences.store'
import { useSessionsStore, type TerminalStyle } from '@renderer/stores/sessions.store'
import { getSchemeByName, getDefaultScheme } from '@renderer/lib/color-schemes'
import { scanForErrors, type DetectedError } from '@renderer/lib/error-patterns'
import { redactSecrets } from '@renderer/lib/secret-redactor'
import { detectZmodem, notifyZmodemDetected } from '@renderer/lib/zmodem-handler'
import { findMarkdownPaths } from '@renderer/lib/markdown-link-matcher'
import { resolveRemotePath, parseCwdFromPrompt } from '@renderer/lib/markdown-path-resolver'
import {
  defaultMultiplexer,
  type MultiplexerConfig
} from '@renderer/components/connections/MultiplexerPanel'
import type {
  MultiplexerKind,
  MultiplexerPick,
  MultiplexerProbeResponse
} from '@renderer/components/terminal/MultiplexerPicker'

interface UseTerminalOptions {
  paneId: string
  tabId?: string
  connectionId?: string | null // null/undefined = local PTY, string = SSH connection
  terminalStyle?: TerminalStyle
  shell?: string // shell path override for local terminals (e.g. /usr/bin/pwsh)
  shellArgs?: string[] // extra args for the shell
  onTerminalCreated?: (terminalId: string) => void
}

interface PasteRequest {
  text: string
  resolve: (confirmed: boolean) => void
}

type MuxTransport =
  | { type: 'ssh'; sessionId: string }
  | { type: 'local' }

interface PendingMuxPick {
  hostLabel: string
  defaultPrefix: string
  probe: MultiplexerProbeResponse
  socketDir: string
  transport: MuxTransport
  resolve: (pick: MultiplexerPick) => void
}

function parseMultiplexerConfig(sshConfig?: string | null): MultiplexerConfig {
  if (!sshConfig) return { ...defaultMultiplexer }
  try {
    const cfg = JSON.parse(sshConfig)
    return { ...defaultMultiplexer, ...(cfg.multiplexer ?? {}) }
  } catch {
    return { ...defaultMultiplexer }
  }
}

function resolveDefaultPrefix(template: string, connectionName: string): string {
  const slug = connectionName.replace(/\s+/g, '-').toLowerCase()
  return template.replace('{conn}', slug || 'session')
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
  pendingMuxPick: PendingMuxPick | null
  resolveMuxPick: (pick: MultiplexerPick) => void
  dynamicTitle: string | null
  detectedErrors: DetectedError[]
  imagePasteStatus: string | null
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
  if (broadcastMode === 'off' || broadcastMode === 'hidden') return

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

export function useTerminal({ paneId, tabId, connectionId, terminalStyle, shell, shellArgs, onTerminalCreated }: UseTerminalOptions): UseTerminalReturn {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalIdRef = useRef<string | null>(null)
  const currentFontSizeRef = useRef<number>(0)
  // Host label for this connection, used by the Markdown viewer modal header.
  const hostLabelRef = useRef<string | null>(null)
  // Remote shell cwd captured via OSC 7 (preferred) — resolves relative .md
  // links. Null until the shell reports it (or never, if it doesn't emit OSC 7).
  const remoteCwdRef = useRef<string | null>(null)
  const globalFontFamily = usePreferencesStore((s) => s.terminal.fontFamily)
  const globalFontSize = usePreferencesStore((s) => s.terminal.fontSize)
  const globalCursorStyle = usePreferencesStore((s) => s.terminal.cursorStyle)
  const cursorBlink = usePreferencesStore((s) => s.terminal.cursorBlink)
  const scrollback = usePreferencesStore((s) => s.terminal.scrollback)
  const globalColorScheme = usePreferencesStore((s) => s.terminal.colorScheme)
  const fontLigatures = usePreferencesStore((s) => s.terminal.fontLigatures)

  // Per-tab overrides merge with global preferences
  const fontFamily = terminalStyle?.fontFamily || globalFontFamily
  const fontSize = terminalStyle?.fontSize || globalFontSize
  const cursorStyle = terminalStyle?.cursorStyle || globalCursorStyle
  const colorScheme = terminalStyle?.colorScheme || globalColorScheme

  const [pendingPaste, setPendingPaste] = useState<PasteRequest | null>(null)
  const [pendingMuxPick, setPendingMuxPick] = useState<PendingMuxPick | null>(null)
  const [imagePasteStatus, setImagePasteStatus] = useState<string | null>(null)
  const detectedErrorsRef = useRef<DetectedError[]>([])
  const dynamicTitleRef = useRef<string | null>(null)
  const errorBufferRef = useRef('')
  const lastOutputTimeRef = useRef<number>(0)
  const outputActiveRef = useRef<boolean>(false)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const aiDetectedRef = useRef(false)
  const aiScanBufferRef = useRef('')

  // AI tool detection patterns
  const AI_PATTERNS: Array<{ regex: RegExp; tool: string }> = [
    { regex: /claude>|╭─|Human:|Assistant:/i, tool: 'claude' },
    { regex: /\$ claude\b|claude chat/i, tool: 'claude' },
    { regex: /\$ sgpt\b|ShellGPT/i, tool: 'sgpt' },
    { regex: /\$ aichat\b/i, tool: 'aichat' },
    { regex: /\$ ollama run\b/i, tool: 'ollama' },
    { regex: />>> .*\noollama/i, tool: 'ollama' },
    { regex: /\$ gh copilot\b/i, tool: 'copilot' },
    { regex: /\$ aider\b|aider v\d/i, tool: 'aider' },
    { regex: /\$ interpreter\b|Open Interpreter/i, tool: 'interpreter' },
    { regex: /\$ llm\b|llm chat/i, tool: 'llm' },
    { regex: /\$ mods\b/i, tool: 'mods' },
    { regex: /\$ q chat\b|Amazon Q/i, tool: 'amazon-q' }
  ]

  // Scan terminal output for AI tool patterns
  // NOTE: cwd extraction is handled by XTerminal.tsx via clean OSC title sequences,
  // not from raw terminal data which contains ANSI escape codes.
  const scanForAi = useCallback((data: string) => {
    if (aiDetectedRef.current || !tabId) return
    aiScanBufferRef.current += data
    if (aiScanBufferRef.current.length > 8192) {
      aiScanBufferRef.current = aiScanBufferRef.current.slice(-4096)
    }
    for (const { regex, tool } of AI_PATTERNS) {
      if (regex.test(aiScanBufferRef.current)) {
        aiDetectedRef.current = true
        useSessionsStore.getState().setAiDetected(tabId, tool)
        break
      }
    }
  }, [tabId])

  const fitToContainer = useCallback(() => {
    fitAddonRef.current?.fit()
  }, [])

  const zoomIn = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    const current = terminal.options.fontSize ?? 14
    if (current < MAX_FONT_SIZE) {
      terminal.options.fontSize = current + 1
      currentFontSizeRef.current = current + 1
      fitAddonRef.current?.fit()
    }
  }, [])

  const zoomOut = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    const current = terminal.options.fontSize ?? 14
    if (current > MIN_FONT_SIZE) {
      terminal.options.fontSize = current - 1
      currentFontSizeRef.current = current - 1
      fitAddonRef.current?.fit()
    }
  }, [])

  const resetZoom = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    const defaultSize = usePreferencesStore.getState().terminal.fontSize
    terminal.options.fontSize = defaultSize
    currentFontSizeRef.current = defaultSize
    fitAddonRef.current?.fit()
  }, [])

  const confirmPaste = useCallback(() => {
    setPendingPaste((prev) => {
      if (prev) prev.resolve(true)
      return null
    })
  }, [])

  const cancelPaste = useCallback(() => {
    setPendingPaste((prev) => {
      if (prev) prev.resolve(false)
      return null
    })
  }, [])

  const resolveMuxPick = useCallback((pick: MultiplexerPick) => {
    setPendingMuxPick((prev) => {
      if (prev) prev.resolve(pick)
      return null
    })
  }, [])

  const resolveMultiplexerCmd = useCallback(
    async (
      transport: MuxTransport,
      cfg: MultiplexerConfig,
      hostLabel: string,
      connectionName: string
    ): Promise<string | undefined> => {
      if (cfg.preferred === 'none') return undefined

      let preferred: MultiplexerKind
      let fallback: MultiplexerKind | undefined
      if (cfg.preferred === 'auto') {
        preferred = 'dtach'
        fallback = 'tmux'
      } else {
        preferred = cfg.preferred
        // Honor whatever fallback the user picked, as long as it's a real kind
        // and isn't the same as the primary.
        if (cfg.fallback !== 'none' && cfg.fallback !== preferred) {
          fallback = cfg.fallback
        }
      }

      const probe = await window.bifrost.multiplexer.probe(transport, {
        preferred,
        fallback,
        socketDir: cfg.socketDir
      })

      if (!probe.primary.installed && !probe.fallback?.installed) {
        // Neither installed: notify user via xterm and proceed plain.
        const installHint =
          preferred === 'dtach'
            ? 'sudo apt install dtach   (or dnf/yum/pacman equivalent)'
            : preferred === 'zellij'
              ? 'cargo install --locked zellij   (or your distro package)'
              : preferred === 'rmux'
                ? 'cargo install rmux --locked   (or curl -fsSL https://rmux.io/install.sh | sh)'
                : 'sudo apt install tmux    (or dnf/yum/pacman equivalent)'
        terminalRef.current?.write(
          `\r\n\x1b[33mMultiplexer ${preferred} not installed on ${hostLabel}.\x1b[0m\r\n` +
          `\x1b[90mTo enable session persistence: ${installHint}\x1b[0m\r\n`
        )
        return undefined
      }

      // Auto-attach: only when primary installed, exactly 1 live session, no fallback sessions.
      if (cfg.autoAttachSingle && !cfg.alwaysAsk && probe.primary.installed) {
        const primaryLive = probe.primary.sessions.filter((s) => s.alive)
        const fallbackLive =
          probe.fallback?.sessions.filter((s) => s.alive).length ?? 0
        if (primaryLive.length === 1 && fallbackLive === 0) {
          return window.bifrost.multiplexer.buildAttachCmd(
            probe.primary.kind,
            primaryLive[0].target,
            {
              createIfMissing: false,
              binaryPath: probe.primary.path,
              disableMouseCapture: cfg.disableMouseCapture
            }
          )
        }
      }

      const defaultPrefix = resolveDefaultPrefix(cfg.sessionPrefix, connectionName)
      const pick = await new Promise<MultiplexerPick>((resolve) => {
        setPendingMuxPick({
          hostLabel,
          defaultPrefix,
          probe,
          socketDir: cfg.socketDir,
          transport,
          resolve
        })
      })

      if (pick.type === 'skip') return undefined

      // Resolve the absolute binary path from the matching probe result so the
      // attach command works even when the remote shell's PATH is minimal.
      const binaryPath = pick.kind === probe.primary.kind
        ? probe.primary.path
        : probe.fallback?.kind === pick.kind
          ? probe.fallback.path
          : undefined

      if (pick.type === 'attach') {
        return window.bifrost.multiplexer.buildAttachCmd(pick.kind, pick.target, {
          createIfMissing: false,
          forceRunCommands: pick.forceRunCommands,
          binaryPath,
          disableMouseCapture: cfg.disableMouseCapture
        })
      }

      // create
      let target = pick.name
      if (pick.kind === 'dtach') {
        // Expand ~ → $HOME so the remote shell expands it inside double quotes.
        let dir = (cfg.socketDir || '~/.dtach').replace(/\/$/, '')
        if (dir === '~') dir = '$HOME'
        else if (dir.startsWith('~/')) dir = '$HOME/' + dir.slice(2)
        target = `${dir}/${pick.name}.sock`
      }
      return window.bifrost.multiplexer.buildAttachCmd(pick.kind, target, {
        createIfMissing: true,
        binaryPath,
        disableMouseCapture: cfg.disableMouseCapture
      })
    },
    []
  )

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

    // Returns true if the clipboard held an image and it was handled (uploaded
    // to the remote host, or attempted). When true, the caller must NOT fall
    // through to text paste. SSH tabs only — local PTYs have no remote target.
    const tryImagePaste = async (myTermId: string): Promise<boolean> => {
      if (!myTermId.startsWith('ssh:')) {
        console.debug('[image-paste] skip: terminal is not SSH', myTermId)
        return false
      }
      let hasImage = false
      try {
        hasImage = await window.bifrost.clipboard.hasImage()
      } catch (err) {
        console.warn('[image-paste] clipboard.hasImage threw', err)
        return false
      }
      if (!hasImage) {
        console.debug('[image-paste] skip: no image on clipboard')
        return false
      }

      const sid = myTermId.slice(4)
      const prefs = usePreferencesStore.getState().terminal
      console.debug('[image-paste] uploading via SSH session', sid, 'dir=', prefs.imagePasteDir)
      setImagePasteStatus('Uploading image…')
      try {
        const remotePath = await window.bifrost.clipboard.pasteImageToRemote(
          sid,
          prefs.imagePasteDir,
          prefs.imagePasteDeleteOnClose
        )
        if (!remotePath) {
          console.warn('[image-paste] backend returned null path (no image?)')
          setImagePasteStatus(null)
          return false
        }
        window.bifrost.ssh.write(sid, remotePath)
        setImagePasteStatus(`Uploaded: ${remotePath}`)
        setTimeout(() => setImagePasteStatus(null), 4000)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[image-paste] upload failed', err)
        setImagePasteStatus(`Image upload failed: ${msg}`)
        setTimeout(() => setImagePasteStatus(null), 8000)
      }
      return true
    }

    const isActiveTerminal = (): string | null => {
      const { activeTabId, tabs } = useSessionsStore.getState()
      const activeTab = tabs.find((t) => t.id === activeTabId)
      const activeTermId = activeTab?.rootPane?.terminalId
      const myTermId = terminalIdRef.current
      if (!myTermId || myTermId !== activeTermId) return null
      return myTermId
    }

    const handlePaste = (): void => {
      const myTermId = isActiveTerminal()
      if (!myTermId) return

      const pasteText = (): void => {
        navigator.clipboard.readText().then((text) => {
          if (!text) return
          if (myTermId.startsWith('ssh:')) {
            window.bifrost?.ssh?.write(myTermId.slice(4), text)
          } else {
            window.bifrost?.terminal?.write(myTermId, text)
          }
        }).catch(() => { /* clipboard denied */ })
      }

      // When auto image-paste is enabled, an image on the clipboard is uploaded
      // instead of pasting text. Otherwise paste text as usual.
      if (usePreferencesStore.getState().terminal.imagePasteEnabled) {
        tryImagePaste(myTermId).then((handled) => {
          if (!handled) pasteText()
        })
      } else {
        pasteText()
      }
    }

    // Dedicated "paste image to server" gesture (Ctrl+Shift+I / context menu).
    // Always attempts an image upload regardless of the auto-paste toggle.
    const handlePasteImage = (): void => {
      const myTermId = isActiveTerminal()
      if (!myTermId) {
        console.warn('[image-paste] no active terminal for this hook instance')
        return
      }
      if (!myTermId.startsWith('ssh:')) {
        const kind = myTermId.startsWith('mosh:') ? 'Mosh' : 'this protocol'
        setImagePasteStatus(`Image paste not supported for ${kind} sessions (SSH only)`)
        setTimeout(() => setImagePasteStatus(null), 4000)
        return
      }
      tryImagePaste(myTermId).then((handled) => {
        if (!handled) {
          setImagePasteStatus('No image in clipboard')
          setTimeout(() => setImagePasteStatus(null), 3000)
        }
      })
    }

    document.addEventListener('terminal:zoom-in', handleZoomIn)
    document.addEventListener('terminal:zoom-out', handleZoomOut)
    document.addEventListener('terminal:zoom-reset', handleZoomReset)
    document.addEventListener('terminal:paste', handlePaste)
    document.addEventListener('terminal:paste-image', handlePasteImage)

    return () => {
      document.removeEventListener('terminal:zoom-in', handleZoomIn)
      document.removeEventListener('terminal:zoom-out', handleZoomOut)
      document.removeEventListener('terminal:zoom-reset', handleZoomReset)
      document.removeEventListener('terminal:paste', handlePaste)
      document.removeEventListener('terminal:paste-image', handlePasteImage)
    }
  }, [zoomIn, zoomOut, resetZoom])

  useEffect(() => {
    if (!containerRef.current) return

    const theme = getThemeColors(colorScheme)
    // Apply per-connection background tint if set
    if (terminalStyle?.backgroundColor) {
      theme.background = terminalStyle.backgroundColor
    }
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

    // ── Remote cwd capture via OSC 7 ──
    // Shells that emit OSC 7 report `file://host/abs/path` on every prompt.
    // We cache the path so relative .md links can be resolved. Returning false
    // lets any other OSC 7 consumer still see the sequence.
    const osc7Disposable = terminal.parser.registerOscHandler(7, (payload: string) => {
      try {
        const m = payload.match(/^file:\/\/[^/]*(\/.*)$/)
        if (m && m[1]) remoteCwdRef.current = decodeURIComponent(m[1])
      } catch {
        /* malformed OSC 7 — ignore */
      }
      return false
    })

    // Best-effort cwd from the prompt for shells without OSC 7. Returns the cwd
    // (absolute or ~) using OSC 7 if present, else parsing the latest prompt.
    const currentRemoteCwd = (): string | null => {
      if (remoteCwdRef.current) return remoteCwdRef.current
      try {
        const buf = terminal.buffer.active
        const start = Math.max(0, buf.length - 4)
        let tail = ''
        for (let y = start; y < buf.length; y++) {
          tail += (buf.getLine(y)?.translateToString(true) ?? '') + '\n'
        }
        return parseCwdFromPrompt(tail)
      } catch {
        return null
      }
    }

    // ── Markdown file links ──
    // Turn `.md` paths in SSH output into links that open Bifrost's internal
    // Markdown viewer. Only active on SSH tabs (remote paths need an SSH/SFTP
    // session); resolves through JumpHost transparently. Relative paths are
    // resolved against the remote cwd and dropped when the cwd is unknown.
    const markdownLinkDisposable = terminal.registerLinkProvider({
      provideLinks(bufferLineNumber, callback) {
        const prefs = usePreferencesStore.getState().terminal
        const termId = terminalIdRef.current
        if (!prefs.markdownLinksEnabled || !termId || !termId.startsWith('ssh:')) {
          callback(undefined)
          return
        }
        const bufLine = terminal.buffer.active.getLine(bufferLineNumber - 1)
        if (!bufLine) {
          callback(undefined)
          return
        }
        const text = bufLine.translateToString(true)
        const found = findMarkdownPaths(text, { includeRelative: true })
        if (found.length === 0) {
          callback(undefined)
          return
        }
        const sessionId = termId.slice(4)
        const cwd = found.some((f) => f.relative) ? currentRemoteCwd() : null
        const links = found
          .map((match) => {
            const resolved = resolveRemotePath(match.path, cwd)
            if (!resolved) return null // relative path with unknown cwd — skip
            return {
              text: match.path,
              // xterm ranges are 1-based; end.x is the inclusive last cell.
              range: {
                start: { x: match.start + 1, y: bufferLineNumber },
                end: { x: match.end, y: bufferLineNumber }
              },
              activate: (event: MouseEvent) => {
                const requireCtrl =
                  usePreferencesStore.getState().terminal.markdownLinkActivation === 'ctrl-click'
                if (requireCtrl && !(event.ctrlKey || event.metaKey)) return
                document.dispatchEvent(
                  new CustomEvent('markdown:open', {
                    detail: { sessionId, path: resolved, host: hostLabelRef.current }
                  })
                )
              }
            }
          })
          .filter((l): l is NonNullable<typeof l> => l !== null)
        callback(links.length > 0 ? links : undefined)
      }
    })

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

    // ── OSC 52: clipboard set from inside the PTY ──
    // xterm.js v6 doesn't auto-write OSC 52 to the system clipboard. Without
    // this handler, copy keybindings inside zellij/tmux/vim/fzf appear to do
    // nothing. Format: `\e]52;<selection>;<base64-data>\a` where <selection>
    // is the PRIMARY/CLIPBOARD/cut-buffer indicator (we accept any).
    terminal.parser.registerOscHandler(52, (data: string) => {
      const semi = data.indexOf(';')
      if (semi < 0) return false
      const payload = data.slice(semi + 1)
      // `?` is a query for the current clipboard — we don't expose it.
      if (payload === '?' || payload.length === 0) return true
      try {
        const decoded = atob(payload)
        navigator.clipboard.writeText(decoded).catch(() => { /* permission denied */ })
        return true
      } catch {
        return false
      }
    })

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(containerRef.current)

    // ── Copy-on-select (#11) + expose selection to context menu ──
    terminal.onSelectionChange(() => {
      const selection = terminal.getSelection()
      // Store selection on the pane element so context menu can access it
      const paneEl = containerRef.current?.closest('[data-pane-id]') ?? containerRef.current
      if (paneEl) {
        (paneEl as HTMLElement).dataset.terminalSelection = selection ?? ''
      }
      const copyOnSelect = usePreferencesStore.getState().terminal.copyOnSelect
      if (!copyOnSelect) return
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

            const conn = await window.bifrost.connections.get(connId).catch(() => null)
            const muxCmd = conn?.method === 'mosh'
              ? undefined
              : await resolveMultiplexerCmd(
                  { type: 'ssh', sessionId: sid },
                  parseMultiplexerConfig(conn?.sshConfig),
                  conn?.host || conn?.name || 'host',
                  conn?.name || 'session'
                )

            const { cols, rows } = terminal
            await window.bifrost.ssh.openShell(sid, cols, rows, connectionId, muxCmd)

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
      // Detect protocol method for this connection
      const initConnection = async (): Promise<void> => {
        const conn = await window.bifrost.connections.get(connectionId).catch(() => null)
        const method = conn?.method ?? 'ssh'
        const muxConfig = parseMultiplexerConfig(conn?.sshConfig)
        const hostLabel = conn?.host || conn?.name || 'host'
        const connectionName = conn?.name || 'session'
        hostLabelRef.current = hostLabel

        if (method === 'mosh') {
          // === MOSH MODE ===
          terminal.write('\x1b[33mConnecting via Mosh...\x1b[0m\r\n')
          try {
            const conn = await window.bifrost.connections.get(connectionId)
            const host = conn?.host ?? 'localhost'
            const user = conn?.username ?? undefined
            const port = conn?.port ?? undefined
            const moshSessionId = await window.bifrost.protocols.connectMosh(
              host,
              user,
              port,
              undefined,
              connectionId
            )
            terminalIdRef.current = `mosh:${moshSessionId}`
            onTerminalCreated?.(`mosh:${moshSessionId}`)

            terminal.onData(async (data: string) => {
              if (data.includes('\n') || data.includes('\r\n')) {
                const allowed = await shouldAllowPaste(data)
                if (!allowed) return
              }
              window.bifrost.protocols.writePty(moshSessionId, data)
              broadcastInput(`mosh:${moshSessionId}`, data)
            })

            terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
              window.bifrost.protocols.resizePty(moshSessionId, cols, rows)
            })

            removeDataListener = window.bifrost.protocols.onData((id: string, data: string) => {
              if (id === moshSessionId) {
                terminal.write(redactSecrets(data))
                lastOutputTimeRef.current = Date.now()
                outputActiveRef.current = true
                errorBufferRef.current += data
                if (errorBufferRef.current.length > 4096) {
                  errorBufferRef.current = errorBufferRef.current.slice(-2048)
                }
                const errors = scanForErrors(data)
                if (errors.length > 0) {
                  detectedErrorsRef.current = [...detectedErrorsRef.current.slice(-9), ...errors]
                }
                scanForAi(data)
              }
            })

            removeExitListener = window.bifrost.protocols.onClose((id: string) => {
              if (id === moshSessionId) {
                terminal.write('\r\n\x1b[90m[Mosh session ended]\x1b[0m\r\n')
              }
            })
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            terminal.write(`\x1b[31mMosh connection failed: ${msg}\x1b[0m\r\n`)
            terminal.write('\x1b[90mEnsure mosh is installed: sudo apt install mosh\x1b[0m\r\n')
          }
        } else {
          // === SSH MODE ===
          terminal.write('\x1b[33mConnecting...\x1b[0m\r\n')

          window.bifrost.ssh
            .connect(connectionId)
            .then(async (sid: string) => {
              sshSessionId = sid
              terminalIdRef.current = `ssh:${sid}`
              onTerminalCreated?.(`ssh:${sid}`)

              const muxCmd = await resolveMultiplexerCmd(
                { type: 'ssh', sessionId: sid },
                muxConfig,
                hostLabel,
                connectionName
              )

              const { cols, rows } = terminal
              await window.bifrost.ssh.openShell(sid, cols, rows, connectionId, muxCmd)

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
            .catch((err: Error) => {
              terminal.write(`\x1b[31mSSH connection failed: ${err.message}\x1b[0m\r\n`)
            })

          removeDataListener = window.bifrost.ssh.onData((id: string, data: string) => {
            if (id === sshSessionId) {
              terminal.write(redactSecrets(data))
              lastOutputTimeRef.current = Date.now()
              outputActiveRef.current = true
              if (detectZmodem(data)) {
                notifyZmodemDetected()
              }
              errorBufferRef.current += data
              if (errorBufferRef.current.length > 4096) {
                errorBufferRef.current = errorBufferRef.current.slice(-2048)
              }
              const errors = scanForErrors(data)
              if (errors.length > 0) {
                detectedErrorsRef.current = [...detectedErrorsRef.current.slice(-9), ...errors]
              }
              scanForAi(data)
            }
          })

          removeExitListener = window.bifrost.ssh.onClose((id: string) => {
            if (id === sshSessionId) {
              terminal.write('\r\n\x1b[90m[SSH connection closed]\x1b[0m\r\n')
              const closedSessionId = sshSessionId
              sshSessionId = null

              // Auto-close tab after delay (unless auto-reconnect kicks in)
              setTimeout(() => {
                // Only close if still disconnected (auto-reconnect may have reconnected)
                if (sshSessionId === null) {
                  const { tabs } = useSessionsStore.getState()
                  const tab = tabs.find((t) => t.rootPane?.terminalId === `ssh:${closedSessionId}`)
                  if (tab) useSessionsStore.getState().closeTab(tab.id)
                }
              }, 2000)

              if (!userDisconnected && connectionId) {
                const autoReconnect = usePreferencesStore.getState().terminal.autoReconnect
                if (autoReconnect) {
                  attemptReconnect(connectionId)
                }
              }
            }
          })
        }
      }

      initConnection()
    } else {
      // === LOCAL PTY MODE ===
      const initLocal = async (): Promise<void> => {
        const muxConfig = usePreferencesStore.getState().localMultiplexer
        const muxCmd = await resolveMultiplexerCmd(
          { type: 'local' },
          muxConfig,
          'local',
          'local'
        )

        const { cols, rows } = terminal
        const id = await window.bifrost.terminal.create(cols, rows, shell, shellArgs, muxCmd)
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
      }
      initLocal().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        terminal.write(`\x1b[31mLocal terminal failed: ${msg}\x1b[0m\r\n`)
      })

      removeDataListener = window.bifrost.terminal.onData((id: string, data: string) => {
        if (id === terminalIdRef.current) {
          terminal.write(redactSecrets(data))
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
          scanForAi(data)
        }
      })

      removeExitListener = window.bifrost.terminal.onExit((id: string, exitCode: number) => {
        if (id === terminalIdRef.current) {
          terminal.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
          // Auto-close tab after brief delay so user sees the exit message
          setTimeout(() => {
            const { tabs } = useSessionsStore.getState()
            const tab = tabs.find((t) => t.rootPane?.terminalId === id)
            if (tab) useSessionsStore.getState().closeTab(tab.id)
          }, 1500)
        }
      })
    }

    return () => {
      userDisconnected = true
      if (reconnectTimerId) clearTimeout(reconnectTimerId)
      if (progressCheckTimer) clearInterval(progressCheckTimer)
      resizeObserver.disconnect()
      markdownLinkDisposable.dispose()
      osc7Disposable.dispose()
      removeDataListener?.()
      removeExitListener?.()
      // Don't kill PTY/SSH if this tab is being detached (session transferred)
      const detaching = useSessionsStore.getState()._detachingTabs.has(paneId) ||
        Array.from(useSessionsStore.getState()._detachingTabs).length > 0
      if (!detaching) {
        if (connectionId && sshSessionId) {
          window.bifrost.ssh.disconnect(sshSessionId)
        } else if (terminalIdRef.current && !connectionId) {
          window.bifrost.terminal.destroy(terminalIdRef.current)
        }
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
    pendingMuxPick,
    resolveMuxPick,
    dynamicTitle: dynamicTitleRef.current,
    detectedErrors: detectedErrorsRef.current,
    imagePasteStatus
  }
}
