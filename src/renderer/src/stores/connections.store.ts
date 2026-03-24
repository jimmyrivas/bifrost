import { create } from 'zustand'

export interface Connection {
  id: string
  groupId: string | null
  name: string
  method: 'ssh' | 'mosh' | 'rdp' | 'vnc' | 'telnet' | 'local' | 'ftp'
  host: string | null
  port: number | null
  authType: 'userpass' | 'key' | 'key_pass' | 'manual' | null
  username: string | null
  sortOrder: number
  sshConfig?: string | null // JSON: includes tags and SSH options
}

export interface Group {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  icon: string | null
}

export interface RecentConnection {
  id: string
  timestamp: number
}

const FAVORITES_KEY = 'bifrost:favorites'
const RECENTS_KEY = 'bifrost:recents'
const MAX_RECENTS = 10

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveFavorites(ids: string[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
}

function loadRecents(): RecentConnection[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecents(recents: RecentConnection[]): void {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents))
}

interface ConnectionsState {
  connections: Connection[]
  groups: Group[]
  loading: boolean
  selectedConnectionId: string | null
  favorites: string[]
  recentConnections: RecentConnection[]

  fetchConnections: () => Promise<void>
  fetchGroups: () => Promise<void>
  setSelectedConnection: (id: string | null) => void
  createConnection: (data: Omit<Connection, 'id' | 'sortOrder'>) => Promise<string>
  updateConnection: (id: string, data: Partial<Connection>) => Promise<void>
  deleteConnection: (id: string) => Promise<void>
  createGroup: (data: Omit<Group, 'id' | 'sortOrder'>) => Promise<string>
  updateGroup: (id: string, data: Partial<Group>) => Promise<void>
  deleteGroup: (id: string) => Promise<void>
  toggleFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
  addRecent: (id: string) => void
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  connections: [],
  groups: [],
  loading: false,
  selectedConnectionId: null,
  favorites: loadFavorites(),
  recentConnections: loadRecents(),

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
    // Also remove from favorites if present
    const favorites = get().favorites.filter((fid) => fid !== id)
    saveFavorites(favorites)
    const recentConnections = get().recentConnections.filter((r) => r.id !== id)
    saveRecents(recentConnections)
    set({ connections: connections as Connection[], selectedConnectionId: null, favorites, recentConnections })
  },

  createGroup: async (data) => {
    const id = await window.bifrost.connections.createGroup(data as Parameters<typeof window.bifrost.connections.createGroup>[0])
    const groups = await window.bifrost.connections.listGroups()
    set({ groups: groups as Group[] })
    return id
  },

  updateGroup: async (id, data) => {
    await window.bifrost.connections.updateGroup(id, data)
    const groups = await window.bifrost.connections.listGroups()
    set({ groups: groups as Group[] })
  },

  deleteGroup: async (id) => {
    await window.bifrost.connections.deleteGroup(id)
    const groups = await window.bifrost.connections.listGroups()
    set({ groups: groups as Group[] })
  },

  toggleFavorite: (id: string) => {
    const { favorites } = get()
    const next = favorites.includes(id)
      ? favorites.filter((fid) => fid !== id)
      : [...favorites, id]
    saveFavorites(next)
    set({ favorites: next })
  },

  isFavorite: (id: string) => {
    return get().favorites.includes(id)
  },

  addRecent: (id: string) => {
    const { recentConnections } = get()
    const filtered = recentConnections.filter((r) => r.id !== id)
    const next = [{ id, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENTS)
    saveRecents(next)
    set({ recentConnections: next })
  }
}))
