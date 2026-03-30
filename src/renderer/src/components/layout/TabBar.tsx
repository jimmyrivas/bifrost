import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Plus, Terminal, Lock, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSessionsStore } from '@renderer/stores/sessions.store'

const SPECTRAL_GRADIENT =
  'linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff)'

interface ShellInfo {
  id: string
  name: string
  path: string
  args?: string[]
  elevated?: boolean
}

export function TabBar(): JSX.Element {
  const { t } = useTranslation()
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const setActiveTab = useSessionsStore((s) => s.setActiveTab)
  const createTab = useSessionsStore((s) => s.createTab)
  const closeTab = useSessionsStore((s) => s.closeTab)
  const renameTab = useSessionsStore((s) => s.renameTab)

  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Shell picker
  const [shellMenuOpen, setShellMenuOpen] = useState(false)
  const [shells, setShells] = useState<ShellInfo[]>([])
  const shellMenuRef = useRef<HTMLDivElement>(null)

  // Scroll state
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    el?.addEventListener('scroll', updateScrollState)
    const ro = new ResizeObserver(updateScrollState)
    if (el) ro.observe(el)
    return () => {
      el?.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, tabs.length])

  // Scroll active tab into view
  useEffect(() => {
    if (!activeTabId || !scrollRef.current) return
    const tabEl = scrollRef.current.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement
    tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeTabId])

  const scrollBy = useCallback((delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }, [])

  const startEditing = useCallback((tabId: string, currentTitle: string) => {
    setEditingTabId(tabId)
    setEditValue(currentTitle)
  }, [])

  const commitEdit = useCallback(() => {
    if (editingTabId && editValue.trim()) {
      renameTab(editingTabId, editValue.trim())
      const { tabs: t } = useSessionsStore.getState()
      const tab = t.find((x) => x.id === editingTabId)
      if (tab && !tab.lockTitle) {
        useSessionsStore.getState().toggleLockTitle(editingTabId)
      }
    }
    setEditingTabId(null)
  }, [editingTabId, editValue, renameTab])

  const cancelEdit = useCallback(() => { setEditingTabId(null) }, [])

  // Click/double-click disambiguation
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleTabClick = useCallback((tabId: string) => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => {
      setActiveTab(tabId)
      clickTimerRef.current = null
    }, 200)
  }, [setActiveTab])

  const handleTabDoubleClick = useCallback((tabId: string, title: string) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    setActiveTab(tabId)
    startEditing(tabId, title)
  }, [setActiveTab, startEditing])

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTabId])

  useEffect(() => {
    if (!shellMenuOpen) return
    const handler = (e: MouseEvent): void => {
      if (shellMenuRef.current && !shellMenuRef.current.contains(e.target as Node)) {
        setShellMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [shellMenuOpen])

  const openShellMenu = useCallback(async () => {
    if (shells.length === 0) {
      try {
        const list = await window.bifrost.terminal.listShells()
        setShells(list)
      } catch { /* ignore */ }
    }
    setShellMenuOpen(true)
  }, [shells.length])

  const createShellTab = useCallback((shell: ShellInfo) => {
    createTab(shell.name, undefined, undefined, shell.path, shell.args)
    setShellMenuOpen(false)
  }, [createTab])

  return (
    <div
      className="flex items-center h-9 bg-[#1b1b1e] select-none shrink-0"
      role="tablist"
      aria-label="Terminal tabs"
    >
      {/* Scroll left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-200)}
          className="flex items-center justify-center w-6 h-9 text-[#c7c4d7]/40 hover:text-[#c7c4d7] shrink-0 bg-gradient-to-r from-[#1b1b1e] to-transparent z-10"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft size={12} />
        </button>
      )}

      {/* Tab strip */}
      <div
        ref={scrollRef}
        className="flex items-center overflow-x-auto flex-1 scrollbar-none gap-[1px]"
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId
          const isEditing = editingTabId === tab.id
          const tabNumber = idx + 1
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              className={cn(
                'group relative flex items-center gap-1.5 px-3 h-9 text-sm cursor-pointer shrink-0 transition-colors min-w-0',
                isActive
                  ? 'bg-[#2a2a2d] text-[#e6e1e5]'
                  : 'bg-[#1b1b1e] text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/40'
              )}
              onClick={() => handleTabClick(tab.id)}
              onAuxClick={(e) => { if (e.button === 1) closeTab(tab.id) }}
              onDoubleClick={(e) => { e.stopPropagation(); handleTabDoubleClick(tab.id, tab.title) }}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setActiveTab(tab.id) }}
              title={`${tab.title}${tabNumber <= 9 ? ` (Ctrl+${tabNumber})` : ''}`}
            >
              {/* Tab number */}
              <span className={cn(
                'text-[9px] font-mono shrink-0 w-3 text-center',
                isActive ? 'text-[#6bd5ff]/60' : 'text-[#c7c4d7]/20'
              )}>
                {tabNumber <= 9 ? tabNumber : ''}
              </span>

              <Terminal size={13} strokeWidth={1.5} className="shrink-0 opacity-60" />
              {tab.aiDetected && (
                <span className="shrink-0 text-[8px] font-bold px-1 py-0 rounded bg-[#d56bff]/15 text-[#d56bff] uppercase" title={`AI detected: ${tab.aiDetected}`}>
                  AI
                </span>
              )}
              {tab.lockTitle && (
                <Lock size={9} strokeWidth={2} className="shrink-0 opacity-40" />
              )}
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent outline-none border-b border-[#6bd5ff]/50 text-[13px] font-[var(--font-ui)] text-[#e6e1e5] w-[120px] px-0"
                  maxLength={60}
                />
              ) : (
                <span className="truncate max-w-[140px] font-[var(--font-ui)] text-[13px]">
                  {tab.title}
                </span>
              )}
              <button
                className={cn(
                  'ml-1 w-4 h-4 rounded-sm flex items-center justify-center',
                  'text-[#c7c4d7]/50 hover:text-[#e6e1e5] hover:bg-[#39393c]',
                  'opacity-0 group-hover:opacity-100 transition-opacity'
                )}
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                aria-label={t('tabs.closeTab')}
                tabIndex={-1}
              >
                <X size={10} strokeWidth={2} />
              </button>

              {/* Active tab spectral underglow */}
              {isActive && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: SPECTRAL_GRADIENT }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Scroll right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy(200)}
          className="flex items-center justify-center w-6 h-9 text-[#c7c4d7]/40 hover:text-[#c7c4d7] shrink-0 bg-gradient-to-l from-[#1b1b1e] to-transparent z-10"
          aria-label="Scroll tabs right"
        >
          <ChevronRight size={12} />
        </button>
      )}

      {/* New tab: click = default shell, dropdown arrow = shell picker */}
      <div className="flex items-center shrink-0 relative" ref={shellMenuRef}>
        <button
          className={cn(
            'flex items-center justify-center w-7 h-9 transition-colors',
            'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
          )}
          onClick={() => createTab()}
          aria-label={t('tabs.newTab')}
          title="New terminal (default shell)"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
        <button
          className={cn(
            'flex items-center justify-center w-5 h-9 transition-colors',
            'text-[#c7c4d7]/50 hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
          )}
          onClick={openShellMenu}
          aria-label="Choose shell"
          title="Choose shell"
        >
          <ChevronDown size={10} strokeWidth={1.5} />
        </button>

        {/* Shell picker dropdown */}
        {shellMenuOpen && shells.length > 0 && (
          <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--surface-container-high)] rounded-[var(--radius)] shadow-lg shadow-black/30 z-50 py-1 border border-[rgba(199,196,215,0.08)]">
            <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#c7c4d7]/40">
              Open terminal with
            </div>
            {shells.map((shell) => (
              <button
                key={shell.id}
                onClick={() => createShellTab(shell)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/30 transition-colors text-left"
              >
                <Terminal size={12} strokeWidth={1.5} className={shell.elevated ? 'text-[#ffa36b]' : shell.id.includes('pwsh') || shell.id.includes('powershell') ? 'text-[#6bd5ff]' : 'text-[#c7c4d7]/50'} />
                <span className="flex-1">{shell.name}</span>
                {shell.elevated && (
                  <span className="text-[8px] font-bold px-1 rounded bg-[#ffa36b]/15 text-[#ffa36b] uppercase">Admin</span>
                )}
                {!shell.elevated && (
                  <span className="text-[9px] text-[#c7c4d7]/25 font-mono">{shell.id}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab count badge when many tabs */}
      {tabs.length > 5 && (
        <span className="text-[9px] text-[#c7c4d7]/25 px-2 shrink-0 tabular-nums">
          {tabs.length}
        </span>
      )}
    </div>
  )
}
