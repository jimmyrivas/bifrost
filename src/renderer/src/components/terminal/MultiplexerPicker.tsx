import { useEffect, useMemo, useState } from 'react'
import { Layers, Plus, Trash2, ArrowRight, AlertTriangle, Power } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import { uniqueSessionName } from '@renderer/lib/multiplexer-naming'

export type MultiplexerKind = 'dtach' | 'tmux' | 'zellij'

export interface MultiplexerProbeSession {
  name: string
  target: string
  alive: boolean
  attached: boolean
  /** dtach=stale (orphan socket), zellij=exited (resurrectable from cache). */
  state?: 'alive' | 'exited' | 'stale'
  createdAt?: number
}

export interface MultiplexerProbeResult {
  kind: MultiplexerKind
  installed: boolean
  path?: string
  sessions: MultiplexerProbeSession[]
  error?: string
}

export interface MultiplexerProbeResponse {
  primary: MultiplexerProbeResult
  fallback?: MultiplexerProbeResult
}

export type MultiplexerPick =
  | { type: 'skip' }
  | { type: 'attach'; kind: MultiplexerKind; target: string; forceRunCommands?: boolean }
  | { type: 'create'; kind: MultiplexerKind; name: string }

interface Props {
  hostLabel: string
  defaultPrefix: string
  probe: MultiplexerProbeResponse
  onResolve: (pick: MultiplexerPick) => void
  onKillSession?: (kind: MultiplexerKind, target: string) => Promise<void>
  onCleanStale?: (kind: MultiplexerKind) => Promise<number>
}

export function MultiplexerPicker({
  hostLabel,
  defaultPrefix,
  probe,
  onResolve,
  onKillSession,
  onCleanStale
}: Props): JSX.Element {
  const initialKind: MultiplexerKind | null = probe.primary.installed
    ? probe.primary.kind
    : probe.fallback?.installed
      ? probe.fallback.kind
      : null

  const [active, setActive] = useState<MultiplexerKind | null>(initialKind)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const activeProbe = useMemo<MultiplexerProbeResult | undefined>(() => {
    if (!active) return undefined
    if (probe.primary.kind === active) return probe.primary
    if (probe.fallback?.kind === active) return probe.fallback
    return undefined
  }, [active, probe])

  const liveSessions = activeProbe?.sessions.filter((s) => s.alive) ?? []
  const inactiveSessions = activeProbe?.sessions.filter((s) => !s.alive) ?? []
  const [forceRunBy, setForceRunBy] = useState<Record<string, boolean>>({})

  // Suggested name = defaultPrefix + first free 3-digit suffix vs the
  // currently-listed sessions. Recomputed when the active kind changes so
  // the placeholder stays correct as the user toggles tmux/dtach/zellij.
  const suggestedName = useMemo(() => {
    const names = activeProbe?.sessions.map((s) => s.name) ?? []
    return uniqueSessionName(defaultPrefix, names)
  }, [activeProbe, defaultPrefix])

  // Available kinds (the ones we have a probe result for)
  const availableKinds: MultiplexerKind[] = []
  if (probe.primary) availableKinds.push(probe.primary.kind)
  if (probe.fallback) availableKinds.push(probe.fallback.kind)

  useEffect(() => {
    setErrorMsg(null)
  }, [active])

  const handleAttach = (target: string, forceRunCommands?: boolean): void => {
    if (!active) return
    onResolve({ type: 'attach', kind: active, target, forceRunCommands })
  }

  const handleCreate = (): void => {
    if (!active) return
    const typed = newName.trim()
    const base = typed || defaultPrefix
    const names = activeProbe?.sessions.map((s) => s.name) ?? []
    const name = uniqueSessionName(base, names)
    onResolve({ type: 'create', kind: active, name })
  }

  const handleKill = async (target: string): Promise<void> => {
    if (!active || !onKillSession) return
    setBusy(true)
    try {
      await onKillSession(active, target)
      // Remove locally so the UI updates without a full re-probe
      const arr = activeProbe?.sessions
      if (arr) {
        const idx = arr.findIndex((s) => s.target === target)
        if (idx >= 0) arr.splice(idx, 1)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to kill session')
    } finally {
      setBusy(false)
    }
  }

  const handleCleanInactive = async (): Promise<void> => {
    if (!active || !onCleanStale) return
    setBusy(true)
    try {
      const removed = await onCleanStale(active)
      if (activeProbe) {
        activeProbe.sessions = activeProbe.sessions.filter((s) => s.alive)
      }
      setErrorMsg(`Removed ${removed} inactive session${removed === 1 ? '' : 's'}.`)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to clean inactive')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onResolve({ type: 'skip' }) }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers size={16} className="text-[#6bd5ff]" />
            <span>Session multiplexer — {hostLabel}</span>
          </DialogTitle>
          <DialogDescription>
            Pick a session to resume, or create a new one. Sessions persist between reconnects.
          </DialogDescription>
        </DialogHeader>

        {/* Kind tabs */}
        {availableKinds.length > 1 && (
          <div className="flex gap-1">
            {availableKinds.map((kind) => {
              const r = kind === probe.primary.kind ? probe.primary : probe.fallback!
              return (
                <button
                  key={kind}
                  onClick={() => setActive(kind)}
                  className={cn(
                    'flex-1 h-8 rounded-[var(--radius)] text-[10px] font-semibold uppercase tracking-wider transition-colors',
                    active === kind
                      ? 'bg-[#6bd5ff] text-[#0a0a0c]'
                      : 'bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                  )}
                >
                  {kind}
                  <span className="ml-1.5 opacity-70">
                    {r.installed ? `(${r.sessions.length})` : '(missing)'}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Not installed banner — primary missing */}
        {!probe.primary.installed && (
          <div className="flex items-start gap-2 rounded-[var(--radius)] bg-[var(--surface-container-highest)] p-3">
            <AlertTriangle size={14} className="text-[var(--warning,#facc15)] shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-[var(--on-surface-variant)]">
              <strong className="text-[var(--on-surface)]">{probe.primary.kind}</strong> is not
              installed on <strong className="text-[var(--on-surface)]">{hostLabel}</strong>.
              {probe.fallback?.installed
                ? ` Switching to ${probe.fallback.kind} as fallback.`
                : ' Install it on the remote host or use a plain shell.'}
            </div>
          </div>
        )}

        {/* No multiplexer at all → only the skip path */}
        {!active && (
          <div className="rounded-[var(--radius)] bg-[var(--surface-container-highest)] p-3 text-xs text-[var(--on-surface-variant)]">
            Neither dtach nor tmux is installed on the host. You can connect with a plain shell or
            cancel and configure a different multiplexer.
          </div>
        )}

        {/* Live sessions */}
        {active && liveSessions.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)] px-1">
              Live sessions
            </div>
            {liveSessions.map((s) => (
              <div
                key={s.target}
                className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-2 py-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success,#34d399)] shrink-0" />
                <button
                  onClick={() => handleAttach(s.target)}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                  disabled={busy}
                >
                  <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--on-surface)] truncate">
                    {s.name}
                  </span>
                  {s.attached && (
                    <span className="text-[9px] text-[#facc15] shrink-0">(attached)</span>
                  )}
                  <span className="text-[9px] text-[var(--on-surface-variant)] truncate">
                    {s.target}
                  </span>
                  <ArrowRight size={12} className="text-[var(--on-surface-variant)] ml-auto shrink-0" />
                </button>
                {onKillSession && (
                  <button
                    onClick={() => handleKill(s.target)}
                    disabled={busy}
                    className="p-1 text-[var(--on-surface-variant)] hover:text-[var(--error,#f87171)] disabled:opacity-40"
                    aria-label={`Kill ${s.name}`}
                    title="Kill session"
                  >
                    <Power size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Inactive sessions — dtach=stale (orphan socket), zellij=exited (resurrectable) */}
        {active && inactiveSessions.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                Inactive sessions ({inactiveSessions.length})
              </span>
              {onCleanStale && (
                <button
                  onClick={handleCleanInactive}
                  disabled={busy}
                  className="flex items-center gap-1 text-[10px] text-[var(--on-surface-variant)] hover:text-[var(--error,#f87171)] disabled:opacity-40"
                  title={
                    active === 'dtach'
                      ? 'Remove orphan sockets'
                      : active === 'zellij'
                        ? 'Delete exited sessions from cache (no longer resurrectable)'
                        : 'Clean inactive'
                  }
                >
                  <Trash2 size={10} />
                  Clean inactive
                </button>
              )}
            </div>
            {inactiveSessions.map((s) => {
              const isResurrectable = active === 'zellij' && s.state === 'exited'
              const badge = s.state === 'exited' ? 'exited' : s.state === 'stale' ? 'stale' : 'inactive'
              return (
                <div
                  key={s.target}
                  className={cn(
                    'flex flex-col gap-1 rounded-[var(--radius)] bg-[var(--surface-container-highest)]/50 px-2 py-1.5',
                    !isResurrectable && 'opacity-60'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--on-surface-variant)]/40 shrink-0" />
                    <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--on-surface)] truncate flex-1">
                      {s.name}
                    </span>
                    <span className="text-[9px] text-[var(--on-surface-variant)] uppercase tracking-wider shrink-0">
                      {badge}
                    </span>
                    {isResurrectable && (
                      <button
                        onClick={() => handleAttach(s.target, forceRunBy[s.target])}
                        disabled={busy}
                        className="text-[10px] font-semibold text-[#6bd5ff] hover:underline disabled:opacity-40"
                      >
                        Resurrect →
                      </button>
                    )}
                  </div>
                  {isResurrectable && (
                    <label className="flex items-center gap-2 pl-3 text-[9px] text-[var(--on-surface-variant)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!forceRunBy[s.target]}
                        onChange={(e) =>
                          setForceRunBy((prev) => ({ ...prev, [s.target]: e.target.checked }))
                        }
                        className="w-3 h-3 accent-[#6bd5ff]"
                      />
                      <span>
                        Force-run saved commands on resurrect
                        <span className="text-[var(--on-surface-variant)]/60"> (else: press ENTER inside the session)</span>
                      </span>
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {active && liveSessions.length === 0 && inactiveSessions.length === 0 && (
          <div className="text-center text-xs text-[var(--on-surface-variant)] py-3">
            No {active} sessions on this host.
          </div>
        )}

        {/* New session form */}
        {active && (
          <div className="flex flex-col gap-2 rounded-[var(--radius)] bg-[var(--surface-container-highest)] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
              New session
            </div>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
                placeholder={suggestedName}
                className="h-8 text-xs flex-1"
              />
              <Button onClick={handleCreate} size="sm" disabled={busy}>
                <Plus size={12} className="mr-1" />
                Create
              </Button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="text-[10px] text-[var(--on-surface-variant)] px-1">{errorMsg}</div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onResolve({ type: 'skip' })}>
            Use plain shell
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onResolve({ type: 'skip' })}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
