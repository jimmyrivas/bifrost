import { useState, useCallback } from 'react'
import { Layers, Plus, ArrowRight, RefreshCw } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface TmuxSession {
  name: string
  windows: number
  attached: boolean
  raw: string
}

interface TmuxManagerProps {
  onSendCommand: (command: string) => void
  isSSH: boolean
}

function parseTmuxOutput(output: string): TmuxSession[] {
  const sessions: TmuxSession[] = []
  const lines = output.split('\n').filter(Boolean)

  for (const line of lines) {
    // Format: "session_name: N windows (created ...) (attached)"
    const match = line.match(/^(\S+?):\s+(\d+)\s+windows?.*?(\(attached\))?$/)
    if (match) {
      sessions.push({
        name: match[1],
        windows: parseInt(match[2], 10),
        attached: !!match[3],
        raw: line.trim()
      })
    }
  }

  return sessions
}

export function TmuxManager({ onSendCommand, isSSH }: TmuxManagerProps): JSX.Element {
  const [sessions, setSessions] = useState<TmuxSession[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [detected, setDetected] = useState(false)

  const detectSessions = useCallback(() => {
    if (!isSSH) return
    setLoading(true)
    // Send command to detect tmux sessions
    // The output will appear in terminal, we parse it via a listener
    onSendCommand('tmux list-sessions 2>/dev/null || echo "NO_TMUX_SESSIONS"')
    // For now, show detection was triggered
    setTimeout(() => {
      setDetected(true)
      setLoading(false)
    }, 500)
  }, [isSSH, onSendCommand])

  const handleAttach = useCallback(
    (name: string) => {
      onSendCommand(`tmux attach -t ${name}`)
    },
    [onSendCommand]
  )

  const handleCreate = useCallback(() => {
    const name = newName.trim()
    if (!name) return
    onSendCommand(`tmux new-session -s ${name}`)
    setNewName('')
    setShowCreate(false)
  }, [newName, onSendCommand])

  const handleDetach = useCallback(() => {
    onSendCommand('tmux detach')
  }, [onSendCommand])

  if (!isSSH) {
    return (
      <div className="text-xs text-[var(--on-surface-variant)] text-center py-4">
        tmux manager is only available for SSH connections
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[#6bd5ff]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
            tmux Sessions
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={detectSessions}
            disabled={loading}
            className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50"
            aria-label="Refresh tmux sessions"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50"
            aria-label="New tmux session"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="flex gap-1.5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="Session name"
            className={cn(
              'flex-1 bg-[var(--surface-container-highest)] rounded-[var(--radius)] px-2 py-1',
              'text-xs text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/50 outline-none ghost-border'
            )}
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-2 py-1 rounded-[var(--radius)] text-[10px] font-semibold text-[#6bd5ff] hover:bg-[var(--surface-container-highest)]/50 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {sessions.map((session) => (
            <button
              key={session.name}
              onClick={() => handleAttach(session.name)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius)] text-left transition-colors',
                'hover:bg-[var(--surface-container-highest)]/50'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  session.attached ? 'bg-[var(--success)]' : 'bg-[var(--on-surface-variant)]/30'
                )}
              />
              <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--on-surface)] flex-1 truncate">
                {session.name}
              </span>
              <span className="text-[10px] text-[var(--on-surface-variant)]">
                {session.windows}w
              </span>
              <ArrowRight size={10} className="text-[var(--on-surface-variant)]" />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-[10px] text-[var(--on-surface-variant)] text-center py-2">
          {detected ? 'No active tmux sessions' : 'Click refresh to detect sessions'}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-1 pt-1">
        <button
          onClick={() => onSendCommand('tmux')}
          className="flex-1 px-2 py-1 rounded-[var(--radius)] text-[10px] font-semibold text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50"
        >
          New Default
        </button>
        <button
          onClick={handleDetach}
          className="flex-1 px-2 py-1 rounded-[var(--radius)] text-[10px] font-semibold text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50"
        >
          Detach
        </button>
      </div>
    </div>
  )
}
