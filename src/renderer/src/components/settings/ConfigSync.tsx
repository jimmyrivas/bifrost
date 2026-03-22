import { useState, useCallback } from 'react'
import { GitBranch, Upload, Download, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

const sectionCard = 'rounded-[var(--radius)] bg-[var(--surface-container-high)] p-4'
const fieldLabel = 'text-xs text-[var(--on-surface-variant)] mb-1 block'

export function ConfigSync(): JSX.Element {
  const [repoPath, setRepoPath] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleExport = useCallback(async () => {
    if (!repoPath.trim()) return
    setLoading(true)
    setStatus(null)
    try {
      const result = await window.bifrost.configSync.exportToGit(repoPath)
      setStatus(`Exported ${result.exported} connections`)
    } catch (err) {
      setStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [repoPath])

  const handleImport = useCallback(async () => {
    if (!repoPath.trim()) return
    setLoading(true)
    setStatus(null)
    try {
      const result = await window.bifrost.configSync.importFromGit(repoPath)
      setStatus(`Imported ${result.imported} new connections`)
    } catch (err) {
      setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [repoPath])

  const handleSync = useCallback(async () => {
    if (!repoPath.trim()) return
    setLoading(true)
    setStatus(null)
    try {
      const result = await window.bifrost.configSync.sync(repoPath)
      setStatus(`Synced: ${result.exported} exported, ${result.imported} imported`)
    } catch (err) {
      setStatus(`Sync failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [repoPath])

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <h3 className="text-sm font-semibold text-[var(--on-surface)]">Git Config Sync</h3>
      <div className={sectionCard}>
        <div className="flex flex-col gap-4">
          <div>
            <label className={fieldLabel} htmlFor="sync-repo-path">
              REPOSITORY PATH
            </label>
            <Input
              id="sync-repo-path"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/path/to/config-repo"
            />
            <p className="text-[9px] text-[var(--on-surface-variant)] mt-1">
              Connections are exported without passwords or private keys.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={loading || !repoPath.trim()}
              className="gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              disabled={loading || !repoPath.trim()}
              className="gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Import
            </Button>
            <Button
              variant="spectral"
              size="sm"
              onClick={handleSync}
              disabled={loading || !repoPath.trim()}
              className="gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sync
            </Button>
          </div>

          {status && (
            <div
              className={cn(
                'text-xs px-3 py-2 rounded-[var(--radius)]',
                status.includes('failed')
                  ? 'bg-[var(--error)]/10 text-[var(--error)]'
                  : 'bg-[var(--success)]/10 text-[var(--success)]'
              )}
            >
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
