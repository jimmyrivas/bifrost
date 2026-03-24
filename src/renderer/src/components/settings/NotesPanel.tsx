import { useState, useEffect, useCallback } from 'react'
import {
  Search, Trash2, Copy, StickyNote, AlertTriangle, Terminal, Bot,
  Play, Camera, X, Filter
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface SessionNote {
  id: string
  content: string
  connectionId: string | null
  connectionName: string
  host: string
  user: string
  tag: string
  tabTitle: string
  createdAt: string
}

const TAG_CONFIG: Record<string, { label: string; icon: typeof StickyNote; color: string }> = {
  note: { label: 'Note', icon: StickyNote, color: 'text-[#6bd5ff]' },
  evidence: { label: 'Evidence', icon: Camera, color: 'text-[#22c55e]' },
  command: { label: 'Command', icon: Play, color: 'text-[#ffa36b]' },
  error: { label: 'Error', icon: AlertTriangle, color: 'text-[var(--error)]' },
  prompt: { label: 'AI Prompt', icon: Bot, color: 'text-[#d56bff]' },
  'ai-conversation': { label: 'AI Session', icon: Bot, color: 'text-[#d56bff]' },
  'session-summary': { label: 'Summary', icon: Terminal, color: 'text-[#6bff6b]' }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function NotesPanel(): JSX.Element {
  const [notes, setNotes] = useState<SessionNote[]>([])
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadNotes = useCallback(async () => {
    try {
      if (search.trim()) {
        const results = await window.bifrost.notes.search(search)
        setNotes(results)
      } else if (tagFilter) {
        const results = await window.bifrost.notes.list(tagFilter)
        setNotes(results)
      } else {
        const results = await window.bifrost.notes.list()
        setNotes(results)
      }
    } catch { setNotes([]) }
  }, [search, tagFilter])

  useEffect(() => { loadNotes() }, [loadNotes])

  const handleDelete = useCallback(async (id: string) => {
    await window.bifrost.notes.delete(id)
    loadNotes()
  }, [loadNotes])

  const handleCopy = useCallback(async (note: SessionNote) => {
    await navigator.clipboard.writeText(note.content)
    setCopiedId(note.id)
    setTimeout(() => setCopiedId(null), 1500)
  }, [])

  const tags = Object.keys(TAG_CONFIG)

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h2 className="text-lg font-semibold text-[var(--on-surface)]">Session Notes</h2>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] mt-1">
          SAVED FROM TERMINAL SESSIONS
        </p>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2 shrink-0">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#c7c4d7]/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-[var(--surface-container-highest)] rounded-[var(--radius)] text-[var(--on-surface)] placeholder-[#c7c4d7]/30 outline-none ghost-border focus:border-[#6bd5ff]/30"
          />
        </div>
        <div className="flex gap-0.5">
          <button
            onClick={() => setTagFilter(null)}
            className={cn(
              'px-2 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-[var(--radius)] transition-colors',
              !tagFilter ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]' : 'text-[#c7c4d7]/40 hover:text-[#c7c4d7]/70'
            )}
          >
            All
          </button>
          {tags.map((t) => {
            const cfg = TAG_CONFIG[t]
            const Icon = cfg.icon
            return (
              <button
                key={t}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className={cn(
                  'px-1.5 py-1 rounded-[var(--radius)] transition-colors',
                  tagFilter === t ? 'bg-[var(--surface-container-highest)]' : 'hover:bg-[var(--surface-container-high)]/50'
                )}
                title={cfg.label}
              >
                <Icon size={12} className={tagFilter === t ? cfg.color : 'text-[#c7c4d7]/30'} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {notes.length === 0 && (
          <div className="text-center py-12 text-xs text-[#c7c4d7]/40">
            <StickyNote size={24} className="mx-auto mb-2 text-[#c7c4d7]/20" />
            <p>No notes yet</p>
            <p className="text-[10px] mt-1">Select text in a terminal, right-click, and choose &quot;Save as Note&quot;</p>
          </div>
        )}
        {notes.map((note) => {
          const cfg = TAG_CONFIG[note.tag] ?? TAG_CONFIG.note
          const TagIcon = cfg.icon
          return (
            <div
              key={note.id}
              className="rounded-[var(--radius)] bg-[var(--surface-container-high)] overflow-hidden group"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-container-highest)]">
                <div className="flex items-center gap-2 min-w-0">
                  <TagIcon size={11} className={cfg.color} />
                  <span className={cn('text-[9px] font-semibold uppercase tracking-wider', cfg.color)}>
                    {cfg.label}
                  </span>
                  {note.connectionName && (
                    <span className="text-[9px] text-[#c7c4d7]/40 truncate">
                      {note.user ? `${note.user}@` : ''}{note.host || note.connectionName}
                    </span>
                  )}
                  {note.tabTitle && !note.connectionName && (
                    <span className="text-[9px] text-[#c7c4d7]/40 truncate">{note.tabTitle}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-[#c7c4d7]/30">{formatDate(note.createdAt)}</span>
                  <button
                    onClick={() => handleCopy(note)}
                    className="p-0.5 text-[#c7c4d7]/30 hover:text-[var(--on-surface)] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy to clipboard"
                  >
                    {copiedId === note.id ? <StickyNote size={11} className="text-[#22c55e]" /> : <Copy size={11} />}
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="p-0.5 text-[#c7c4d7]/30 hover:text-[var(--error)] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete note"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              {/* Content */}
              <pre className="px-3 py-2 text-[11px] text-[var(--on-surface)] font-[family-name:var(--font-mono)] leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                {note.content}
              </pre>
            </div>
          )
        })}
      </div>

      {/* Footer stats */}
      {notes.length > 0 && (
        <div className="shrink-0 text-[10px] text-[#c7c4d7]/30">
          {notes.length} note{notes.length !== 1 ? 's' : ''}
          {tagFilter && ` (filtered: ${TAG_CONFIG[tagFilter]?.label})`}
        </div>
      )}
    </div>
  )
}
