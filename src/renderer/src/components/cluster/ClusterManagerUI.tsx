import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Play, Server, ChevronRight, ChevronDown, Circle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import { useConnectionsStore } from '@renderer/stores/connections.store'
import { showToast } from '@renderer/lib/protocol-dispatch'

interface ClusterView {
  id: string
  name: string
  memberConnIds: string[]
}

interface ClusterManagerUIProps {
  /** Open every member connection of a cluster (opens tabs + enables broadcast). */
  onOpenCluster?: (connectionIds: string[]) => void
}

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]'

export function ClusterManagerUI({ onOpenCluster }: ClusterManagerUIProps): JSX.Element {
  const { t } = useTranslation()
  const [clusters, setClusters] = useState<ClusterView[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedConnIds, setSelectedConnIds] = useState<Set<string>>(new Set())
  const [expandedTree, setExpandedTree] = useState<Set<string>>(new Set())
  const [showAutoCluster, setShowAutoCluster] = useState(false)
  const [autoPattern, setAutoPattern] = useState('')
  const [autoClusterName, setAutoClusterName] = useState('')
  const connections = useConnectionsStore((s) => s.connections)
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections)

  const nameOf = useCallback(
    (id: string): string => connections.find((c) => c.id === id)?.name ?? id.slice(0, 8),
    [connections]
  )

  const loadClusters = useCallback(async () => {
    try {
      const rows = await window.bifrost.cluster.list()
      const withMembers = await Promise.all(
        rows.map(async (r) => ({
          id: r.id,
          name: r.name,
          memberConnIds: (await window.bifrost.cluster.getMembers(r.id)).map((m) => m.connectionId)
        }))
      )
      setClusters(withMembers)
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => {
    fetchConnections()
    loadClusters()
  }, [fetchConnections, loadClusters])

  const toggleConnection = (id: string): void => {
    const next = new Set(selectedConnIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedConnIds(next)
  }

  const createCluster = async (): Promise<void> => {
    if (!newName.trim() || selectedConnIds.size === 0) return
    try {
      await window.bifrost.cluster.create(newName.trim(), [...selectedConnIds])
      setNewName('')
      setSelectedConnIds(new Set())
      setShowCreate(false)
      await loadClusters()
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const deleteCluster = async (id: string): Promise<void> => {
    try {
      await window.bifrost.cluster.delete(id)
      if (selectedId === id) setSelectedId(null)
      await loadClusters()
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const createAutoCluster = async (): Promise<void> => {
    if (!autoPattern.trim() || !autoClusterName.trim()) return
    let matched: string[]
    try {
      const regex = new RegExp(autoPattern, 'i')
      matched = connections
        .filter((c) => regex.test(c.name) || (c.host ? regex.test(c.host) : false))
        .map((c) => c.id)
    } catch {
      showToast({ variant: 'error', message: 'Invalid regex pattern' })
      return
    }
    if (matched.length === 0) {
      showToast({ variant: 'info', message: 'Pattern matched no connections' })
      return
    }
    try {
      await window.bifrost.cluster.create(autoClusterName.trim(), matched)
      setAutoPattern('')
      setAutoClusterName('')
      setShowAutoCluster(false)
      await loadClusters()
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const openCluster = (cluster: ClusterView): void => {
    if (cluster.memberConnIds.length === 0) {
      showToast({ variant: 'info', message: `Cluster "${cluster.name}" has no members` })
      return
    }
    onOpenCluster?.(cluster.memberConnIds)
  }

  const toggleTree = (id: string): void => {
    setExpandedTree((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const autoMatchCount = (): number => {
    if (!autoPattern) return 0
    try {
      const re = new RegExp(autoPattern, 'i')
      return connections.filter((c) => re.test(c.name) || (c.host ? re.test(c.host) : false)).length
    } catch {
      return 0
    }
  }

  const selectedCluster = clusters.find((c) => c.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--on-surface)]">{t('cluster.title', 'Cluster Manager')}</h2>
          <p className={sectionLabel}>{t('cluster.subtitle', 'AGGREGATE & ORCHESTRATE NODE GROUPS')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAutoCluster(!showAutoCluster)}>
            AUTO-CLUSTER
          </Button>
          <Button variant="spectral" size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-3 w-3" /> NEW CLUSTER
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="surface-2 rounded-[var(--radius)] p-4 flex flex-col gap-3">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Cluster name" />
          <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
            {connections.map((conn) => (
              <label key={conn.id} className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)] cursor-pointer hover:bg-[var(--surface-container-highest)]/50 px-2 py-1 rounded-[var(--radius)]">
                <input type="checkbox" checked={selectedConnIds.has(conn.id)} onChange={() => toggleConnection(conn.id)} className="rounded-[var(--radius)]" />
                <span className="text-[var(--on-surface)]">{conn.name}</span>
                {conn.host && <span className="text-[var(--on-surface-variant)]">({conn.host})</span>}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="spectral" size="sm" onClick={createCluster} disabled={!newName.trim() || selectedConnIds.size === 0}>Create</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>{t('actions.cancel', 'Cancel')}</Button>
          </div>
        </div>
      )}

      {/* Auto-cluster form (#56) */}
      {showAutoCluster && (
        <div className="surface-2 rounded-[var(--radius)] p-4 flex flex-col gap-3">
          <p className={sectionLabel}>AUTO-CLUSTER BY PATTERN</p>
          <div className="grid grid-cols-2 gap-3">
            <Input value={autoClusterName} onChange={(e) => setAutoClusterName(e.target.value)} placeholder="Cluster name" />
            <Input value={autoPattern} onChange={(e) => setAutoPattern(e.target.value)} placeholder="Regex pattern (e.g. prod-.*)" />
          </div>
          {autoPattern && (
            <p className="text-[10px] text-[var(--on-surface-variant)]">Matches: {autoMatchCount()} connections</p>
          )}
          <div className="flex gap-2">
            <Button variant="spectral" size="sm" onClick={createAutoCluster} disabled={!autoPattern.trim() || !autoClusterName.trim()}>Create</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAutoCluster(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Cluster grid */}
        <div className="flex-1 grid grid-cols-2 gap-3 auto-rows-min overflow-y-auto">
          {clusters.length === 0 ? (
            <div className="col-span-2 text-xs text-[var(--on-surface-variant)] text-center py-12">No clusters defined</div>
          ) : clusters.map((cluster) => (
            <div
              key={cluster.id}
              onClick={() => setSelectedId(cluster.id)}
              className={cn(
                'surface-2 rounded-[var(--radius)] p-4 flex flex-col gap-3 hover:bg-[var(--surface-container-highest)]/30 transition-colors cursor-pointer',
                selectedId === cluster.id && 'ring-1 ring-inset ring-[var(--outline-variant)]'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[var(--radius)] surface-3 flex items-center justify-center">
                    <Server className="h-5 w-5 text-[var(--on-surface-variant)]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--on-surface)]">{cluster.name}</h4>
                    <p className="text-[10px] text-[var(--on-surface-variant)]">
                      {cluster.memberConnIds.length} {cluster.memberConnIds.length === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); openCluster(cluster) }}
                  className="p-1.5 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--success)] hover:bg-[var(--surface-container-highest)]/50"
                  aria-label="Open cluster"
                  title="Open all member sessions + broadcast"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCluster(cluster.id) }}
                  className="p-1.5 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--error)] hover:bg-[var(--surface-container-highest)]/50"
                  aria-label="Delete cluster"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Tree inspector — real clusters + their members */}
        <div className="w-64 shrink-0 surface-2 rounded-[var(--radius)] p-4 flex flex-col gap-3 overflow-y-auto">
          <h4 className={sectionLabel}>TREE INSPECTOR</h4>
          <div className="text-xs flex flex-col gap-0.5">
            {clusters.length === 0 && (
              <span className="text-[var(--on-surface-variant)]">No clusters</span>
            )}
            {clusters.map((c) => (
              <div key={c.id}>
                <button onClick={() => toggleTree(c.id)} className="flex items-center gap-1 text-[var(--on-surface)] py-0.5 w-full text-left">
                  {expandedTree.has(c.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span className="font-semibold">{c.name}</span>
                </button>
                {expandedTree.has(c.id) && (
                  <div className="ml-4 flex flex-col gap-0.5">
                    {c.memberConnIds.length === 0 && (
                      <span className="text-[var(--on-surface-variant)] py-0.5">empty</span>
                    )}
                    {c.memberConnIds.map((cid) => (
                      <div key={cid} className="flex items-center gap-1.5 py-0.5 text-[var(--on-surface-variant)]">
                        <Circle className="h-2 w-2 fill-[var(--on-surface-variant)] text-[var(--on-surface-variant)]" />
                        <span className="font-[family-name:var(--font-mono)]">{nameOf(cid)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open selected cluster */}
      <div className="flex justify-end">
        <Button
          variant="spectral"
          disabled={!selectedCluster}
          onClick={() => selectedCluster && openCluster(selectedCluster)}
        >
          OPEN CLUSTER CONSOLE{selectedCluster ? `: ${selectedCluster.name}` : ''}
        </Button>
      </div>
    </div>
  )
}
