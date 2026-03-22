import { useState, useCallback } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { detectDangerousCommands, type DangerousMatch } from '@renderer/lib/dangerous-commands'
import { usePreferencesStore } from '@renderer/stores/preferences.store'

interface PasteWarningProps {
  text: string
  onConfirm: () => void
  onCancel: () => void
}

export function PasteWarning({ text, onConfirm, onCancel }: PasteWarningProps): JSX.Element {
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const dismissForSession = usePreferencesStore((s) => s.dismissPasteWarningForSession)

  const lines = text.split('\n')
  const lineCount = lines.length
  const previewLines = lines.slice(0, 5)
  const dangerousMatches = detectDangerousCommands(text)
  const hasCritical = dangerousMatches.some((m) => m.severity === 'critical')

  const handleConfirm = useCallback(() => {
    if (dontAskAgain) {
      dismissForSession()
    }
    onConfirm()
  }, [dontAskAgain, dismissForSession, onConfirm])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-warning-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0d0d0f]/80 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg mx-4',
          'bg-[#2a2a2d] rounded-[var(--radius,0.25rem)]',
          'shadow-[0_0_32px_rgba(0,0,0,0.4)]',
          hasCritical && 'ring-1 ring-[#ef4444]/30'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          {hasCritical ? (
            <ShieldAlert size={20} className="text-[#ef4444] shrink-0" />
          ) : (
            <AlertTriangle size={20} className="text-[#eab308] shrink-0" />
          )}
          <h2
            id="paste-warning-title"
            className={cn(
              'text-sm font-semibold',
              hasCritical ? 'text-[#ef4444]' : 'text-[#eab308]'
            )}
          >
            {hasCritical ? 'Dangerous Commands Detected' : 'Multiline Paste Warning'}
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 flex flex-col gap-3">
          <p className="text-xs text-[#c7c4d7]">
            You are about to paste <span className="font-semibold text-[#e4e4e7]">{lineCount} lines</span> of
            text into the terminal. This may execute multiple commands.
          </p>

          {/* Dangerous command warnings */}
          {dangerousMatches.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {dangerousMatches.map((match: DangerousMatch, i: number) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 px-3 py-2 rounded-[var(--radius,0.25rem)] text-xs',
                    match.severity === 'critical'
                      ? 'bg-[#ef4444]/10 text-[#f87171]'
                      : 'bg-[#eab308]/10 text-[#facc15]'
                  )}
                >
                  <span className="shrink-0 uppercase tracking-wider text-[10px] font-semibold mt-0.5">
                    {match.severity}
                  </span>
                  <span className="flex-1">
                    {match.description}
                    <code className="ml-1.5 px-1 py-0.5 rounded bg-[#1b1b1e] text-[10px] font-['JetBrains_Mono']">
                      {match.pattern.slice(0, 40)}
                    </code>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          <div className="bg-[#1b1b1e] rounded-[var(--radius,0.25rem)] p-3 overflow-x-auto">
            <pre className="text-[11px] font-['JetBrains_Mono'] text-[#e4e4e7]/80 leading-relaxed whitespace-pre">
              {previewLines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="text-[#71717a] select-none w-6 shrink-0 text-right mr-2">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </div>
              ))}
              {lineCount > 5 && (
                <div className="text-[#71717a] mt-1 pl-8">
                  ... {lineCount - 5} more line{lineCount - 5 > 1 ? 's' : ''}
                </div>
              )}
            </pre>
          </div>

          {/* Don't ask again checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="w-3.5 h-3.5 rounded-sm bg-[#1b1b1e] border-[#39393c]/15 accent-[#a855f7]"
            />
            <span className="text-xs text-[#c7c4d7]/70">
              Don&apos;t ask again for this session
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            className={cn(
              'px-4 py-2 text-xs font-medium rounded-[var(--radius,0.25rem)]',
              'text-[#c7c4d7] hover:text-[#e4e4e7]',
              'bg-[#1b1b1e] hover:bg-[#39393c] transition-colors'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={cn(
              'px-4 py-2 text-xs font-medium rounded-[var(--radius,0.25rem)] transition-colors',
              'border border-[#39393c]/15',
              hasCritical
                ? 'text-[#ef4444] hover:bg-[#ef4444]/10'
                : 'text-[#c084fc] hover:bg-[#c084fc]/10'
            )}
          >
            Paste Anyway
          </button>
        </div>
      </div>
    </div>
  )
}
