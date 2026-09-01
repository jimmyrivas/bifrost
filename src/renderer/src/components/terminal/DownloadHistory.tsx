import { FolderOpen, ExternalLink, Trash2 } from 'lucide-react'
import { useDownloadsStore } from '@renderer/stores/downloads.store'

/**
 * Compact list of past SFTP downloads (persisted) with reveal / open / remove.
 * Shown in the SFTP panel (and reusable elsewhere).
 */
export function DownloadHistory(): JSX.Element {
  const downloads = useDownloadsStore((s) => s.downloads)
  const remove = useDownloadsStore((s) => s.remove)
  const clear = useDownloadsStore((s) => s.clear)

  if (downloads.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-[10px] text-[var(--on-surface-variant)]">
        No downloads yet
      </div>
    )
  }

  const fmt = (ms: number): string => new Date(ms).toLocaleString()
  const size = (b: number): string =>
    b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} K` : `${(b / 1024 / 1024).toFixed(1)} M`

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 surface-1">
        <span className="text-[9px] uppercase tracking-wider text-[var(--on-surface-variant)]">Download history</span>
        <button onClick={clear} className="text-[9px] text-[var(--on-surface-variant)] underline hover:text-[var(--error)]">Clear</button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {downloads.map((d) => (
          <div key={d.id} className="flex items-center gap-1 px-2 py-1 hover:bg-[var(--surface-container-high)]/40 text-[10px]">
            <div className="flex-1 min-w-0">
              <div className="truncate text-[var(--on-surface)] font-[family-name:var(--font-mono)]" title={d.remotePath}>{d.name}</div>
              <div className="truncate text-[9px] text-[var(--on-surface-variant)]" title={d.localPath}>
                {d.localPath} · {size(d.size)} · {fmt(d.timestamp)}
              </div>
            </div>
            <button onClick={() => window.bifrost.system.revealPath(d.localPath)} className="p-0.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]" title="Reveal in file manager" aria-label="Reveal">
              <FolderOpen className="w-3 h-3" />
            </button>
            <button onClick={() => window.bifrost.system.openPath(d.localPath)} className="p-0.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]" title="Open" aria-label="Open">
              <ExternalLink className="w-3 h-3" />
            </button>
            <button onClick={() => remove(d.id)} className="p-0.5 text-[var(--on-surface-variant)] hover:text-[var(--error)]" title="Remove from history" aria-label="Remove">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
