import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronDown, Terminal, Monitor, Tv, Radio, Laptop } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
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

  for (const group of groups) {
    groupMap.set(group.id, {
      id: group.id,
      name: group.name,
      type: 'group',
      children: [],
      data: group
    })
  }

  for (const group of groups) {
    const node = groupMap.get(group.id)!
    if (group.parentId && groupMap.has(group.parentId)) {
      groupMap.get(group.parentId)!.children.push(node)
    } else {
      rootNodes.push(node)
    }
  }

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

function MethodIcon({ method }: { method: string }): JSX.Element {
  const props = { size: 13, strokeWidth: 1.5, className: 'shrink-0 text-[#c7c4d7]/60' }
  switch (method) {
    case 'ssh':
      return <Terminal {...props} />
    case 'rdp':
      return <Monitor {...props} />
    case 'vnc':
      return <Tv {...props} />
    case 'telnet':
      return <Radio {...props} />
    case 'local':
      return <Laptop {...props} />
    default:
      return <Terminal {...props} />
  }
}

function GroupNode({
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
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <button
        className={cn(
          'w-full flex items-center gap-1.5 py-1 px-2 transition-colors',
          'text-[#c7c4d7]/70 hover:bg-[#2a2a2d]/30'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown size={12} strokeWidth={1.5} className="shrink-0" />
        ) : (
          <ChevronRight size={12} strokeWidth={1.5} className="shrink-0" />
        )}
        <span className="text-[10px] font-semibold tracking-[0.1em] uppercase truncate">
          {node.name}
        </span>
        <span className="text-[10px] text-[#c7c4d7]/30 ml-auto">
          {node.children.length}
        </span>
      </button>
      {expanded &&
        node.children.map((child) => (
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

function ConnectionNode({
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
  const conn = node.data as Connection

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 py-1 px-2 text-[13px] cursor-pointer transition-colors',
        isSelected
          ? 'bg-[#2a2a2d] text-[#e6e1e5]'
          : 'text-[#c7c4d7] hover:bg-[#2a2a2d]/50 hover:text-[#e6e1e5]'
      )}
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
      {/* Selected left accent */}
      {isSelected && (
        <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-[#6bd5ff]" />
      )}

      <MethodIcon method={conn.method} />
      <span className="truncate font-['Inter']">{node.name}</span>

      {/* Status dot */}
      <span
        className="ml-auto w-1.5 h-1.5 rounded-full shrink-0 bg-[#c7c4d7]/20"
        aria-label="Disconnected"
      />
    </div>
  )
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
  if (node.type === 'group') {
    return (
      <GroupNode
        node={node}
        depth={depth}
        onSelect={onSelect}
        onConnect={onConnect}
        selectedId={selectedId}
      />
    )
  }
  return (
    <ConnectionNode
      node={node}
      depth={depth}
      onSelect={onSelect}
      onConnect={onConnect}
      selectedId={selectedId}
    />
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
    <div
      className="flex-1 overflow-y-auto py-1"
      role="tree"
      aria-label={t('sidebar.connections')}
    >
      {tree.length === 0 ? (
        <div className="px-4 py-6 text-xs text-[#c7c4d7]/40 text-center">
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
