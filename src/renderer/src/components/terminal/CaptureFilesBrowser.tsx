import { useState, useEffect, useCallback } from 'react'
import {
  Circle,
  FolderOpen,
  Copy,
  Trash2,
  X,
  Play,
  Clapperboard,
  FileText,
  ExternalLink,
  ScrollText
} from 'lucide-react'
import type { RecordingInfo } from '../../../../main/services/session-recorder'
import type { LogFileInfo } from '../../../../main/services/session-logger'

export type CaptureTab = 'recordings' | 'logs'

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

export interface CaptureFilesApi {
  recordings: RecordingInfo[]
  logs: LogFileInfo[]
  flash: string | null
  refresh: () => void
  openFolder: (kind: CaptureTab) => void
  copyPlayCmd: (info: RecordingInfo) => void
  deleteRecording: (info: RecordingInfo) => void
  openLog: (log: LogFileInfo) => void
  deleteLog: (log: LogFileInfo) => void
  reveal: (path: string) => void
}

/**
 * Data + actions over captured session files (recordings and session logs).
 * Shared by the CaptureFilesBrowser modal and the Activity view's Captures
 * tab so the behavior lives in exactly one place.
 */
export function useCaptureFiles(active: boolean): CaptureFilesApi {
  const [recordings, setRecordings] = useState<RecordingInfo[]>([])
  const [logs, setLogs] = useState<LogFileInfo[]>([])
  const [flash, setFlash] = useState<string | null>(null)

  const flashMsg = useCallback((msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 1800)
  }, [])

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
    window.bifrost?.system
      ?.listSessionLogs()
      .then((list: LogFileInfo[]) => setLogs(list ?? []))
      .catch(() => setLogs([]))
  }, [])

  useEffect(() => {
    if (active) refresh()
  }, [active, refresh])

  const openFolder = useCallback(
    async (kind: CaptureTab) => {
      try {
        const dir =
          kind === 'recordings'
            ? await window.bifrost.system.getRecordingsDir()
            : await window.bifrost.system.getLogDir()
        if (dir) await window.bifrost.system.openPath(dir)
      } catch {
        flashMsg('Could not open folder')
      }
    },
    [flashMsg]
  )

  const copyPlayCmd = useCallback(
    async (info: RecordingInfo) => {
      await navigator.clipboard.writeText(`asciinema play "${info.filePath}"`)
      flashMsg('Play command copied')
    },
    [flashMsg]
  )

  const deleteRecording = useCallback(
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

  const openLog = useCallback(
    (log: LogFileInfo) => {
      window.bifrost.system
        .openPath(log.path)
        .then((err: string) => {
          if (err) flashMsg('Could not open file')
        })
        .catch(() => flashMsg('Could not open file'))
    },
    [flashMsg]
  )

  const deleteLog = useCallback(
    async (log: LogFileInfo) => {
      try {
        const ok = await window.bifrost.system.deleteSessionLog(log.path)
        if (!ok) flashMsg(log.active ? 'Still logging — stop it first' : 'Delete failed')
        refresh()
      } catch {
        flashMsg('Delete failed')
      }
    },
    [refresh, flashMsg]
  )

  const reveal = useCallback((path: string) => {
    window.bifrost.system.revealPath(path).catch(() => {})
  }, [])

  return { recordings, logs, flash, refresh, openFolder, copyPlayCmd, deleteRecording, openLog, deleteLog, reveal }
}

/**
 * The file list for ONE capture kind — rows with per-file actions, plus an
 * informative empty state. Rendered by the browser modal and the Activity
 * view's Captures tab.
 */
export function CaptureFileList({ kind, api }: { kind: CaptureTab; api: CaptureFilesApi }): JSX.Element {
  if (kind === 'recordings') {
    if (api.recordings.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#c7c4d7]/40">
          <Circle size={22} className="text-[var(--error)]/40" />
          <p className="text-xs">No recordings yet</p>
          <p className="text-[11px]">Right-click a terminal → Capture → Record Session</p>
        </div>
      )
    }
    return (
      <>
        {api.recordings.map((info) => (
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
              onClick={() => api.copyPlayCmd(info)}
              className="p-1.5 text-[#c7c4d7]/60 hover:text-[#6bd5ff] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
              title="Copy asciinema play command"
            >
              <Copy size={13} />
            </button>
            <button
              onClick={() => api.reveal(info.filePath)}
              className="p-1.5 text-[#c7c4d7]/60 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
              title="Reveal in file manager"
            >
              <FolderOpen size={13} />
            </button>
            <button
              onClick={() => api.deleteRecording(info)}
              className="p-1.5 text-[#c7c4d7]/60 hover:text-[var(--error)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
              title="Delete recording"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </>
    )
  }

  if (api.logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#c7c4d7]/40">
        <FileText size={22} className="text-[#c7c4d7]/30" />
        <p className="text-xs">No session logs yet</p>
        <p className="text-[11px]">Right-click a terminal → Capture → Save Session Log</p>
      </div>
    )
  }
  return (
    <>
      {api.logs.map((log) => (
        <div
          key={log.path}
          className="flex items-center gap-3 px-4 py-2.5 bg-[#131316] hover:bg-[#1b1b1e] transition-colors"
        >
          <FileText size={13} className="text-[#c7c4d7]/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-xs text-[var(--on-surface)] truncate">
              {log.name}
              {log.active && (
                <span className="ml-2 text-[10px] text-[var(--error)] animate-pulse">logging…</span>
              )}
            </div>
            <div className="text-[10px] text-[#c7c4d7]/50">
              {formatWhen(log.mtime)} · {humanSize(log.size)}
            </div>
          </div>
          <button
            onClick={() => api.openLog(log)}
            className="p-1.5 text-[#c7c4d7]/60 hover:text-[#6bd5ff] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
            title="Open file"
          >
            <ExternalLink size={13} />
          </button>
          <button
            onClick={() => api.reveal(log.path)}
            className="p-1.5 text-[#c7c4d7]/60 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
            title="Reveal in file manager"
          >
            <FolderOpen size={13} />
          </button>
          <button
            onClick={() => api.deleteLog(log)}
            disabled={log.active}
            className="p-1.5 text-[#c7c4d7]/60 hover:text-[var(--error)] hover:bg-[#2a2a2d] rounded-[var(--radius)] disabled:opacity-30 disabled:hover:text-[#c7c4d7]/60"
            title={log.active ? 'Still logging — stop it first' : 'Delete log'}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </>
  )
}

interface CaptureFilesBrowserProps {
  open: boolean
  defaultTab?: CaptureTab
  onClose: () => void
}

/**
 * Unified browser over captured session files: asciicast recordings and
 * plain-text session logs. Opened from the terminal Capture menu and from
 * Preferences → Session Capture — both render this same component.
 */
export function CaptureFilesBrowser({ open, defaultTab = 'recordings', onClose }: CaptureFilesBrowserProps): JSX.Element | null {
  const [tab, setTab] = useState<CaptureTab>(defaultTab)
  const api = useCaptureFiles(open)

  useEffect(() => {
    if (open) setTab(defaultTab)
  }, [open, defaultTab])

  if (!open) return null

  const tabBtn = (t: CaptureTab, label: string, icon: JSX.Element): JSX.Element => (
    <button
      onClick={() => setTab(t)}
      className={
        tab === t
          ? 'flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-[var(--radius)] bg-[#2a2a2d] text-[var(--on-surface)]'
          : 'flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-[var(--radius)] text-[#c7c4d7]/60 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d]/60'
      }
    >
      {icon}
      {label}
    </button>
  )

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
          <span className="text-sm font-semibold text-[var(--on-surface)]">Session Captures</span>
          <div className="flex items-center gap-1 ml-2">
            {tabBtn('recordings', `Recordings (${api.recordings.length})`, <Play size={12} />)}
            {tabBtn('logs', `Session Logs (${api.logs.length})`, <ScrollText size={12} />)}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => api.openFolder(tab)}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[#c7c4d7] hover:text-[var(--on-surface)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
            title={tab === 'recordings' ? 'Open recordings folder' : 'Open logs folder'}
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
          {tab === 'recordings' ? (
            <>
              asciicast <span className="font-mono text-[#c7c4d7]/80">.cast</span> files. Play with{' '}
              <span className="font-mono text-[#6bd5ff]">asciinema play &lt;file&gt;</span> — use{' '}
              <span className="text-[#c7c4d7]/80">Copy play command</span> per row.
            </>
          ) : (
            <>
              Plain-text <span className="font-mono text-[#c7c4d7]/80">.log</span> transcripts.
              Files still being written show a{' '}
              <span className="text-[var(--error)]">logging…</span> badge and can&apos;t be deleted
              until the session stops logging.
            </>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <CaptureFileList kind={tab} api={api} />
        </div>

        {api.flash && (
          <div className="px-4 py-2 text-[11px] text-[#6bd5ff] bg-[#1b1b1e]">{api.flash}</div>
        )}
      </div>
    </div>
  )
}
