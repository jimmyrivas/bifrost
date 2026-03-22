import { useState, useCallback } from 'react'
import { Folder, File, ArrowUp, Download, Upload, RefreshCw, Trash2 } from 'lucide-react'

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

export function SftpPanel({ sshSessionId }: SftpPanelProps): JSX.Element {
  const [currentPath, setCurrentPath] = useState('/')
  const [entries, setEntries] = useState<SftpEntry[]>([])
  const [loading, setLoading] = useState(false)

  const navigateTo = useCallback(
    async (path: string) => {
      if (!sshSessionId) return
      setLoading(true)
      setCurrentPath(path)
      // Will call IPC: sftp:list
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
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Connect to a server to browse files
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-800">
        <button onClick={goUp} className="p-1 text-zinc-400 hover:text-zinc-200" title="Go up">
          <ArrowUp className="w-4 h-4" />
        </button>
        <input
          value={currentPath}
          onChange={(e) => setCurrentPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigateTo(currentPath)
          }}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 font-mono"
        />
        <button onClick={() => navigateTo(currentPath)} className="p-1 text-zinc-400 hover:text-zinc-200" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button className="p-1 text-zinc-400 hover:text-zinc-200" title="Upload">
          <Upload className="w-4 h-4" />
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
            No files or directory not loaded
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-zinc-800 sticky top-0">
              <tr>
                <th className="text-left px-2 py-1 text-zinc-400">Name</th>
                <th className="text-right px-2 py-1 text-zinc-400 w-20">Size</th>
                <th className="text-left px-2 py-1 text-zinc-400 w-20">Perms</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.name}
                  className="border-t border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
                  onDoubleClick={() => {
                    if (entry.isDirectory) {
                      navigateTo(`${currentPath}/${entry.name}`.replace(/\/\//g, '/'))
                    }
                  }}
                >
                  <td className="px-2 py-1 flex items-center gap-1.5 text-zinc-200">
                    {entry.isDirectory ? (
                      <Folder className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <File className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                    {entry.name}
                  </td>
                  <td className="px-2 py-1 text-right text-zinc-400">
                    {entry.isDirectory ? '-' : formatSize(entry.size)}
                  </td>
                  <td className="px-2 py-1 text-zinc-500 font-mono">{entry.permissions}</td>
                  <td className="px-2 py-1 flex gap-1">
                    {!entry.isDirectory && (
                      <button className="text-zinc-500 hover:text-zinc-300">
                        <Download className="w-3 h-3" />
                      </button>
                    )}
                    <button className="text-zinc-500 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
