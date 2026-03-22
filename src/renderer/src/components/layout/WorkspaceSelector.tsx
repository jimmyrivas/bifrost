import { useState, useCallback, useRef, useEffect } from 'react'
import { ChevronDown, Plus, Trash2, Pencil } from 'lucide-react'
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
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeWorkspace = workspaces.find((w) => w.id === activeId)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
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

  const handleRename = useCallback(
    (id: string, currentName: string) => {
      const name = window.prompt('Rename workspace:', currentName)
      if (name && name !== currentName) {
        renameWorkspace(id, name)
      }
    },
    [renameWorkspace]
  )

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius)] text-xs transition-colors',
          'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#1b1b1e]'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate max-w-[120px]">
          {activeWorkspace?.name ?? 'All Connections'}
        </span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--surface-container-high)] rounded-[var(--radius)] shadow-lg z-50 py-1">
          {/* All connections */}
          <button
            onClick={() => {
              setActive(null)
              setOpen(false)
            }}
            className={cn(
              'w-full flex items-center px-3 py-1.5 text-xs text-left transition-colors',
              !activeId
                ? 'text-[var(--on-surface)] bg-[var(--surface-container-highest)]/50'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/30'
            )}
          >
            All Connections
          </button>

          {workspaces.length > 0 && (
            <div className="h-[1px] bg-[var(--surface-container-highest)] my-1 mx-2" />
          )}

          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={cn(
                'flex items-center group',
                activeId === ws.id && 'bg-[var(--surface-container-highest)]/50'
              )}
            >
              <button
                onClick={() => {
                  setActive(ws.id)
                  setOpen(false)
                }}
                className="flex-1 px-3 py-1.5 text-xs text-left text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors truncate"
              >
                {ws.name}
                <span className="text-[9px] text-[var(--on-surface-variant)]/50 ml-1.5">
                  {ws.connectionIds.length}
                </span>
              </button>
              <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRename(ws.id, ws.name)
                  }}
                  className="p-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                  aria-label="Rename workspace"
                >
                  <Pencil size={10} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteWorkspace(ws.id)
                  }}
                  className="p-1 text-[var(--on-surface-variant)] hover:text-[var(--error)]"
                  aria-label="Delete workspace"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}

          <div className="h-[1px] bg-[var(--surface-container-highest)] my-1 mx-2" />

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
