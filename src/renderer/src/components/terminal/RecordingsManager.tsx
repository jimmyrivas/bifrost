import { useState, useEffect, useCallback } from 'react'
import { Circle, FolderOpen, Copy, Trash2, X, Play, Clapperboard } from 'lucide-react'
import type { RecordingInfo } from '../../../../main/services/session-recorder'

interface RecordingsManagerProps {
  open: boolean
  onClose: () => void
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function duration(info: RecordingInfo): string {
  if (!info.stoppedAt) return 'recording…'
  const ms = new Date(info.stoppedAt).getTime() - new Date(info.startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export function RecordingsManager({ open, onClose }: RecordingsManagerProps): JSX.Element | null {
  const [recordings, setRecordings] = useState<RecordingInfo[]>([])
  const [flash, setFlash] = useState<string | null>(null)

  const refresh = useCallback(() => {
    window.bifrost?.ssh
      ?.listRecordings()
      .then((list: RecordingInfo[]) =>
        setRecordings(
          [...(list ?? [])].sort(
            (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          )
        )
      )
      .catch(() => setRecordings([]))
  }, [])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const flashMsg = useCallback((msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 1800)
  }, [])

  const handleOpenFolder = useCallback(async () => {
    try {
      const dir = await window.bifrost.system.getRecordingsDir()
      if (dir) await window.bifrost.system.openPath(dir)
    } catch {
      flashMsg('Could not open folder')
    }
  }, [flashMsg])

  const handleReveal = useCallback((info: RecordingInfo) => {
    window.bifrost.system.revealPath(info.filePath).catch(() => {})
  }, [])

  const handleCopyPlayCmd = useCallback(
    async (info: RecordingInfo) => {
      await navigator.clipboard.writeText(`asciinema play "${info.filePath}"`)
      flashMsg('Play command copied')
    },
    [flashMsg]
  )

  const handleDelete = useCallback(
    async (info: RecordingInfo) => {
      try {
        await window.bifrost.ssh.deleteRecording(info.id)
        refresh()
      } catch {
        flashMsg('Delete failed')
      }
    },
    [refresh, flashMsg]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-w-[92vw] max-h-[80vh] flex flex-col bg-[#131316] rounded-[var(--radius)] shadow-2xl shadow-black/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#1b1b1e]">
          <Clapperboard size={16} className="text-[#ffa36b]" />
          <span className="text-sm font-semibold text-[var(--on-surface)]">Session Recordings</span>
          <span className="text-[11px] text-[#c7c4d7]/50">({recordings.length})</span>
          <div className="flex-1" />
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[#c7c4d7] hover:text-[var(--on-surface)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
            title="Open recordings folder"
          >
            <FolderOpen size={13} /> Open folder
          </button>
          <button
            onClick={onClose}
            className="p-1 text-[#c7c4d7]/70 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
          >
            <X size={15} />
          </button>
        </div>

        {/* How-to hint */}
        <div className="px-4 py-2 text-[11px] text-[#c7c4d7]/60 bg-[#131316]">
          asciicast <span className="font-mono text-[#c7c4d7]/80">.cast</span> files. Play with{' '}
          <span className="font-mono text-[#6bd5ff]">asciinema play &lt;file&gt;</span> — use{' '}
          <span className="text-[#c7c4d7]/80">Copy play command</span> per row.
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#c7c4d7]/40">
              <Circle size={22} className="text-[var(--error)]/40" />
              <p className="text-xs">No recordings yet</p>
              <p className="text-[11px]">Right-click a terminal → Capture → Record Session</p>
            </div>
          ) : (
            recordings.map((info) => (
              <div
                key={info.id}
                className="flex items-center gap-3 px-4 py-2.5 bg-[#131316] hover:bg-[#1b1b1e] transition-colors"
              >
                <Play size={13} className="text-[#c7c4d7]/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-[var(--on-surface)] truncate">
                    {basename(info.filePath)}
                  </div>
                  <div className="text-[10px] text-[#c7c4d7]/50">
                    {formatWhen(info.startedAt)} · {duration(info)} · {humanSize(info.size)}
                  </div>
                </div>
                <button
                  onClick={() => handleCopyPlayCmd(info)}
                  className="p-1.5 text-[#c7c4d7]/60 hover:text-[#6bd5ff] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
                  title="Copy asciinema play command"
                >
                  <Copy size={13} />
                </button>
                <button
                  onClick={() => handleReveal(info)}
                  className="p-1.5 text-[#c7c4d7]/60 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
                  title="Reveal in file manager"
                >
                  <FolderOpen size={13} />
                </button>
                <button
                  onClick={() => handleDelete(info)}
                  className="p-1.5 text-[#c7c4d7]/60 hover:text-[var(--error)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
                  title="Delete recording"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {flash && (
          <div className="px-4 py-2 text-[11px] text-[#6bd5ff] bg-[#1b1b1e]">{flash}</div>
        )}
      </div>
    </div>
  )
}
