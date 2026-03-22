import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Play, Server, ChevronRight, ChevronDown, Circle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import { useConnectionsStore } from '@renderer/stores/connections.store'

interface ClusterDef {
  id: string
  name: string
  memberCount: number
  status: 'active' | 'partial' | 'failed' | 'maintenance'
}

const STATUS_STYLES: Record<ClusterDef['status'], { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-[var(--success)]/15', text: 'text-[var(--success)]', label: 'ACTIVE' },
  partial: { bg: 'bg-[var(--warning)]/15', text: 'text-[var(--warning)]', label: 'PARTIAL' },
  failed: { bg: 'bg-[var(--error)]/15', text: 'text-[var(--error)]', label: 'FAILED' },
  maintenance: { bg: 'bg-[#6bd5ff]/15', text: 'text-[#6bd5ff]', label: 'MAINTENANCE' },
}

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]'

export function ClusterManagerUI(): JSX.Element {
  const { t } = useTranslation()
  const [clusters, setClusters] = useState<ClusterDef[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedConnIds, setSelectedConnIds] = useState<Set<string>>(new Set())
  const [expandedTree, setExpandedTree] = useState<Set<string>>(new Set(['root']))
  const [showAutoCluster, setShowAutoCluster] = useState(false)
  const [autoPattern, setAutoPattern] = useState('')
  const [autoClusterName, setAutoClusterName] = useState('')
  const connections = useConnectionsStore((s) => s.connections)
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections)

  useEffect(() => { fetchConnections() }, [fetchConnections])

  const toggleConnection = (id: string): void => {
    const next = new Set(selectedConnIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedConnIds(next)
  }

  const createCluster = async (): Promise<void> => {
    if (!newName.trim() || selectedConnIds.size === 0) return
    setClusters([...clusters, {
      id: `c-${Date.now()}`, name: newName, memberCount: selectedConnIds.size, status: 'active'
    }])
    setNewName('')
    setSelectedConnIds(new Set())
    setShowCreate(false)
  }

  const deleteCluster = (id: string): void => { setClusters(clusters.filter((c) => c.id !== id)) }

  const createAutoCluster = (): void => {
    if (!autoPattern.trim() || !autoClusterName.trim()) return
    try {
      const regex = new RegExp(autoPattern, 'i')
      const matched = connections.filter((c) => regex.test(c.name) || (c.host && regex.test(c.host)))
      if (matched.length === 0) return
      setClusters([...clusters, {
        id: `c-auto-${Date.now()}`,
        name: autoClusterName,
        memberCount: matched.length,
        status: 'active'
      }])
      setAutoPattern('')
      setAutoClusterName('')
      setShowAutoCluster(false)
    } catch {
      // Invalid regex
    }
  }

  const toggleTree = (id: string): void => {
    setExpandedTree((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

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
            <p className="text-[10px] text-[var(--on-surface-variant)]">
              Matches: {connections.filter((c) => {
                try { return new RegExp(autoPattern, 'i').test(c.name) || (c.host ? new RegExp(autoPattern, 'i').test(c.host) : false) } catch { return false }
              }).length} connections
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="spectral" size="sm" onClick={createAutoCluster} disabled={!autoPattern.trim() || !autoClusterName.trim()}>Create</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAutoCluster(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Cluster grid */}
        <div className="flex-1 grid grid-cols-2 gap-3 auto-rows-min">
          {clusters.length === 0 ? (
            <div className="col-span-2 text-xs text-[var(--on-surface-variant)] text-center py-12">No clusters defined</div>
          ) : clusters.map((cluster) => {
            const style = STATUS_STYLES[cluster.status]
            return (
              <div key={cluster.id} className="surface-2 rounded-[var(--radius)] p-4 flex flex-col gap-3 hover:bg-[var(--surface-container-highest)]/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[var(--radius)] surface-3 flex items-center justify-center">
                      <Server className="h-5 w-5 text-[var(--on-surface-variant)]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--on-surface)]">{cluster.name}</h4>
                      <p className="text-[10px] text-[var(--on-surface-variant)]">{cluster.memberCount} Active, {cluster.memberCount} Total</p>
                    </div>
                  </div>
                  <span className={cn('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-[var(--radius)]', style.bg, style.text)}>
                    {style.label}
                  </span>
                </div>
                <div className="flex gap-1 justify-end">
                  <button className="p-1.5 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--success)] hover:bg-[var(--surface-container-highest)]/50" aria-label="Open cluster">
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteCluster(cluster.id)} className="p-1.5 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--error)] hover:bg-[var(--surface-container-highest)]/50" aria-label="Delete cluster">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Tree inspector */}
        <div className="w-64 shrink-0 surface-2 rounded-[var(--radius)] p-4 flex flex-col gap-3 overflow-y-auto">
          <h4 className={sectionLabel}>TREE INSPECTOR</h4>
          <div className="text-xs flex flex-col gap-0.5">
            <button onClick={() => toggleTree('root')} className="flex items-center gap-1 text-[var(--on-surface)] hover:text-[var(--on-surface)] py-0.5">
              {expandedTree.has('root') ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span className="font-semibold">DB Cluster Default</span>
            </button>
            {expandedTree.has('root') && (
              <div className="ml-4 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 py-0.5 text-[var(--on-surface-variant)]">
                  <Circle className="h-2 w-2 fill-[var(--success)] text-[var(--success)]" />
                  <span className="font-[family-name:var(--font-mono)]">Services</span>
                </div>
                {clusters.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 py-0.5 ml-3 text-[var(--on-surface-variant)]">
                    <Circle className={cn('h-2 w-2', c.status === 'active' ? 'fill-[var(--success)] text-[var(--success)]' : 'fill-[var(--error)] text-[var(--error)]')} />
                    <span className="font-[family-name:var(--font-mono)]">{c.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Open cluster console */}
      <div className="flex justify-end">
        <Button variant="spectral">OPEN CLUSTER CONSOLE</Button>
      </div>
    </div>
  )
}
