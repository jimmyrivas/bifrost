import { useState, useCallback, useEffect } from 'react'
import { Folder, File, ArrowUp, Download, Upload, RefreshCw, Trash2, X, FolderPlus, Pencil } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

interface SftpEntry {
  name: string
  size: number
  permissions: number
  modifiedDate: number
  accessDate: number
  isDirectory: boolean
  isSymlink: boolean
  owner: number
  group: number
}

interface SftpPanelProps {
  sshSessionId: string | null
  onClose: () => void
}

export function SftpPanel({ sshSessionId, onClose }: SftpPanelProps): JSX.Element {
  const [sftpId, setSftpId] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState('~')
  const [pathInput, setPathInput] = useState('~')
  const [entries, setEntries] = useState<SftpEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Open SFTP session on mount
  useEffect(() => {
    if (!sshSessionId) return
    let cancelled = false

    const init = async (): Promise<void> => {
      try {
        const id = await window.bifrost.sftp.open(sshSessionId)
        if (!cancelled) setSftpId(id)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to open SFTP')
      }
    }
    init()

    return () => { cancelled = true }
  }, [sshSessionId])

  const loadDirectory = useCallback(async (path: string) => {
    if (!sftpId) return
    setLoading(true)
    setError(null)
    try {
      const list = await window.bifrost.sftp.listDirectory(sftpId, path)
      // Resolve actual path from server (~ gets resolved)
      // Filter . and .., sort dirs first
      const filtered = list.filter((e: SftpEntry) => e.name !== '.' && e.name !== '..')
      setEntries(filtered)

      // If we requested ~, try to detect the resolved path from stat
      let resolvedPath = path
      if (path === '~' || path === '.') {
        // The server resolves ~ internally; we detect via the response
        // Use realpath if available, otherwise keep as-is
        try {
          const stat = await window.bifrost.sftp.stat(sftpId, '.')
          // stat doesn't give us the path, so we just use the path the user gave
          // For ~, ssh2 resolves it server-side
          resolvedPath = path
        } catch { /* keep path */ }
      }
      setCurrentPath(resolvedPath)
      setPathInput(resolvedPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list directory')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [sftpId])

  // Navigate to home on connect
  useEffect(() => {
    if (sftpId) loadDirectory('.')
  }, [sftpId, loadDirectory])

  const navigateTo = useCallback((path: string) => {
    loadDirectory(path)
  }, [loadDirectory])

  const goUp = (): void => {
    if (currentPath === '/' || currentPath === '.') {
      navigateTo('/')
      return
    }
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    navigateTo('/' + parts.join('/'))
  }

  const handleDownload = useCallback(async (name: string) => {
    if (!sftpId) return
    const remotePath = currentPath === '.'
      ? name
      : `${currentPath}/${name}`.replace(/\/\//g, '/')
    try {
      const localPath = await window.bifrost.window.showSaveDialog(name)
      if (!localPath) return // cancelled
      await window.bifrost.sftp.readFile(sftpId, remotePath, localPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    }
  }, [sftpId, currentPath])

  const handleUpload = useCallback(async () => {
    if (!sftpId) return
    try {
      const localPaths = await window.bifrost.window.showOpenDialog()
      if (!localPaths || localPaths.length === 0) return
      for (const localPath of localPaths) {
        const fileName = localPath.split('/').pop() ?? 'file'
        const remotePath = currentPath === '.'
          ? fileName
          : `${currentPath}/${fileName}`.replace(/\/\//g, '/')
        await window.bifrost.sftp.writeFile(sftpId, localPath, remotePath)
      }
      await loadDirectory(currentPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }, [sftpId, currentPath, loadDirectory])

  const handleDelete = useCallback(async (name: string) => {
    if (!sftpId) return
    const ok = window.confirm(`Delete "${name}"?`)
    if (!ok) return
    const remotePath = currentPath === '.'
      ? name
      : `${currentPath}/${name}`.replace(/\/\//g, '/')
    try {
      await window.bifrost.sftp.delete(sftpId, remotePath)
      await loadDirectory(currentPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }, [sftpId, currentPath, loadDirectory])

  const handleRename = useCallback(async (name: string) => {
    if (!sftpId) return
    const newName = window.prompt(`Rename "${name}" to:`, name)
    if (!newName || newName === name) return
    const dir = currentPath === '.' ? '' : currentPath
    const join = (n: string): string => (dir ? `${dir}/${n}` : n).replace(/\/\//g, '/')
    try {
      await window.bifrost.sftp.rename(sftpId, join(name), join(newName))
      await loadDirectory(currentPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed')
    }
  }, [sftpId, currentPath, loadDirectory])

  const handleMkdir = useCallback(async () => {
    if (!sftpId) return
    const name = window.prompt('New directory name:')
    if (!name) return
    const remotePath = currentPath === '.'
      ? name
      : `${currentPath}/${name}`.replace(/\/\//g, '/')
    try {
      await window.bifrost.sftp.mkdir(sftpId, remotePath)
      await loadDirectory(currentPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create directory')
    }
  }, [sftpId, currentPath, loadDirectory])

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} K`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} M`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} G`
  }

  if (!sshSessionId) {
    return (
      <div className="flex flex-col h-full surface-1">
        <div className="flex items-center justify-between px-3 py-2 surface-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">SFTP</span>
          <button onClick={onClose} className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center justify-center flex-1 text-[var(--on-surface-variant)] text-xs">
          Connect to a server first
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full surface-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 surface-2 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">SFTP</span>
        <button onClick={onClose} className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] p-0.5"><X className="w-3.5 h-3.5" /></button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-1.5 py-1 surface-1 shrink-0">
        <button onClick={goUp} className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50 shrink-0" aria-label="Go up" title="Go up">
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigateTo(pathInput) }}
            className="h-6 text-[10px] font-[family-name:var(--font-mono)]"
            aria-label="Path"
          />
        </div>
        <button onClick={() => navigateTo(currentPath)} className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50 shrink-0" aria-label="Refresh" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleMkdir} className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50 shrink-0" aria-label="New folder" title="New folder">
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleUpload} className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50 shrink-0" aria-label="Upload file" title="Upload file">
          <Upload className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-2 py-1 text-[10px] text-[var(--error)] bg-[var(--error)]/10 shrink-0">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--on-surface-variant)] text-xs">Loading...</div>
        ) : entries.length === 0 && !error ? (
          <div className="flex items-center justify-center h-32 text-[var(--on-surface-variant)] text-xs">
            {sftpId ? 'Empty directory' : 'Opening SFTP...'}
          </div>
        ) : (
          entries.map((entry, idx) => {
            const dir = entry.isDirectory ?? false
            return (
              <div
                key={entry.name}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 transition-colors cursor-pointer',
                  idx % 2 === 0 ? 'bg-[var(--surface-container-low)]' : 'bg-[var(--surface)]',
                  'hover:bg-[var(--surface-container-high)]/50'
                )}
                onDoubleClick={() => {
                  if (dir) {
                    const next = currentPath === '.'
                      ? entry.name
                      : `${currentPath}/${entry.name}`.replace(/\/\//g, '/')
                    navigateTo(next)
                  }
                }}
              >
                {/* Icon */}
                {dir ? (
                  <Folder className="w-3.5 h-3.5 text-[#6bd5ff] shrink-0" />
                ) : (
                  <File className="w-3.5 h-3.5 text-[var(--on-surface-variant)] shrink-0" />
                )}

                {/* Name */}
                <span className="flex-1 text-[11px] text-[var(--on-surface)] font-[family-name:var(--font-mono)] truncate min-w-0">
                  {entry.name}
                </span>

                {/* Size */}
                <span className="text-[9px] text-[var(--on-surface-variant)] shrink-0 w-12 text-right">
                  {dir ? '' : formatSize(entry.size ?? 0)}
                </span>

                {/* Actions */}
                <div className="flex shrink-0">
                  {!dir && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(entry.name) }}
                      className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] p-0.5"
                      aria-label={`Download ${entry.name}`}
                      title="Download"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRename(entry.name) }}
                    className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] p-0.5"
                    aria-label={`Rename ${entry.name}`}
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(entry.name) }}
                    className="text-[var(--on-surface-variant)] hover:text-[var(--error)] p-0.5"
                    aria-label={`Delete ${entry.name}`}
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
