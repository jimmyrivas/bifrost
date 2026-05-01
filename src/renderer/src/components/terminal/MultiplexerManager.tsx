import { useState, useCallback, useEffect } from 'react'
import { Layers, RefreshCw, Plus, Power, Trash2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type {
  MultiplexerKind,
  MultiplexerProbeResponse,
  MultiplexerProbeResult
} from './MultiplexerPicker'
import { defaultMultiplexer } from '@renderer/components/connections/MultiplexerPanel'

interface MultiplexerManagerProps {
  /** Active terminal id, e.g. "ssh:ssh-3" or "terminal-1". null = nothing to manage. */
  terminalId: string | null
  /** Connection id, when present we can read multiplexer config (socketDir, prefix, …). */
  connectionId?: string | null
  /** Send a command to the active terminal (used for attach to share the shell). */
  onSendCommand: (command: string) => void
}

type Transport =
  | { type: 'ssh'; sessionId: string }
  | { type: 'local' }

function transportFromTerminalId(termId: string | null): Transport | null {
  if (!termId) return null
  if (termId.startsWith('ssh:')) {
    return { type: 'ssh', sessionId: termId.slice(4) }
  }
  if (termId.startsWith('terminal-')) {
    return { type: 'local' }
  }
  return null
}

export function MultiplexerManager({
  terminalId,
  connectionId,
  onSendCommand
}: MultiplexerManagerProps): JSX.Element {
  const [probe, setProbe] = useState<MultiplexerProbeResponse | null>(null)
  const [active, setActive] = useState<MultiplexerKind>('tmux')
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [config, setConfig] = useState(defaultMultiplexer)
  const [error, setError] = useState<string | null>(null)

  const transport = transportFromTerminalId(terminalId)

  useEffect(() => {
    if (!connectionId) return
    window.bifrost.connections.get(connectionId).then((conn) => {
      try {
        const cfg = conn?.sshConfig ? JSON.parse(conn.sshConfig) : {}
        const next = { ...defaultMultiplexer, ...(cfg.multiplexer ?? {}) }
        setConfig(next)
        // Bias initial active to user's preference
        if (next.preferred === 'dtach' || next.preferred === 'auto') setActive('dtach')
        else if (next.preferred === 'tmux') setActive('tmux')
      } catch {
        /* keep default */
      }
    })
  }, [connectionId])

  const refresh = useCallback(async () => {
    if (!transport) return
    setBusy(true)
    setError(null)
    try {
      // Probe all three tools so the user can switch between them.
      const [tmuxR, dtachR, zellijR] = await Promise.all([
        window.bifrost.multiplexer.probe(transport, {
          preferred: 'tmux',
          socketDir: config.socketDir
        }),
        window.bifrost.multiplexer.probe(transport, {
          preferred: 'dtach',
          socketDir: config.socketDir
        }),
        window.bifrost.multiplexer.probe(transport, {
          preferred: 'zellij',
          socketDir: config.socketDir
        })
      ])
      // Stash all three results in a single "extended" probe shape (panel-internal).
      setProbe({
        primary: tmuxR.primary,
        fallback: dtachR.primary,
        zellij: zellijR.primary
      } as MultiplexerProbeResponse & { zellij?: MultiplexerProbeResult })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [transport, config.socketDir])

  useEffect(() => {
    if (terminalId) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId])

  const activeProbe: MultiplexerProbeResult | undefined = (() => {
    if (!probe) return undefined
    if (probe.primary.kind === active) return probe.primary
    if (probe.fallback?.kind === active) return probe.fallback
    const ext = probe as MultiplexerProbeResponse & { zellij?: MultiplexerProbeResult }
    if (ext.zellij?.kind === active) return ext.zellij
    return undefined
  })()

  const handleAttach = async (target: string): Promise<void> => {
    const cmd = await window.bifrost.multiplexer.buildAttachCmd(active, target, {
      createIfMissing: false,
      binaryPath: activeProbe?.path
    })
    onSendCommand(cmd)
  }

  const handleCreate = async (): Promise<void> => {
    const name = newName.trim() || `bifrost-${Date.now().toString(36)}`
    let target = name
    if (active === 'dtach') {
      let dir = (config.socketDir || '~/.dtach').replace(/\/$/, '')
      if (dir === '~') dir = '$HOME'
      else if (dir.startsWith('~/')) dir = '$HOME/' + dir.slice(2)
      target = `${dir}/${name}.sock`
    }
    const cmd = await window.bifrost.multiplexer.buildAttachCmd(active, target, {
      createIfMissing: true,
      binaryPath: activeProbe?.path
    })
    onSendCommand(cmd)
    setNewName('')
  }

  const handleKill = async (target: string): Promise<void> => {
    if (!transport) return
    setBusy(true)
    try {
      await window.bifrost.multiplexer.killSession(transport, active, target)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleCleanInactive = async (): Promise<void> => {
    if (!transport) return
    setBusy(true)
    try {
      await window.bifrost.multiplexer.cleanStale(transport, active, config.socketDir)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!transport) {
    return (
      <div className="text-xs text-[var(--on-surface-variant)] text-center py-4">
        Open a terminal to manage multiplexer sessions.
      </div>
    )
  }

  const liveSessions = activeProbe?.sessions.filter((s) => s.alive) ?? []
  const staleSessions = activeProbe?.sessions.filter((s) => !s.alive) ?? []

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[#6bd5ff]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
            Sessions
          </span>
        </div>
        <button
          onClick={refresh}
          disabled={busy}
          className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50 disabled:opacity-40"
          aria-label="Refresh sessions"
        >
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Kind tabs */}
      <div className="flex gap-1">
        {(['tmux', 'dtach', 'zellij'] as const).map((kind) => {
          const ext = probe as (MultiplexerProbeResponse & { zellij?: MultiplexerProbeResult }) | null
          const r = probe?.primary.kind === kind ? probe.primary
                  : probe?.fallback?.kind === kind ? probe.fallback
                  : ext?.zellij?.kind === kind ? ext.zellij
                  : undefined
          return (
            <button
              key={kind}
              onClick={() => setActive(kind)}
              className={cn(
                'flex-1 h-7 rounded-[var(--radius)] text-[9px] font-semibold uppercase tracking-wider transition-colors',
                active === kind
                  ? 'bg-[#6bd5ff] text-[#0a0a0c]'
                  : 'bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
              )}
            >
              {kind}
              {r && (
                <span className="ml-1 opacity-70">
                  {r.installed ? `(${r.sessions.length})` : '(-)'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!activeProbe?.installed && (
        <div className="text-[10px] text-[var(--on-surface-variant)] text-center py-2">
          {active} is not installed on this host.
        </div>
      )}

      {activeProbe?.installed && liveSessions.length === 0 && staleSessions.length === 0 && (
        <div className="text-[10px] text-[var(--on-surface-variant)] text-center py-2">
          No active {active} sessions.
        </div>
      )}

      {liveSessions.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {liveSessions.map((s) => (
            <div
              key={s.target}
              className="flex items-center gap-2 px-2 py-1 rounded-[var(--radius)] hover:bg-[var(--surface-container-highest)]/50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success,#34d399)] shrink-0" />
              <button
                onClick={() => handleAttach(s.target)}
                disabled={busy}
                className="flex-1 text-left text-xs font-[family-name:var(--font-mono)] text-[var(--on-surface)] truncate"
              >
                {s.name}
              </button>
              {s.attached && (
                <span className="text-[9px] text-[#facc15] shrink-0">attached</span>
              )}
              <button
                onClick={() => handleKill(s.target)}
                disabled={busy}
                className="p-0.5 text-[var(--on-surface-variant)] hover:text-[var(--error,#f87171)] disabled:opacity-40"
                aria-label={`Kill ${s.name}`}
                title="Kill session"
              >
                <Power size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {(active === 'dtach' || active === 'zellij') && staleSessions.length > 0 && (
        <div className="flex items-center justify-between text-[10px] text-[var(--on-surface-variant)] px-1">
          <span>{staleSessions.length} inactive</span>
          <button
            onClick={handleCleanInactive}
            disabled={busy}
            className="flex items-center gap-1 hover:text-[var(--error,#f87171)] disabled:opacity-40"
          >
            <Trash2 size={10} />
            Clean inactive
          </button>
        </div>
      )}

      {/* Create new */}
      {activeProbe?.installed && (
        <div className="flex gap-1.5 pt-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
            placeholder="Session name"
            className={cn(
              'flex-1 bg-[var(--surface-container-highest)] rounded-[var(--radius)] px-2 py-1',
              'text-xs text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/50 outline-none ghost-border'
            )}
          />
          <button
            onClick={handleCreate}
            disabled={busy}
            className="px-2 py-1 rounded-[var(--radius)] text-[10px] font-semibold text-[#6bd5ff] hover:bg-[var(--surface-container-highest)]/50 disabled:opacity-40"
          >
            <Plus size={10} className="inline mr-1" />
            Create
          </button>
        </div>
      )}

      {error && (
        <div className="text-[10px] text-[var(--error,#f87171)] px-1">{error}</div>
      )}
    </div>
  )
}
