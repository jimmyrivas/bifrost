import { useState, useCallback } from 'react'
import { Folder, File, ArrowUp, Download, Upload, RefreshCw, Trash2 } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

interface SftpEntry {
  name: string
  size: number
  isDirectory: boolean
  permissions: string
  modifiedAt: string
}

interface SftpPanelProps {
  sshSessionId: string | null
}

const headerCell = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] text-left'
const bodyCell = 'px-3 py-2'

export function SftpPanel({ sshSessionId }: SftpPanelProps): JSX.Element {
  const [currentPath, setCurrentPath] = useState('/')
  const [entries, setEntries] = useState<SftpEntry[]>([])
  const [loading, setLoading] = useState(false)

  const navigateTo = useCallback(
    async (path: string) => {
      if (!sshSessionId) return
      setLoading(true)
      setCurrentPath(path)
      setEntries([])
      setLoading(false)
    },
    [sshSessionId]
  )

  const goUp = (): void => {
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    navigateTo('/' + parts.join('/'))
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!sshSessionId) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--on-surface-variant)] text-sm">
        Connect to a server to browse files
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full surface-0">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 surface-2">
        <button onClick={goUp} className="p-1.5 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50" aria-label="Go up">
          <ArrowUp className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <Input
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigateTo(currentPath) }}
            className="h-7 text-xs"
            aria-label="Current path"
          />
        </div>
        <button onClick={() => navigateTo(currentPath)} className="p-1.5 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50" aria-label="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50" aria-label="Upload">
          <Upload className="w-4 h-4" />
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-[var(--on-surface-variant)] text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--on-surface-variant)] text-xs">No files or directory not loaded</div>
        ) : (
          <div role="table" aria-label="File listing">
            {/* Header */}
            <div className="surface-2 flex sticky top-0 z-10" role="row">
              <div className={cn(headerCell, 'flex-1')} role="columnheader">NAME</div>
              <div className={cn(headerCell, 'w-20 text-right')} role="columnheader">SIZE</div>
              <div className={cn(headerCell, 'w-24')} role="columnheader">PERMS</div>
              <div className={cn(headerCell, 'w-16')} role="columnheader" />
            </div>

            {/* Rows */}
            {entries.map((entry, idx) => (
              <div
                key={entry.name} role="row"
                className={cn(
                  'flex items-center transition-colors cursor-pointer',
                  idx % 2 === 0 ? 'bg-[var(--surface-container-low)]' : 'bg-[var(--surface)]',
                  'hover:bg-[var(--surface-container-high)]/50'
                )}
                onDoubleClick={() => {
                  if (entry.isDirectory) navigateTo(`${currentPath}/${entry.name}`.replace(/\/\//g, '/'))
                }}
              >
                <div className={cn(bodyCell, 'flex-1 flex items-center gap-1.5 text-xs text-[var(--on-surface)]')}>
                  {entry.isDirectory ? (
                    <Folder className="w-3.5 h-3.5 text-[#6bd5ff] shrink-0" />
                  ) : (
                    <File className="w-3.5 h-3.5 text-[var(--on-surface-variant)] shrink-0" />
                  )}
                  <span className="font-[family-name:var(--font-mono)]">{entry.name}</span>
                </div>
                <div className={cn(bodyCell, 'w-20 text-right text-xs text-[var(--on-surface-variant)] font-[family-name:var(--font-mono)]')}>
                  {entry.isDirectory ? '-' : formatSize(entry.size)}
                </div>
                <div className={cn(bodyCell, 'w-24 text-xs text-[var(--on-surface-variant)] font-[family-name:var(--font-mono)]')}>
                  {entry.permissions}
                </div>
                <div className={cn(bodyCell, 'w-16 flex gap-1')}>
                  {!entry.isDirectory && (
                    <button className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]" aria-label={`Download ${entry.name}`}>
                      <Download className="w-3 h-3" />
                    </button>
                  )}
                  <button className="text-[var(--on-surface-variant)] hover:text-[var(--error)]" aria-label={`Delete ${entry.name}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
