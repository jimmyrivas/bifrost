import { useState, useCallback, useRef, useEffect } from 'react'
import { ChevronDown, Plus, Trash2, Pencil, Layers, Check, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useWorkspaceStore } from '@renderer/stores/workspace.store'

export function WorkspaceSelector(): JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace)
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace)
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace)
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace)

  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeWorkspace = workspaces.find((w) => w.id === activeId)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setRenamingId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCreate = useCallback(() => {
    const name = newName.trim()
    if (!name) return
    const id = createWorkspace(name)
    setActive(id)
    setNewName('')
    setCreating(false)
    setOpen(false)
  }, [newName, createWorkspace, setActive])

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingId) return
    const name = renameValue.trim()
    if (name && name !== workspaces.find((w) => w.id === renamingId)?.name) {
      renameWorkspace(renamingId, name)
    }
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue, renameWorkspace, workspaces])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
    setRenameValue('')
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1 rounded-[var(--radius)] text-xs transition-colors',
          activeWorkspace
            ? 'bg-[#6bd5ff]/10 text-[#6bd5ff] hover:bg-[#6bd5ff]/15 shadow-[inset_0_0_0_1px_rgba(107,213,255,0.15)]'
            : 'text-[#c7c4d7]/70 hover:text-[#e6e1e5] hover:bg-[#1b1b1e]'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Layers size={12} strokeWidth={1.5} className={activeWorkspace ? 'text-[#6bd5ff]' : 'text-[#c7c4d7]/40'} />
        <span className="truncate max-w-[140px] font-medium">
          {activeWorkspace?.name ?? 'All Connections'}
        </span>
        {activeWorkspace && (
          <span className="text-[9px] text-[#6bd5ff]/50 tabular-nums">
            {activeWorkspace.connectionIds.length}
          </span>
        )}
        <ChevronDown size={11} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-60 bg-[var(--surface-container-high)] rounded-[var(--radius)] shadow-lg shadow-black/30 z-50 py-1 border border-[rgba(199,196,215,0.08)]">
          {/* All connections */}
          <button
            onClick={() => {
              setActive(null)
              setOpen(false)
            }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors',
              !activeId
                ? 'text-[var(--on-surface)] bg-[var(--surface-container-highest)]/50'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/30'
            )}
          >
            <Layers size={11} strokeWidth={1.5} className="text-[#c7c4d7]/40 shrink-0" />
            All Connections
          </button>

          {workspaces.length > 0 && (
            <div className="h-[1px] bg-[rgba(199,196,215,0.08)] my-1 mx-2" />
          )}

          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={cn(
                'flex items-center group',
                activeId === ws.id && 'bg-[#6bd5ff]/5'
              )}
            >
              {renamingId === ws.id ? (
                /* Inline rename input */
                <div className="flex-1 flex items-center gap-1 px-2 py-1">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex-1 bg-[var(--surface-container-highest)] rounded-[var(--radius)] px-2 py-1 text-[10px] text-[var(--on-surface)] outline-none"
                    autoFocus
                  />
                  <button
                    onClick={commitRename}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={!renameValue.trim()}
                    className="p-0.5 text-[var(--success)] hover:text-[#22c55e] disabled:opacity-40"
                    aria-label="Confirm rename"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={cancelRename}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-0.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                    aria-label="Cancel rename"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                /* Normal workspace row */
                <>
                  <button
                    onClick={() => {
                      setActive(ws.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex-1 flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors truncate',
                      activeId === ws.id
                        ? 'text-[#6bd5ff]'
                        : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block w-1.5 h-1.5 rounded-full shrink-0',
                        activeId === ws.id ? 'bg-[#6bd5ff]' : 'bg-[#c7c4d7]/20'
                      )}
                    />
                    <span className="truncate">{ws.name}</span>
                    <span className="text-[9px] text-[var(--on-surface-variant)]/40 ml-auto tabular-nums shrink-0">
                      {ws.connectionIds.length}
                    </span>
                  </button>
                  <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100">
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        startRename(ws.id, ws.name)
                      }}
                      className="p-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                      aria-label="Rename workspace"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`Delete workspace "${ws.name}"?`)) {
                          deleteWorkspace(ws.id)
                        }
                      }}
                      className="p-1 text-[var(--on-surface-variant)] hover:text-[var(--error)]"
                      aria-label="Delete workspace"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          <div className="h-[1px] bg-[rgba(199,196,215,0.08)] my-1 mx-2" />

          {creating ? (
            <div className="flex items-center gap-1 px-2 py-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') setCreating(false)
                }}
                placeholder="Workspace name"
                className="flex-1 bg-[var(--surface-container-highest)] rounded-[var(--radius)] px-2 py-1 text-[10px] text-[var(--on-surface)] outline-none"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="text-[10px] text-[#6bd5ff] px-1 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/30 transition-colors"
            >
              <Plus size={12} />
              New Workspace
            </button>
          )}
        </div>
      )}
    </div>
  )
}
