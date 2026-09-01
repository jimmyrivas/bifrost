import { create } from 'zustand'

export interface DownloadRecord {
  id: string
  name: string
  remotePath: string
  localPath: string
  size: number
  host: string
  timestamp: number
}

const STORAGE_KEY = 'bifrost:downloads'
const MAX = 200

function load(): DownloadRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DownloadRecord[]) : []
  } catch {
    return []
  }
}

function save(items: DownloadRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX)))
  } catch {
    /* storage full/unavailable — history is best-effort */
  }
}

interface DownloadsState {
  downloads: DownloadRecord[]
  /** Record one or more downloaded files (most recent first). */
  addDownloads: (records: Array<Omit<DownloadRecord, 'id' | 'timestamp'>>) => void
  clear: () => void
  remove: (id: string) => void
}

let counter = 0
const newId = (): string => `dl-${Date.now()}-${++counter}`

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  downloads: load(),
  addDownloads: (records) => {
    if (records.length === 0) return
    const now = Date.now()
    const added: DownloadRecord[] = records.map((r) => ({ ...r, id: newId(), timestamp: now }))
    const next = [...added, ...get().downloads].slice(0, MAX)
    save(next)
    set({ downloads: next })
  },
  clear: () => {
    save([])
    set({ downloads: [] })
  },
  remove: (id) => {
    const next = get().downloads.filter((d) => d.id !== id)
    save(next)
    set({ downloads: next })
  }
}))
