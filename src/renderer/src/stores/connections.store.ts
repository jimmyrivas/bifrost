import { create } from 'zustand'

export interface Connection {
  id: string
  groupId: string | null
  name: string
  method: 'ssh' | 'rdp' | 'vnc' | 'telnet' | 'local' | 'ftp'
  host: string | null
  port: number | null
  authType: 'userpass' | 'key' | 'key_pass' | 'manual' | null
  username: string | null
  sortOrder: number
}

export interface Group {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  icon: string | null
}

interface ConnectionsState {
  connections: Connection[]
  groups: Group[]
  loading: boolean
  selectedConnectionId: string | null

  fetchConnections: () => Promise<void>
  fetchGroups: () => Promise<void>
  setSelectedConnection: (id: string | null) => void
  createConnection: (data: Omit<Connection, 'id' | 'sortOrder'>) => Promise<string>
  updateConnection: (id: string, data: Partial<Connection>) => Promise<void>
  deleteConnection: (id: string) => Promise<void>
  createGroup: (data: Omit<Group, 'id' | 'sortOrder'>) => Promise<string>
  deleteGroup: (id: string) => Promise<void>
}

export const useConnectionsStore = create<ConnectionsState>((set) => ({
  connections: [],
  groups: [],
  loading: false,
  selectedConnectionId: null,

  fetchConnections: async () => {
    set({ loading: true })
    const connections = await window.bifrost.connections.list()
    set({ connections: connections as Connection[], loading: false })
  },

  fetchGroups: async () => {
    const groups = await window.bifrost.connections.listGroups()
    set({ groups: groups as Group[] })
  },

  setSelectedConnection: (id) => set({ selectedConnectionId: id }),

  createConnection: async (data) => {
    const id = await window.bifrost.connections.create(data as Parameters<typeof window.bifrost.connections.create>[0])
    const connections = await window.bifrost.connections.list()
    set({ connections: connections as Connection[] })
    return id
  },

  updateConnection: async (id, data) => {
    await window.bifrost.connections.update(id, data)
    const connections = await window.bifrost.connections.list()
    set({ connections: connections as Connection[] })
  },

  deleteConnection: async (id) => {
    await window.bifrost.connections.delete(id)
    const connections = await window.bifrost.connections.list()
    set({ connections: connections as Connection[], selectedConnectionId: null })
  },

  createGroup: async (data) => {
    const id = await window.bifrost.connections.createGroup(data as Parameters<typeof window.bifrost.connections.createGroup>[0])
    const groups = await window.bifrost.connections.listGroups()
    set({ groups: groups as Group[] })
    return id
  },

  deleteGroup: async (id) => {
    await window.bifrost.connections.deleteGroup(id)
    const groups = await window.bifrost.connections.listGroups()
    set({ groups: groups as Group[] })
  }
}))
