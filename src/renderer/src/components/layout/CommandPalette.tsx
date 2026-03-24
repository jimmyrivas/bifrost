import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Terminal, Monitor, Tv, Radio, Laptop, Search, Star, Clock, Zap, Code2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useConnectionsStore, type Connection } from '@renderer/stores/connections.store'
import { getFallbackSuggestions } from '@renderer/lib/command-suggestions'

const SPECTRAL_GRADIENT =
  'linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff)'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onConnect: (connectionId: string) => void
}

interface SearchResult {
  connection: Connection
  groupPath: string
  isFavorite: boolean
  isRecent: boolean
  score: number
}

function fuzzyMatch(text: string, query: string): { matches: boolean; score: number } {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Exact substring match scores highest
  if (lowerText.includes(lowerQuery)) {
    const idx = lowerText.indexOf(lowerQuery)
    // Prefix match scores higher
    const score = idx === 0 ? 100 : 80
    return { matches: true, score }
  }

  // Fuzzy character-by-character match
  let queryIdx = 0
  let score = 0
  let lastMatchIdx = -1

  for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIdx]) {
      score += 10
      // Consecutive matches score higher
      if (lastMatchIdx === i - 1) score += 5
      // Match at word boundary scores higher
      if (i === 0 || lowerText[i - 1] === ' ' || lowerText[i - 1] === '.' || lowerText[i - 1] === '-') {
        score += 3
      }
      lastMatchIdx = i
      queryIdx++
    }
  }

  if (queryIdx === lowerQuery.length) {
    return { matches: true, score }
  }

  return { matches: false, score: 0 }
}

function MethodIcon({ method, className }: { method: string; className?: string }): JSX.Element {
  const props = { size: 14, strokeWidth: 1.5, className: cn('shrink-0', className) }
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

export function CommandPalette({ open, onClose, onConnect }: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const connections = useConnectionsStore((s) => s.connections)
  const groups = useConnectionsStore((s) => s.groups)
  const favorites = useConnectionsStore((s) => s.favorites)
  const recentConnections = useConnectionsStore((s) => s.recentConnections)
  const addRecent = useConnectionsStore((s) => s.addRecent)

  // Build group path map
  const groupPathMap = useMemo(() => {
    const map = new Map<string, string>()
    const buildPath = (groupId: string): string => {
      if (map.has(groupId)) return map.get(groupId)!
      const group = groups.find((g) => g.id === groupId)
      if (!group) return ''
      const parentPath = group.parentId ? buildPath(group.parentId) : ''
      const path = parentPath ? `${parentPath} / ${group.name}` : group.name
      map.set(groupId, path)
      return path
    }
    groups.forEach((g) => buildPath(g.id))
    return map
  }, [groups])

  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) {
      // Show favorites first, then recents
      const favConns = connections
        .filter((c) => favorites.includes(c.id))
        .map((c) => ({
          connection: c,
          groupPath: c.groupId ? groupPathMap.get(c.groupId) ?? '' : '',
          isFavorite: true,
          isRecent: false,
          score: 200
        }))

      const recentIds = recentConnections.map((r) => r.id)
      const recentConns = recentConnections
        .map((r) => connections.find((c) => c.id === r.id))
        .filter((c): c is Connection => c != null && !favorites.includes(c.id))
        .map((c) => ({
          connection: c,
          groupPath: c.groupId ? groupPathMap.get(c.groupId) ?? '' : '',
          isFavorite: false,
          isRecent: true,
          score: 150
        }))

      const rest = connections
        .filter((c) => !favorites.includes(c.id) && !recentIds.includes(c.id))
        .map((c) => ({
          connection: c,
          groupPath: c.groupId ? groupPathMap.get(c.groupId) ?? '' : '',
          isFavorite: false,
          isRecent: false,
          score: 0
        }))

      return [...favConns, ...recentConns, ...rest]
    }

    const scored: SearchResult[] = []
    for (const conn of connections) {
      const groupPath = conn.groupId ? groupPathMap.get(conn.groupId) ?? '' : ''
      const isFav = favorites.includes(conn.id)

      // Match against name, host, group path
      const nameMatch = fuzzyMatch(conn.name, query)
      const hostMatch = conn.host ? fuzzyMatch(conn.host, query) : { matches: false, score: 0 }
      const groupMatch = groupPath ? fuzzyMatch(groupPath, query) : { matches: false, score: 0 }

      if (nameMatch.matches || hostMatch.matches || groupMatch.matches) {
        const bestScore = Math.max(nameMatch.score, hostMatch.score, groupMatch.score)
        scored.push({
          connection: conn,
          groupPath,
          isFavorite: isFav,
          isRecent: recentConnections.some((r) => r.id === conn.id),
          score: bestScore + (isFav ? 10 : 0)
        })
      }
    }

    return scored.sort((a, b) => b.score - a.score)
  }, [query, connections, groups, favorites, recentConnections, groupPathMap])

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleSelect = useCallback(
    (connectionId: string) => {
      addRecent(connectionId)
      onConnect(connectionId)
      onClose()
    },
    [addRecent, onConnect, onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex].connection.id)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [results, selectedIndex, handleSelect, onClose]
  )

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (open) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0d0d0f]/60 backdrop-blur-[32px]" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-[0.25rem] bg-[#2a2a2d] shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Spectral thread at top */}
        <div className="h-[1px] w-full" style={{ background: SPECTRAL_GRADIENT }} />

        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <Search size={16} strokeWidth={1.5} className="text-[#c7c4d7]/60 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search connections..."
            className="flex-1 bg-transparent text-sm text-[#e6e1e5] placeholder-[#c7c4d7]/40 outline-none font-[var(--font-ui)]"
            aria-label="Search connections"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="text-[10px] text-[#c7c4d7]/40 font-mono px-1.5 py-0.5 rounded-[0.25rem] bg-[#1b1b1e]">
            Esc
          </kbd>
        </div>

        {/* Ghost border separator */}
        <div className="mx-3 h-[1px] bg-[#39393c]/15" />

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto py-1.5"
          role="listbox"
          aria-label="Search results"
        >
          {results.length === 0 && query && !getFallbackSuggestions(query).length && (
            <div className="px-4 py-6 text-xs text-[#c7c4d7]/40 text-center">
              No results found
            </div>
          )}
          {results.map((result, index) => (
            <button
              key={result.connection.id}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                index === selectedIndex
                  ? 'bg-[#39393c]/20 text-[#e6e1e5]'
                  : 'text-[#c7c4d7] hover:bg-[#39393c]/10'
              )}
              onClick={() => handleSelect(result.connection.id)}
              onMouseEnter={() => setSelectedIndex(index)}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <MethodIcon
                method={result.connection.method}
                className={index === selectedIndex ? 'text-[#6bd5ff]' : 'text-[#c7c4d7]/50'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm truncate font-[var(--font-ui)]">
                    {query ? (
                      <HighlightMatch text={result.connection.name} query={query} />
                    ) : (
                      result.connection.name
                    )}
                  </span>
                  {result.isFavorite && (
                    <Star size={10} strokeWidth={0} fill="#ffd56b" className="shrink-0" />
                  )}
                  {result.isRecent && !result.isFavorite && (
                    <Clock size={10} strokeWidth={1.5} className="shrink-0 text-[#c7c4d7]/30" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#c7c4d7]/40">
                  {result.connection.host && (
                    <span className="truncate">
                      {result.connection.username ? `${result.connection.username}@` : ''}
                      {query ? (
                        <HighlightMatch text={result.connection.host} query={query} />
                      ) : (
                        result.connection.host
                      )}
                    </span>
                  )}
                  {result.connection.host && result.groupPath && (
                    <span className="text-[#c7c4d7]/20">|</span>
                  )}
                  {result.groupPath && (
                    <span className="truncate">{result.groupPath}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-[#c7c4d7]/25 uppercase tracking-wider shrink-0">
                {result.connection.method}
              </span>
            </button>
          ))}

          {/* Snippet/Command suggestions when query matches */}
          {query.trim() && (() => {
            const snippets = getFallbackSuggestions(query)
            if (snippets.length === 0) return null
            return (
              <>
                <div className="px-4 py-1.5 text-[9px] font-semibold tracking-[0.1em] uppercase text-[#c7c4d7]/30">
                  COMMANDS
                </div>
                {snippets.slice(0, 5).map((s, i) => (
                  <button
                    key={`snippet-${i}`}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left text-[#c7c4d7] hover:bg-[#39393c]/10 transition-colors"
                    onClick={() => {
                      // Copy command to clipboard
                      navigator.clipboard.writeText(s.command)
                      onClose()
                    }}
                  >
                    <Code2 size={14} strokeWidth={1.5} className="shrink-0 text-[#6bd5ff]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-[family-name:var(--font-mono)] text-[#e6e1e5] truncate">{s.command}</div>
                      <div className="text-[11px] text-[#c7c4d7]/40 truncate">{s.description}</div>
                    </div>
                  </button>
                ))}
              </>
            )
          })()}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[#39393c]/15">
          <span className="flex items-center gap-1 text-[10px] text-[#c7c4d7]/30">
            <kbd className="font-mono px-1 py-[1px] rounded-[2px] bg-[#1b1b1e]">Enter</kbd>
            connect
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[#c7c4d7]/30">
            <kbd className="font-mono px-1 py-[1px] rounded-[2px] bg-[#1b1b1e]">&uarr;&darr;</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[#c7c4d7]/30">
            <kbd className="font-mono px-1 py-[1px] rounded-[2px] bg-[#1b1b1e]">Esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}

function HighlightMatch({ text, query }: { text: string; query: string }): JSX.Element {
  if (!query) return <>{text}</>
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="text-[#6bd5ff]">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}
