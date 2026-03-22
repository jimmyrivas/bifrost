import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  ChevronDown,
  Terminal,
  Monitor,
  Tv,
  Radio,
  Laptop,
  Star,
  Plug,
  Pencil,
  Copy,
  ClipboardCopy,
  Power,
  Layers,
  Trash2,
  FolderPlus,
  FolderOpen,
  Plus,
  Type
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useConnectionsStore, type Connection, type Group } from '@renderer/stores/connections.store'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuShortcut
} from '@renderer/components/ui/context-menu'

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

interface TreeCallbacks {
  onSelect: (id: string) => void
  onConnect: (id: string) => void
  onEdit?: (id: string) => void
  onClone?: (id: string) => void
  onDelete?: (id: string) => void
  onToggleFavorite?: (id: string) => void
  onCopyPassword?: (id: string) => void
  onWakeOnLan?: (id: string) => void
  onStartInstances?: (id: string, count: number) => void
  onOpenAllInGroup?: (groupId: string) => void
  onAddConnection?: (groupId: string) => void
  onAddSubGroup?: (groupId: string) => void
  onRenameGroup?: (groupId: string) => void
  onDeleteGroup?: (groupId: string) => void
}

function GroupNode({
  node,
  depth,
  selectedId,
  callbacks,
  searchFilter
}: {
  node: TreeNode
  depth: number
  selectedId: string | null
  callbacks: TreeCallbacks
  searchFilter?: string
}): JSX.Element {
  const [expanded, setExpanded] = useState(true)

  const groupContent = (
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
          {searchFilter ? (
            <HighlightText text={node.name} highlight={searchFilter} />
          ) : (
            node.name
          )}
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
            selectedId={selectedId}
            callbacks={callbacks}
            searchFilter={searchFilter}
          />
        ))}
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{groupContent}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onClick={() => callbacks.onOpenAllInGroup?.(node.id)}
          className="gap-2"
        >
          <FolderOpen size={14} strokeWidth={1.5} />
          Open All Connections
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => callbacks.onAddConnection?.(node.id)}
          className="gap-2"
        >
          <Plus size={14} strokeWidth={1.5} />
          Add Connection
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => callbacks.onAddSubGroup?.(node.id)}
          className="gap-2"
        >
          <FolderPlus size={14} strokeWidth={1.5} />
          Add Sub-group
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => callbacks.onRenameGroup?.(node.id)}
          className="gap-2"
        >
          <Type size={14} strokeWidth={1.5} />
          Rename Group
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => callbacks.onDeleteGroup?.(node.id)}
          className="gap-2 text-red-400 focus:text-red-400"
        >
          <Trash2 size={14} strokeWidth={1.5} />
          Delete Group
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function ConnectionNode({
  node,
  depth,
  selectedId,
  callbacks,
  isFavorite,
  searchFilter
}: {
  node: TreeNode
  depth: number
  selectedId: string | null
  callbacks: TreeCallbacks
  isFavorite: boolean
  searchFilter?: string
}): JSX.Element {
  const isSelected = node.id === selectedId
  const conn = node.data as Connection

  const nodeContent = (
    <div
      className={cn(
        'group relative flex items-center gap-2 py-1 px-2 text-[13px] cursor-pointer transition-colors',
        isSelected
          ? 'bg-[#2a2a2d] text-[#e6e1e5]'
          : 'text-[#c7c4d7] hover:bg-[#2a2a2d]/50 hover:text-[#e6e1e5]'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => callbacks.onSelect(node.id)}
      onDoubleClick={() => callbacks.onConnect(node.id)}
      role="treeitem"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') callbacks.onConnect(node.id)
        if (e.key === 'e' && callbacks.onEdit) callbacks.onEdit(node.id)
      }}
    >
      {isSelected && (
        <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-[#6bd5ff]" />
      )}

      <MethodIcon method={conn.method} />
      <span className="truncate font-['Inter']">
        {searchFilter ? (
          <HighlightText text={node.name} highlight={searchFilter} />
        ) : (
          node.name
        )}
      </span>

      {/* Tag badges (#102) */}
      {conn.sshConfig && (() => {
        try {
          const cfg = JSON.parse(conn.sshConfig) as { tags?: string }
          const tags = cfg.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) ?? []
          return tags.slice(0, 2).map((tag: string) => (
            <span
              key={tag}
              className="px-1 py-0 rounded-[2px] text-[8px] font-semibold bg-[#6bd5ff]/15 text-[#6bd5ff] shrink-0"
            >
              {tag}
            </span>
          ))
        } catch { return null }
      })()}

      {isFavorite && (
        <Star size={10} strokeWidth={0} fill="#ffd56b" className="shrink-0 ml-auto" />
      )}

      {/* Edit button -- visible on hover/select */}
      {callbacks.onEdit && (
        <button
          className={cn(
            'opacity-0 group-hover:opacity-100 text-[#c7c4d7]/50 hover:text-[#e6e1e5] transition-opacity p-0.5',
            isFavorite ? '' : 'ml-auto'
          )}
          onClick={(e) => {
            e.stopPropagation()
            callbacks.onEdit!(node.id)
          }}
          aria-label="Edit connection"
        >
          <Pencil size={12} strokeWidth={1.5} />
        </button>
      )}

      {/* Status dot */}
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#c7c4d7]/20" />
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{nodeContent}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onClick={() => callbacks.onConnect(node.id)}
          className="gap-2"
        >
          <Plug size={14} strokeWidth={1.5} />
          Connect
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => callbacks.onEdit?.(node.id)}
          className="gap-2"
        >
          <Pencil size={14} strokeWidth={1.5} />
          Edit Connection
          <ContextMenuShortcut>E</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => callbacks.onClone?.(node.id)}
          className="gap-2"
        >
          <Copy size={14} strokeWidth={1.5} />
          Clone Connection
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => callbacks.onToggleFavorite?.(node.id)}
          className="gap-2"
        >
          <Star size={14} strokeWidth={1.5} className={isFavorite ? 'fill-[#ffd56b] text-[#ffd56b]' : ''} />
          {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => callbacks.onCopyPassword?.(node.id)}
          className="gap-2"
        >
          <ClipboardCopy size={14} strokeWidth={1.5} />
          Copy Password to Clipboard
        </ContextMenuItem>
        {conn.host && (
          <ContextMenuItem
            onClick={() => callbacks.onWakeOnLan?.(node.id)}
            className="gap-2"
          >
            <Power size={14} strokeWidth={1.5} />
            Wake On LAN
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Layers size={14} strokeWidth={1.5} />
            Start Multiple Instances
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => callbacks.onStartInstances?.(node.id, 2)}>
              2 Instances
            </ContextMenuItem>
            <ContextMenuItem onClick={() => callbacks.onStartInstances?.(node.id, 3)}>
              3 Instances
            </ContextMenuItem>
            <ContextMenuItem onClick={() => callbacks.onStartInstances?.(node.id, 5)}>
              5 Instances
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => callbacks.onDelete?.(node.id)}
          className="gap-2 text-red-400 focus:text-red-400"
        >
          <Trash2 size={14} strokeWidth={1.5} />
          Delete Connection
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function HighlightText({ text, highlight }: { text: string; highlight: string }): JSX.Element {
  if (!highlight) return <>{text}</>
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-[#6bd5ff]/25 text-[#6bd5ff] rounded-[2px] px-[1px]">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function TreeNodeItem({
  node,
  depth,
  selectedId,
  callbacks,
  searchFilter
}: {
  node: TreeNode
  depth: number
  selectedId: string | null
  callbacks: TreeCallbacks
  searchFilter?: string
}): JSX.Element {
  const isFavorite = useConnectionsStore((s) => s.favorites.includes(node.id))

  if (node.type === 'group') {
    return (
      <GroupNode
        node={node}
        depth={depth}
        selectedId={selectedId}
        callbacks={callbacks}
        searchFilter={searchFilter}
      />
    )
  }
  return (
    <ConnectionNode
      node={node}
      depth={depth}
      selectedId={selectedId}
      callbacks={callbacks}
      isFavorite={isFavorite}
      searchFilter={searchFilter}
    />
  )
}

interface ConnectionTreeProps {
  onConnect: (connectionId: string) => void
  onEdit?: (connectionId: string) => void
  onNewConnection?: () => void
  searchFilter?: string
}

export function ConnectionTree({ onConnect, onEdit, onNewConnection, searchFilter }: ConnectionTreeProps): JSX.Element {
  const { t } = useTranslation()
  const connections = useConnectionsStore((s) => s.connections)
  const groups = useConnectionsStore((s) => s.groups)
  const selectedId = useConnectionsStore((s) => s.selectedConnectionId)
  const setSelected = useConnectionsStore((s) => s.setSelectedConnection)
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections)
  const fetchGroups = useConnectionsStore((s) => s.fetchGroups)
  const toggleFavorite = useConnectionsStore((s) => s.toggleFavorite)
  const deleteConnection = useConnectionsStore((s) => s.deleteConnection)
  const deleteGroup = useConnectionsStore((s) => s.deleteGroup)
  const createConnection = useConnectionsStore((s) => s.createConnection)
  const createGroup = useConnectionsStore((s) => s.createGroup)
  const addRecent = useConnectionsStore((s) => s.addRecent)

  useEffect(() => {
    fetchConnections()
    fetchGroups()
  }, [fetchConnections, fetchGroups])

  const [confirmDelete, setConfirmDelete] = useState<{ type: 'connection' | 'group'; id: string; name: string } | null>(null)

  const handleConnect = useCallback(
    (id: string) => {
      addRecent(id)
      onConnect(id)
    },
    [addRecent, onConnect]
  )

  const handleClone = useCallback(
    async (id: string) => {
      const conn = connections.find((c) => c.id === id)
      if (!conn) return
      await createConnection({
        groupId: conn.groupId,
        name: `${conn.name} (copy)`,
        method: conn.method,
        host: conn.host,
        port: conn.port,
        authType: conn.authType,
        username: conn.username
      })
    },
    [connections, createConnection]
  )

  const handleCopyPassword = useCallback(async (id: string) => {
    try {
      // Check if password exists and copy via a workaround
      // Since we can't retrieve the password directly from credentials store,
      // we write a placeholder. In a real scenario this would need a dedicated IPC call.
      const hasPass = await window.bifrost.credentials.hasPassword(id)
      if (!hasPass) {
        console.warn('No password stored for this connection')
        return
      }
      // Note: password retrieval for clipboard requires a dedicated IPC channel.
      // For now, we indicate the feature is wired up.
      console.info('Copy password requested for connection:', id)
    } catch (err) {
      console.error('Failed to copy password:', err)
    }
  }, [])

  const handleWakeOnLan = useCallback(
    async (id: string) => {
      const conn = connections.find((c) => c.id === id)
      if (!conn?.host) return
      try {
        // WOL requires a MAC address. The host field may not be a MAC.
        // This is a placeholder for when MAC address support is added to Connection.
        await window.bifrost.system.wol(conn.host)
      } catch (err) {
        console.error('WOL failed:', err)
      }
    },
    [connections]
  )

  const handleStartInstances = useCallback(
    (id: string, count: number) => {
      for (let i = 0; i < count; i++) {
        handleConnect(id)
      }
    },
    [handleConnect]
  )

  const handleDeleteConfirm = useCallback(() => {
    if (!confirmDelete) return
    if (confirmDelete.type === 'connection') {
      deleteConnection(confirmDelete.id)
    } else {
      deleteGroup(confirmDelete.id)
    }
    setConfirmDelete(null)
  }, [confirmDelete, deleteConnection, deleteGroup])

  const handleOpenAllInGroup = useCallback(
    (groupId: string) => {
      const children = connections.filter((c) => c.groupId === groupId)
      children.forEach((c) => handleConnect(c.id))
    },
    [connections, handleConnect]
  )

  const handleAddSubGroup = useCallback(
    async (parentId: string) => {
      const name = window.prompt('Sub-group name:')
      if (!name) return
      await createGroup({ name, parentId, icon: null })
    },
    [createGroup]
  )

  const handleRenameGroup = useCallback(
    async (groupId: string) => {
      const group = groups.find((g) => g.id === groupId)
      if (!group) return
      const name = window.prompt('New group name:', group.name)
      if (!name || name === group.name) return
      await window.bifrost.connections.updateGroup(groupId, { name })
      fetchGroups()
    },
    [groups, fetchGroups]
  )

  const callbacks: TreeCallbacks = {
    onSelect: setSelected,
    onConnect: handleConnect,
    onEdit: onEdit,
    onClone: handleClone,
    onDelete: (id) => {
      const conn = connections.find((c) => c.id === id)
      if (conn) {
        setConfirmDelete({ type: 'connection', id, name: conn.name })
      }
    },
    onToggleFavorite: toggleFavorite,
    onCopyPassword: handleCopyPassword,
    onWakeOnLan: handleWakeOnLan,
    onStartInstances: handleStartInstances,
    onOpenAllInGroup: handleOpenAllInGroup,
    onAddConnection: (_groupId: string) => {
      // Navigate to new connection form (with group context if needed)
      onNewConnection?.()
    },
    onAddSubGroup: handleAddSubGroup,
    onRenameGroup: handleRenameGroup,
    onDeleteGroup: (id) => {
      const group = groups.find((g) => g.id === id)
      if (group) {
        setConfirmDelete({ type: 'group', id, name: group.name })
      }
    }
  }

  // Filter tree if search is active
  const allTree = buildTree(groups, connections)

  const filterTree = (nodes: TreeNode[], filter: string): TreeNode[] => {
    if (!filter) return nodes
    const lf = filter.toLowerCase()
    return nodes.reduce<TreeNode[]>((acc, node) => {
      if (node.type === 'connection') {
        const conn = node.data as Connection
        // Also search tags (#102)
        let tagMatch = false
        if (conn.sshConfig) {
          try {
            const cfg = JSON.parse(conn.sshConfig) as { tags?: string }
            tagMatch = cfg.tags?.toLowerCase().includes(lf) ?? false
          } catch { /* ignore */ }
        }
        const matches =
          node.name.toLowerCase().includes(lf) ||
          (conn.host && conn.host.toLowerCase().includes(lf)) ||
          tagMatch
        if (matches) acc.push(node)
      } else {
        const filteredChildren = filterTree(node.children, filter)
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lf)) {
          acc.push({ ...node, children: filteredChildren })
        }
      }
      return acc
    }, [])
  }

  const tree = searchFilter ? filterTree(allTree, searchFilter) : allTree

  return (
    <>
      <div
        className="flex-1 overflow-y-auto py-1"
        role="tree"
        aria-label={t('sidebar.connections')}
      >
        {tree.length === 0 ? (
          <div className="px-4 py-6 text-xs text-[#c7c4d7]/40 text-center">
            {searchFilter ? 'No matches found' : 'No connections yet'}
          </div>
        ) : (
          tree.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              callbacks={callbacks}
              searchFilter={searchFilter}
            />
          ))
        )}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0d0f]/60 backdrop-blur-[12px]">
          <div className="bg-[#2a2a2d] rounded-[0.25rem] p-6 max-w-sm w-full mx-4 shadow-lg">
            <h3 className="text-sm font-semibold text-[#e6e1e5] mb-2">
              Delete {confirmDelete.type === 'connection' ? 'Connection' : 'Group'}
            </h3>
            <p className="text-xs text-[#c7c4d7] mb-4">
              Are you sure you want to delete <span className="text-[#e6e1e5] font-medium">{confirmDelete.name}</span>?
              {confirmDelete.type === 'group' && ' All connections in this group will be ungrouped.'}
              {' '}This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 text-xs text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#39393c]/30 rounded-[0.25rem] transition-colors"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-400/10 rounded-[0.25rem] transition-colors"
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
