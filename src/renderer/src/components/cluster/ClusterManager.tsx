import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Pencil, ExternalLink, Check, X, Users } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { cn } from '@renderer/lib/utils'
import { useConnectionsStore, type Connection } from '@renderer/stores/connections.store'

export interface Cluster {
  id: string
  name: string
  memberIds: string[]
}

interface ClusterManagerProps {
  clusters: Cluster[]
  onChange: (clusters: Cluster[]) => void
  onOpenCluster: (cluster: Cluster) => void
}

let clusterCounter = 0
function newClusterId(): string {
  return `cluster-${++clusterCounter}-${Date.now()}`
}

const checkClass = 'h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-zinc-400'

function ConnectionMultiSelect({
  connections,
  selectedIds,
  onChange
}: {
  connections: Connection[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}): JSX.Element {
  const { t } = useTranslation()
  const selectedSet = new Set(selectedIds)

  const toggle = (id: string): void => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="max-h-40 overflow-y-auto border border-zinc-700 rounded-md p-1" role="listbox" aria-label={t('cluster.selectConnections', 'Select connections')} aria-multiselectable="true">
      {connections.length === 0 && (
        <p className="text-xs text-zinc-500 text-center py-2">{t('cluster.noConnections', 'No connections available')}</p>
      )}
      {connections.map((c) => (
        <label
          key={c.id}
          className="flex items-center gap-2 px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800/50 rounded cursor-pointer"
          role="option"
          aria-selected={selectedSet.has(c.id)}
        >
          <input
            type="checkbox"
            className={checkClass}
            checked={selectedSet.has(c.id)}
            onChange={() => toggle(c.id)}
          />
          <span className="truncate">{c.name}</span>
          {c.host && <span className="text-xs text-zinc-500 ml-auto">{c.host}</span>}
        </label>
      ))}
    </div>
  )
}

export function ClusterManager({ clusters, onChange, onOpenCluster }: ClusterManagerProps): JSX.Element {
  const { t } = useTranslation()
  const connections = useConnectionsStore((s) => s.connections)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editMembers, setEditMembers] = useState<string[]>([])

  const addCluster = useCallback(() => {
    const id = newClusterId()
    onChange([...clusters, { id, name: '', memberIds: [] }])
    setEditingId(id)
    setEditName('')
    setEditMembers([])
  }, [clusters, onChange])

  const deleteCluster = useCallback((id: string) => {
    onChange(clusters.filter((c) => c.id !== id))
    if (editingId === id) setEditingId(null)
  }, [clusters, onChange, editingId])

  const startEdit = useCallback((c: Cluster) => {
    setEditingId(c.id)
    setEditName(c.name)
    setEditMembers([...c.memberIds])
  }, [])

  const confirmEdit = useCallback(() => {
    if (!editingId || !editName.trim()) return
    onChange(clusters.map((c) =>
      c.id === editingId ? { ...c, name: editName, memberIds: editMembers } : c
    ))
    setEditingId(null)
  }, [editingId, editName, editMembers, clusters, onChange])

  const cancelEdit = useCallback(() => {
    if (editingId) {
      const c = clusters.find((x) => x.id === editingId)
      if (c && !c.name) {
        onChange(clusters.filter((x) => x.id !== editingId))
      }
    }
    setEditingId(null)
  }, [editingId, clusters, onChange])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">{t('cluster.title', 'Clusters')}</h3>
        <Button variant="outline" size="sm" onClick={addCluster}>
          <Plus className="h-3 w-3" /> {t('cluster.add', 'Add Cluster')}
        </Button>
      </div>

      {clusters.length === 0 && (
        <p className="text-xs text-zinc-500 text-center py-6">{t('cluster.empty', 'No clusters defined.')}</p>
      )}

      <div className="flex flex-col gap-2" role="list" aria-label={t('cluster.title', 'Clusters')}>
        {clusters.map((cluster) => {
          const isEditing = editingId === cluster.id
          const memberCount = cluster.memberIds.length

          return (
            <div key={cluster.id} role="listitem" className="p-3 bg-zinc-800/50 rounded-md border border-zinc-700/50">
              {isEditing ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <Label className="text-xs">{t('cluster.name', 'Cluster Name')}</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-xs"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit() }}
                      aria-label={t('cluster.name', 'Cluster Name')}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('cluster.members', 'Members')}</Label>
                    <ConnectionMultiSelect
                      connections={connections}
                      selectedIds={editMembers}
                      onChange={setEditMembers}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>
                      <X className="h-3 w-3" /> {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button size="sm" onClick={confirmEdit} disabled={!editName.trim()}>
                      <Check className="h-3 w-3" /> {t('common.save', 'Save')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-100 font-medium">{cluster.name}</span>
                    <span className="text-xs text-zinc-500 ml-2">
                      {t('cluster.memberCount', '{{count}} connections', { count: memberCount })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => onOpenCluster(cluster)} disabled={memberCount === 0} aria-label={t('cluster.open', 'Open cluster')}>
                      <ExternalLink className="h-3 w-3" /> {t('cluster.open', 'Open')}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(cluster)} className="h-8 w-8" aria-label={t('common.edit', 'Edit')}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteCluster(cluster.id)} className="h-8 w-8 text-red-400 hover:text-red-300" aria-label={t('common.delete', 'Delete')}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
