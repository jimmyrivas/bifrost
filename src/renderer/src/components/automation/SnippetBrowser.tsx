import { useState, useMemo } from 'react'
import { Search, Copy, Play } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { getFallbackSuggestions } from '@renderer/lib/command-suggestions'
import { hasParams, promptForParams } from '@renderer/lib/workflow-params'
import { useSessionsStore } from '@renderer/stores/sessions.store'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'docker', label: 'Docker' },
  { id: 'k8s', label: 'Kubernetes' },
  { id: 'system', label: 'System' },
  { id: 'network', label: 'Network' },
  { id: 'git', label: 'Git' },
  { id: 'disk', label: 'Disk' },
  { id: 'process', label: 'Process' }
]

export function SnippetBrowser(): JSX.Element {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const allSnippets = useMemo(() => {
    // Get all snippets (empty query returns all)
    return getFallbackSuggestions('')
  }, [])

  const filtered = useMemo(() => {
    let results = search ? getFallbackSuggestions(search) : allSnippets
    if (category !== 'all') {
      results = results.filter((s) =>
        s.command.toLowerCase().includes(category) ||
        s.description.toLowerCase().includes(category)
      )
    }
    return results
  }, [search, category, allSnippets])

  const sendToTerminal = (rawCommand: string): void => {
    const command = hasParams(rawCommand) ? promptForParams(rawCommand) : rawCommand
    if (!command) return
    const { tabs, activeTabId } = useSessionsStore.getState()
    const tab = tabs.find((t) => t.id === activeTabId)
    const termId = tab?.rootPane.terminalId
    if (!termId) return
    if (termId.startsWith('ssh:')) {
      window.bifrost?.ssh?.write(termId.slice(4), command + '\n')
    } else if (termId.startsWith('mosh:')) {
      window.bifrost?.protocols?.writePty(termId.slice(5), command + '\n')
    } else {
      window.bifrost?.terminal?.write(termId, command + '\n')
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h2 className="text-lg font-semibold text-[var(--on-surface)]">Command Snippets</h2>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
          DEVOPS COMMAND LIBRARY
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commands..."
          className={cn(
            'w-full pl-8 pr-3 py-2 text-xs text-[var(--on-surface)]',
            'bg-[var(--surface-container-highest)] rounded-[var(--radius)]',
            'ghost-border outline-none placeholder-[var(--on-surface-variant)]/40'
          )}
        />
      </div>

      {/* Categories */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              'px-2 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-[var(--radius)] transition-colors',
              category === cat.id
                ? 'bg-[#6bd5ff]/15 text-[#6bd5ff]'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {filtered.length === 0 ? (
          <div className="text-xs text-[var(--on-surface-variant)] text-center py-8">
            No snippets found
          </div>
        ) : (
          filtered.map((snippet, idx) => (
            <div
              key={idx}
              className="group flex items-start gap-2 p-2 rounded-[var(--radius)] hover:bg-[var(--surface-container-high)]/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--on-surface)] truncate">
                  {snippet.command}
                </div>
                <div className="text-[10px] text-[var(--on-surface-variant)] truncate mt-0.5">
                  {snippet.description}
                </div>
              </div>
              <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => navigator.clipboard.writeText(snippet.command)}
                  className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50"
                  title="Copy to clipboard"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={() => sendToTerminal(snippet.command)}
                  className="p-1 rounded-[var(--radius)] text-[#6bd5ff] hover:bg-[#6bd5ff]/10"
                  title="Run in active terminal"
                >
                  <Play size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-[9px] text-[var(--on-surface-variant)] text-center shrink-0">
        {filtered.length} commands available — Click Play to run in active terminal
      </div>
    </div>
  )
}
