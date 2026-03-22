import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectionsStore, type Connection, type Group } from '@renderer/stores/connections.store'

interface TreeNode {
  id: string
  name: string
  type: 'group' | 'connection'
  children: TreeNode[]
  data: Connection | Group
}

function buildTree(groups: Group[], connections: Connection[]): TreeNode[] {
  const groupMap = new Map<string, TreeNode>()
  const rootNodes: TreeNode[] = []

  // Create group nodes
  for (const group of groups) {
    groupMap.set(group.id, {
      id: group.id,
      name: group.name,
      type: 'group',
      children: [],
      data: group
    })
  }

  // Nest groups
  for (const group of groups) {
    const node = groupMap.get(group.id)!
    if (group.parentId && groupMap.has(group.parentId)) {
      groupMap.get(group.parentId)!.children.push(node)
    } else {
      rootNodes.push(node)
    }
  }

  // Add connections to groups or root
  for (const conn of connections) {
    const connNode: TreeNode = {
      id: conn.id,
      name: conn.name,
      type: 'connection',
      children: [],
      data: conn
    }
    if (conn.groupId && groupMap.has(conn.groupId)) {
      groupMap.get(conn.groupId)!.children.push(connNode)
    } else {
      rootNodes.push(connNode)
    }
  }

  return rootNodes
}

function methodIcon(method: string): string {
  switch (method) {
    case 'ssh': return '🔑'
    case 'rdp': return '🖥️'
    case 'vnc': return '📺'
    case 'telnet': return '📡'
    case 'local': return '💻'
    default: return '🔗'
  }
}

function TreeNodeItem({
  node,
  depth,
  onSelect,
  onConnect,
  selectedId
}: {
  node: TreeNode
  depth: number
  onSelect: (id: string) => void
  onConnect: (id: string) => void
  selectedId: string | null
}): JSX.Element {
  const isSelected = node.id === selectedId

  if (node.type === 'group') {
    return (
      <div>
        <div
          className="flex items-center gap-1 py-1 px-2 text-sm text-zinc-400 hover:bg-zinc-800/50 cursor-pointer"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-xs">📁</span>
          <span className="truncate">{node.name}</span>
        </div>
        {node.children.map((child) => (
          <TreeNodeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            onConnect={onConnect}
            selectedId={selectedId}
          />
        ))}
      </div>
    )
  }

  const conn = node.data as Connection
  return (
    <div
      className={`flex items-center gap-1 py-1 px-2 text-sm cursor-pointer transition-colors ${
        isSelected ? 'bg-zinc-700/50 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800/50'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => onSelect(node.id)}
      onDoubleClick={() => onConnect(node.id)}
      role="treeitem"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onConnect(node.id)
      }}
    >
      <span className="text-xs">{methodIcon(conn.method)}</span>
      <span className="truncate">{node.name}</span>
      {conn.host && (
        <span className="text-xs text-zinc-500 ml-auto truncate max-w-[80px]">
          {conn.host}
        </span>
      )}
    </div>
  )
}

interface ConnectionTreeProps {
  onConnect: (connectionId: string) => void
}

export function ConnectionTree({ onConnect }: ConnectionTreeProps): JSX.Element {
  const { t } = useTranslation()
  const connections = useConnectionsStore((s) => s.connections)
  const groups = useConnectionsStore((s) => s.groups)
  const selectedId = useConnectionsStore((s) => s.selectedConnectionId)
  const setSelected = useConnectionsStore((s) => s.setSelectedConnection)
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections)
  const fetchGroups = useConnectionsStore((s) => s.fetchGroups)

  useEffect(() => {
    fetchConnections()
    fetchGroups()
  }, [fetchConnections, fetchGroups])

  const tree = buildTree(groups, connections)

  return (
    <div className="flex-1 overflow-y-auto" role="tree" aria-label={t('sidebar.connections')}>
      {tree.length === 0 ? (
        <div className="p-3 text-xs text-zinc-500 text-center">
          No connections yet
        </div>
      ) : (
        tree.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            depth={0}
            onSelect={setSelected}
            onConnect={onConnect}
            selectedId={selectedId}
          />
        ))
      )}
    </div>
  )
}
