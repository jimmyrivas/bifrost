import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Download,
  FolderOpen,
  ListFilter,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  X,
  Zap,
  ShieldAlert,
  Video,
  HardDrive
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import {
  categoryOf,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_OF_EVENT,
  type AuditCategory
} from '@renderer/lib/audit-categories'
import {
  useCaptureFiles,
  CaptureFileList
} from '@renderer/components/terminal/CaptureFilesBrowser'
import { useCaptureStore } from '@renderer/stores/capture.store'
import type { AuditEvent, AuditEventType } from '../../../../main/services/audit-log'

type Range = '24h' | '7d' | '30d'
const RANGE_MS: Record<Range, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
}
const QUERY_LIMIT = 2000
const LIVE_POLL_MS = 5000

const CATEGORY_ORDER: AuditCategory[] = [
  'sessions',
  'auth',
  'security',
  'tunnels',
  'captures',
  'automation',
  'errors',
  'other'
]

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

interface ActivityCenterProps {
  /** Pre-filter the timeline to one connection (deep link from ConnectionStats). */
  initialConnectionId?: string | null
}

/**
 * The sidebar "Activity" view: an audit-log timeline with category filters,
 * search, live refresh, insights counters, export/rotate maintenance, and a
 * Captures tab reusing the capture-files lists.
 */
export function ActivityCenter({ initialConnectionId }: ActivityCenterProps): JSX.Element {
  const [tab, setTab] = useState<'timeline' | 'captures'>('timeline')
  const [range, setRange] = useState<Range>('7d')
  const [activeCategories, setActiveCategories] = useState<Set<AuditCategory>>(new Set())
  const [search, setSearch] = useState('')
  const [connectionFilter, setConnectionFilter] = useState<{ id: string; name: string } | null>(null)
  const [live, setLive] = useState(true)
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [logSize, setLogSize] = useState(0)
  const [connectsToday, setConnectsToday] = useState(0)
  const [authFails7d, setAuthFails7d] = useState(0)
  const [toast, setToast] = useState<{ message: string; filePath?: string } | null>(null)

  // Active-capture counters (primitive selectors — safe re-render behavior).
  const recordingCount = useCaptureStore((s) => Object.keys(s.recordings).length)
  const loggingCount = useCaptureStore((s) => Object.keys(s.logs).length)

  const captures = useCaptureFiles(tab === 'captures')

  useEffect(() => {
    if (initialConnectionId) {
      setConnectionFilter({ id: initialConnectionId, name: initialConnectionId })
      setTab('timeline')
    }
  }, [initialConnectionId])

  const showToast = useCallback((message: string, filePath?: string) => {
    setToast({ message, filePath })
    setTimeout(() => setToast(null), 6000)
  }, [])

  const sinceIso = useCallback(
    (): string => new Date(Date.now() - RANGE_MS[range]).toISOString(),
    [range]
  )

  const refresh = useCallback(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    window.bifrost?.audit
      ?.query({
        since: sinceIso(),
        limit: QUERY_LIMIT,
        connectionId: connectionFilter?.id
      })
      .then((list: AuditEvent[]) => setEvents(list ?? []))
      .catch(() => setEvents([]))
    window.bifrost?.audit
      ?.query({ event: 'connect', since: startOfToday.toISOString(), limit: QUERY_LIMIT })
      .then((l: AuditEvent[]) => setConnectsToday(l?.length ?? 0))
      .catch(() => setConnectsToday(0))
    window.bifrost?.audit
      ?.query({
        event: 'auth_fail',
        since: new Date(Date.now() - RANGE_MS['7d']).toISOString(),
        limit: QUERY_LIMIT
      })
      .then((l: AuditEvent[]) => setAuthFails7d(l?.length ?? 0))
      .catch(() => setAuthFails7d(0))
    window.bifrost?.audit
      ?.getLogSize()
      .then(setLogSize)
      .catch(() => setLogSize(0))
  }, [sinceIso, connectionFilter])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Live polling while the timeline is visible.
  useEffect(() => {
    if (!live || tab !== 'timeline') return
    const id = setInterval(refresh, LIVE_POLL_MS)
    return () => clearInterval(id)
  }, [live, tab, refresh])

  const toggleCategory = useCallback((cat: AuditCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  // Client-side filtering (categories + search) over the fetched window.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter((e) => {
      if (activeCategories.size > 0 && !activeCategories.has(categoryOf(e.event))) return false
      if (q && !e.connectionName.toLowerCase().includes(q) && !e.host.toLowerCase().includes(q))
        return false
      return true
    })
  }, [events, activeCategories, search])

  // Newest first, grouped by day.
  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const groups: { label: string; items: AuditEvent[] }[] = []
    for (const e of sorted) {
      const label = dayLabel(e.timestamp)
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.items.push(e)
      else groups.push({ label, items: [e] })
    }
    return groups
  }, [filtered])

  const exportFiltered = useCallback(
    async (format: 'csv' | 'jsonl') => {
      const stamp = new Date().toISOString().slice(0, 10)
      const filePath = await window.bifrost.window.showSaveDialog(`bifrost-activity-${stamp}.${format}`)
      if (!filePath) return
      const eventTypes =
        activeCategories.size > 0
          ? (Object.keys(CATEGORY_OF_EVENT) as AuditEventType[]).filter((t) =>
              activeCategories.has(categoryOf(t))
            )
          : undefined
      try {
        const count = await window.bifrost.audit.export(
          {
            connectionId: connectionFilter?.id,
            since: sinceIso(),
            limit: QUERY_LIMIT,
            eventTypes,
            search: search.trim() || undefined
          },
          filePath,
          format
        )
        showToast(`Exported ${count} event${count === 1 ? '' : 's'}`, filePath)
      } catch {
        showToast('Export failed')
      }
    },
    [activeCategories, connectionFilter, sinceIso, search, showToast]
  )

  const handleRotate = useCallback(async () => {
    if (!window.confirm('Rotate the audit log now? Entries older than 30 days will be removed.')) return
    try {
      await window.bifrost.audit.rotate()
      refresh()
      showToast('Audit log rotated')
    } catch {
      showToast('Rotate failed')
    }
  }, [refresh, showToast])

  const chip = (cat: AuditCategory): JSX.Element => {
    const active = activeCategories.has(cat)
    return (
      <button
        key={cat}
        onClick={() => toggleCategory(cat)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-0.5 text-[10px] rounded-[var(--radius)] transition-colors',
          active ? 'bg-[#2a2a2d] text-[var(--on-surface)]' : 'text-[#c7c4d7]/50 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d]/60'
        )}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: CATEGORY_COLORS[cat], opacity: active ? 1 : 0.45 }}
        />
        {CATEGORY_LABELS[cat]}
      </button>
    )
  }

  const stat = (icon: JSX.Element, value: string, label: string, accent?: string): JSX.Element => (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius)] bg-[#1b1b1e]">
      <span style={accent ? { color: accent } : undefined} className="text-[#c7c4d7]/60">
        {icon}
      </span>
      <span className="text-sm font-semibold text-[var(--on-surface)]">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-[#c7c4d7]/50">{label}</span>
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Insights header */}
      <div className="flex items-center gap-2 flex-wrap px-4 pt-4 pb-3">
        <Activity size={16} className="text-[#6bd5ff]" />
        <span className="text-sm font-semibold text-[var(--on-surface)] mr-2">Activity</span>
        {stat(<Zap size={13} />, String(connectsToday), 'connects today')}
        {stat(
          <ShieldAlert size={13} />,
          String(authFails7d),
          'auth fails · 7d',
          authFails7d > 0 ? '#ef4444' : undefined
        )}
        {stat(
          <Video size={13} />,
          String(recordingCount + loggingCount),
          'captures active',
          recordingCount + loggingCount > 0 ? '#ef4444' : undefined
        )}
        {stat(<HardDrive size={13} />, humanSize(logSize), 'audit log')}
        <div className="flex-1" />
        <button
          onClick={handleRotate}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[#c7c4d7] hover:text-[var(--on-surface)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
          title="Remove audit entries older than 30 days"
        >
          <RotateCcw size={12} /> Rotate
        </button>
        <button
          onClick={() => exportFiltered('csv')}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[#c7c4d7] hover:text-[#6bd5ff] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
          title="Export the filtered events as CSV"
        >
          <Download size={12} /> CSV
        </button>
        <button
          onClick={() => exportFiltered('jsonl')}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[#c7c4d7] hover:text-[#6bd5ff] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
          title="Export the filtered events as JSON Lines"
        >
          <Download size={12} /> JSONL
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pb-2">
        <button
          onClick={() => setTab('timeline')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-[var(--radius)]',
            tab === 'timeline'
              ? 'bg-[#2a2a2d] text-[var(--on-surface)] font-semibold'
              : 'text-[#c7c4d7]/60 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d]/60'
          )}
        >
          <ListFilter size={12} /> Timeline
        </button>
        <button
          onClick={() => setTab('captures')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-[var(--radius)]',
            tab === 'captures'
              ? 'bg-[#2a2a2d] text-[var(--on-surface)] font-semibold'
              : 'text-[#c7c4d7]/60 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d]/60'
          )}
        >
          <Clapperboard size={12} /> Captures
        </button>
      </div>

      {tab === 'timeline' && (
        <>
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap px-4 pb-2">
            <div className="flex items-center gap-1.5 h-7 px-2 rounded-[var(--radius)] bg-[var(--surface-container-highest)] ghost-border">
              <Search size={12} className="text-[#c7c4d7]/40 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by connection or host…"
                className="bg-transparent outline-none text-xs text-[var(--on-surface)] w-48 placeholder:text-[#c7c4d7]/30"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-[#c7c4d7]/40 hover:text-[var(--on-surface)]">
                  <X size={11} />
                </button>
              )}
            </div>
            {CATEGORY_ORDER.map(chip)}
            <div className="flex-1" />
            {(['24h', '7d', '30d'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-2 py-0.5 text-[10px] rounded-[var(--radius)]',
                  range === r
                    ? 'bg-[#2a2a2d] text-[var(--on-surface)] font-semibold'
                    : 'text-[#c7c4d7]/50 hover:text-[var(--on-surface)]'
                )}
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => setLive((v) => !v)}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-[var(--radius)]',
                live ? 'text-[#22c55e]' : 'text-[#c7c4d7]/50 hover:text-[var(--on-surface)]'
              )}
              title={live ? 'Live refresh on (every 5s)' : 'Live refresh off'}
            >
              <span className={cn('inline-block w-1.5 h-1.5 rounded-full', live ? 'bg-[#22c55e] animate-pulse' : 'bg-[#c7c4d7]/30')} />
              live
            </button>
            <button
              onClick={refresh}
              className="p-1 text-[#c7c4d7]/60 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
              title="Refresh now"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {/* Connection drill-down chip */}
          {connectionFilter && (
            <div className="px-4 pb-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] rounded-[var(--radius)] bg-[#6bd5ff]/10 text-[#6bd5ff]">
                connection: {connectionFilter.name}
                <button onClick={() => setConnectionFilter(null)} className="hover:text-[var(--on-surface)]">
                  <X size={10} />
                </button>
              </span>
            </div>
          )}

          {/* Overflow notice */}
          {events.length >= QUERY_LIMIT && (
            <div className="px-4 pb-1 text-[10px] text-[#ffa36b]/80">
              Showing the latest {QUERY_LIMIT} events in this range — narrow the range or filters to see older ones.
            </div>
          )}

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4">
            {grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#c7c4d7]/40">
                <Activity size={22} className="text-[#c7c4d7]/30" />
                <p className="text-xs">No activity matches the current filters</p>
                <p className="text-[11px] max-w-md text-center">
                  The timeline records connections, authentication, host-key events, tunnels,
                  captures, automation hooks, and errors from the audit log. Connect to something
                  and it will show up here.
                </p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.label}>
                  <div className="sticky top-0 py-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase text-[#c7c4d7]/45 bg-[#131316]">
                    {group.label}
                  </div>
                  {group.items.map((e, i) => {
                    const key = `${e.timestamp}-${i}`
                    const cat = categoryOf(e.event)
                    const expanded = expandedKey === key
                    return (
                      <div key={key} className="rounded-[var(--radius)] hover:bg-[#1b1b1e] transition-colors">
                        <button
                          onClick={() => setExpandedKey(expanded ? null : key)}
                          className="w-full flex items-center gap-2.5 px-2 py-1.5 text-left"
                        >
                          {expanded ? (
                            <ChevronDown size={11} className="text-[#c7c4d7]/40 shrink-0" />
                          ) : (
                            <ChevronRight size={11} className="text-[#c7c4d7]/40 shrink-0" />
                          )}
                          <span className="font-mono text-[10px] text-[#c7c4d7]/50 shrink-0 w-16">
                            {timeLabel(e.timestamp)}
                          </span>
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                            title={CATEGORY_LABELS[cat]}
                          />
                          <span className="font-mono text-xs text-[var(--on-surface)] shrink-0">
                            {e.event}
                          </span>
                          {e.connectionName && (
                            <span
                              role="link"
                              tabIndex={0}
                              onClick={(ev) => {
                                ev.stopPropagation()
                                setConnectionFilter({ id: e.connectionId, name: e.connectionName })
                              }}
                              onKeyDown={(ev) => {
                                if (ev.key === 'Enter') {
                                  ev.stopPropagation()
                                  setConnectionFilter({ id: e.connectionId, name: e.connectionName })
                                }
                              }}
                              className="text-xs text-[#6bd5ff]/80 hover:text-[#6bd5ff] hover:underline truncate cursor-pointer"
                              title="Filter the timeline to this connection"
                            >
                              {e.connectionName}
                            </span>
                          )}
                          {e.host && (
                            <span className="text-[10px] text-[#c7c4d7]/40 truncate">{e.host}</span>
                          )}
                        </button>
                        {expanded && (
                          <pre className="mx-8 mb-2 px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-container-highest)] text-[10px] text-[#c7c4d7] overflow-x-auto font-mono">
                            {JSON.stringify(e.details ?? {}, null, 2)}
                          </pre>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'captures' && (
        <div className="flex-1 overflow-y-auto min-h-0 pb-4">
          <div className="flex items-center gap-2 px-4 pt-2 pb-1">
            <Play size={12} className="text-[#c7c4d7]/50" />
            <span className="text-[9px] font-semibold tracking-[0.14em] uppercase text-[#c7c4d7]/45">
              Recordings ({captures.recordings.length})
            </span>
            <div className="flex-1" />
            <button
              onClick={() => captures.openFolder('recordings')}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-[#c7c4d7]/60 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
            >
              <FolderOpen size={11} /> Open folder
            </button>
          </div>
          <CaptureFileList kind="recordings" api={captures} />
          <div className="flex items-center gap-2 px-4 pt-4 pb-1">
            <ScrollText size={12} className="text-[#c7c4d7]/50" />
            <span className="text-[9px] font-semibold tracking-[0.14em] uppercase text-[#c7c4d7]/45">
              Session Logs ({captures.logs.length})
            </span>
            <div className="flex-1" />
            <button
              onClick={() => captures.openFolder('logs')}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-[#c7c4d7]/60 hover:text-[var(--on-surface)] hover:bg-[#2a2a2d] rounded-[var(--radius)]"
            >
              <FolderOpen size={11} /> Open folder
            </button>
          </div>
          <CaptureFileList kind="logs" api={captures} />
          {captures.flash && (
            <div className="px-4 py-2 text-[11px] text-[#6bd5ff]">{captures.flash}</div>
          )}
        </div>
      )}

      {/* Toast (export / rotate feedback) */}
      {toast && (
        <div
          className="fixed bottom-12 right-4 z-50 max-w-sm p-3 rounded-[var(--radius)] bg-[var(--surface-bright)] text-xs text-[var(--on-surface)] shadow-lg backdrop-blur-[12px]"
          role="status"
          aria-live="polite"
        >
          <p>{toast.message}</p>
          {toast.filePath && (
            <>
              <p className="font-mono text-[10px] text-[#c7c4d7]/70 truncate mt-1" title={toast.filePath}>
                {toast.filePath}
              </p>
              <div className="flex gap-3 mt-1.5">
                <button
                  onClick={() => window.bifrost.system.revealPath(toast.filePath!)}
                  className="text-[10px] text-[#6bd5ff] hover:underline"
                >
                  Reveal in folder
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(toast.filePath!)}
                  className="text-[10px] text-[#6bd5ff] hover:underline"
                >
                  Copy path
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
