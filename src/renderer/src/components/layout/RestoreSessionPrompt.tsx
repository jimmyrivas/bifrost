import { History } from 'lucide-react'

interface RestoreSessionPromptProps {
  /** Number of restorable tabs from the previous session. */
  count: number
  onRestore: () => void
  onStartFresh: () => void
}

/**
 * Launch-time prompt offering to restore the previous session's tabs. Shown once,
 * only when the manifest has at least one restorable tab.
 */
export function RestoreSessionPrompt({
  count,
  onRestore,
  onStartFresh
}: RestoreSessionPromptProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0d0f]/70 backdrop-blur-sm">
      <div className="w-[26rem] max-w-[90vw] rounded-[var(--radius)] bg-[#1b1b1e] border border-[rgba(199,196,215,0.12)] shadow-xl p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <History size={18} className="text-[#6bd5ff]" />
          <h2 className="text-sm font-semibold text-[var(--on-surface)]">Restore previous session?</h2>
        </div>
        <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed mb-4">
          You had <strong className="text-[var(--on-surface)]">{count}</strong>{' '}
          {count === 1 ? 'tab' : 'tabs'} open when Bifrost last closed. Restore{' '}
          {count === 1 ? 'it' : 'them'} and reconnect, or start with a clean session.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onStartFresh}
            className="px-3 py-1.5 rounded-[var(--radius)] text-xs text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50 transition-colors"
          >
            Start fresh
          </button>
          <button
            onClick={onRestore}
            className="px-3 py-1.5 rounded-[var(--radius)] text-xs font-semibold bg-[#6bd5ff]/15 text-[#6bd5ff] hover:bg-[#6bd5ff]/25 transition-colors"
          >
            Restore {count} {count === 1 ? 'tab' : 'tabs'}
          </button>
        </div>
      </div>
    </div>
  )
}
