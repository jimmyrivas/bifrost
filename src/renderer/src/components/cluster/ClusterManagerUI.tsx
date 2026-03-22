import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Play, Users } from 'lucide-react'
import { useConnectionsStore } from '@renderer/stores/connections.store'

interface ClusterDef {
  id: string
  name: string
  memberCount: number
}

export function ClusterManagerUI(): JSX.Element {
  const { t } = useTranslation()
  const [clusters, setClusters] = useState<ClusterDef[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedConnIds, setSelectedConnIds] = useState<Set<string>>(new Set())
  const connections = useConnectionsStore((s) => s.connections)
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections)

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const toggleConnection = (id: string): void => {
    const next = new Set(selectedConnIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedConnIds(next)
  }

  const createCluster = async (): Promise<void> => {
    if (!newName.trim() || selectedConnIds.size === 0) return
    // Will call IPC to create cluster
    setClusters([
      ...clusters,
      { id: `c-${Date.now()}`, name: newName, memberCount: selectedConnIds.size }
    ])
    setNewName('')
    setSelectedConnIds(new Set())
    setShowCreate(false)
  }

  const deleteCluster = (id: string): void => {
    setClusters(clusters.filter((c) => c.id !== id))
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
          <Users className="w-4 h-4" />
          {t('sidebar.clusters')}
        </h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {showCreate && (
        <div className="p-3 bg-zinc-800/50 rounded space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Cluster name"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
          />
          <div className="max-h-32 overflow-y-auto space-y-1">
            {connections.map((conn) => (
              <label key={conn.id} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:bg-zinc-700/50 px-2 py-0.5 rounded">
                <input
                  type="checkbox"
                  checked={selectedConnIds.has(conn.id)}
                  onChange={() => toggleConnection(conn.id)}
                  className="rounded"
                />
                {conn.name} {conn.host && <span className="text-zinc-500">({conn.host})</span>}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={createCluster}
              disabled={!newName.trim() || selectedConnIds.size === 0}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              {t('actions.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {clusters.map((cluster) => (
          <div key={cluster.id} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded hover:bg-zinc-800/60">
            <div>
              <span className="text-sm text-zinc-200">{cluster.name}</span>
              <span className="text-xs text-zinc-500 ml-2">{cluster.memberCount} connections</span>
            </div>
            <div className="flex gap-1">
              <button className="p-1 text-zinc-400 hover:text-green-400" title="Open Cluster">
                <Play className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteCluster(cluster.id)} className="p-1 text-zinc-400 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {clusters.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-4">No clusters defined</p>
        )}
      </div>
    </div>
  )
}
