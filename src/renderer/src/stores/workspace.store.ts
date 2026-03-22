import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Workspace {
  id: string
  name: string
  connectionIds: string[]
}

interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null

  createWorkspace: (name: string) => string
  deleteWorkspace: (id: string) => void
  renameWorkspace: (id: string, name: string) => void
  setActiveWorkspace: (id: string | null) => void
  addConnectionToWorkspace: (workspaceId: string, connectionId: string) => void
  removeConnectionFromWorkspace: (workspaceId: string, connectionId: string) => void
  getActiveConnectionFilter: () => string[] | null
}

let idCounter = 0
function newWorkspaceId(): string {
  return `ws-${Date.now()}-${++idCounter}`
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,

      createWorkspace: (name: string) => {
        const id = newWorkspaceId()
        set((state) => ({
          workspaces: [...state.workspaces, { id, name, connectionIds: [] }]
        }))
        return id
      },

      deleteWorkspace: (id: string) => {
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
          activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId
        }))
      },

      renameWorkspace: (id: string, name: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, name } : w))
        }))
      },

      setActiveWorkspace: (id: string | null) => {
        set({ activeWorkspaceId: id })
      },

      addConnectionToWorkspace: (workspaceId: string, connectionId: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId && !w.connectionIds.includes(connectionId)
              ? { ...w, connectionIds: [...w.connectionIds, connectionId] }
              : w
          )
        }))
      },

      removeConnectionFromWorkspace: (workspaceId: string, connectionId: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, connectionIds: w.connectionIds.filter((id) => id !== connectionId) }
              : w
          )
        }))
      },

      getActiveConnectionFilter: () => {
        const { workspaces, activeWorkspaceId } = get()
        if (!activeWorkspaceId) return null
        const ws = workspaces.find((w) => w.id === activeWorkspaceId)
        return ws?.connectionIds ?? null
      }
    }),
    {
      name: 'bifrost-workspaces',
      version: 1
    }
  )
)
