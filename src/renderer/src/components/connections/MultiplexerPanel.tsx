import { useCallback } from 'react'
import { Switch } from '@renderer/components/ui/switch'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

export type MultiplexerKind = 'none' | 'dtach' | 'tmux' | 'auto'
export type MultiplexerFallback = 'tmux' | 'none'

export interface MultiplexerConfig {
  preferred: MultiplexerKind
  fallback: MultiplexerFallback
  socketDir: string
  sessionPrefix: string
  autoAttachSingle: boolean
  alwaysAsk: boolean
}

export const defaultMultiplexer: MultiplexerConfig = {
  preferred: 'none',
  fallback: 'tmux',
  socketDir: '~/.dtach',
  sessionPrefix: 'bifrost-{conn}',
  autoAttachSingle: true,
  alwaysAsk: false
}

interface MultiplexerPanelProps {
  value: MultiplexerConfig
  onChange: (next: MultiplexerConfig) => void
  disabled?: boolean
  disabledReason?: string
}

const KIND_OPTIONS: Array<{ id: MultiplexerKind; label: string; hint: string }> = [
  { id: 'none', label: 'NONE', hint: 'Plain shell. No persistence.' },
  { id: 'dtach', label: 'DTACH', hint: 'Lightweight, transparent persistence.' },
  { id: 'tmux', label: 'TMUX', hint: 'Multi-window/pane persistence.' },
  { id: 'auto', label: 'AUTO', hint: 'Try dtach first, fall back to tmux.' }
]

export function MultiplexerPanel({
  value,
  onChange,
  disabled,
  disabledReason
}: MultiplexerPanelProps): JSX.Element {
  const update = useCallback(
    <K extends keyof MultiplexerConfig>(key: K, val: MultiplexerConfig[K]) => {
      onChange({ ...value, [key]: val })
    },
    [value, onChange]
  )

  const enabled = value.preferred !== 'none'
  const showDtachOptions = value.preferred === 'dtach' || value.preferred === 'auto'
  const showFallbackToggle = showDtachOptions

  return (
    <div className={cn('flex flex-col gap-3', disabled && 'opacity-50 pointer-events-none')}>
      {disabled && disabledReason && (
        <div className="rounded-[var(--radius)] bg-[var(--surface-container-high)] px-3 py-2 text-xs text-[var(--on-surface-variant)]">
          {disabledReason}
        </div>
      )}

      <div className="rounded-[var(--radius)] bg-[var(--surface-container-high)] p-3">
        <label className="block text-xs text-[var(--on-surface-variant)] mb-2">
          Session multiplexer
        </label>
        <div className="grid grid-cols-4 gap-1">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => update('preferred', opt.id)}
              className={cn(
                'h-8 rounded-[var(--radius)] text-[10px] font-semibold uppercase tracking-wider transition-colors',
                value.preferred === opt.id
                  ? 'bg-[var(--primary,#6bd5ff)] text-[#0a0a0c]'
                  : 'bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[var(--on-surface-variant)] mt-2">
          {KIND_OPTIONS.find((o) => o.id === value.preferred)?.hint}
        </p>
      </div>

      {enabled && (
        <>
          {showFallbackToggle && (
            <label className="flex items-center justify-between cursor-pointer p-2 rounded-[var(--radius)] bg-[var(--surface-container-high)]">
              <div>
                <span className="text-xs text-[var(--on-surface)]">Fall back to tmux</span>
                <span className="text-[9px] text-[var(--on-surface-variant)] block">
                  If dtach is missing on the host, ask whether to use tmux instead.
                </span>
              </div>
              <Switch
                checked={value.fallback === 'tmux'}
                onCheckedChange={(checked) => update('fallback', checked ? 'tmux' : 'none')}
              />
            </label>
          )}

          {showDtachOptions && (
            <div>
              <label className="text-xs text-[var(--on-surface-variant)] mb-1 block">
                dtach socket directory
              </label>
              <Input
                value={value.socketDir}
                onChange={(e) => update('socketDir', e.target.value)}
                placeholder="~/.dtach"
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-[var(--on-surface-variant)] mt-1">
                Created on demand. Tilde is expanded by the remote shell.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-[var(--on-surface-variant)] mb-1 block">
              Session name prefix
            </label>
            <Input
              value={value.sessionPrefix}
              onChange={(e) => update('sessionPrefix', e.target.value)}
              placeholder="bifrost-{conn}"
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-[var(--on-surface-variant)] mt-1">
              <code>{'{conn}'}</code> expands to the connection name. Used as default for new sessions.
            </p>
          </div>

          <label className="flex items-center justify-between cursor-pointer p-2 rounded-[var(--radius)] bg-[var(--surface-container-high)]">
            <div>
              <span className="text-xs text-[var(--on-surface)]">Auto-attach if single session</span>
              <span className="text-[9px] text-[var(--on-surface-variant)] block">
                Skip the picker when exactly one live session exists.
              </span>
            </div>
            <Switch
              checked={value.autoAttachSingle}
              onCheckedChange={(checked) => update('autoAttachSingle', checked)}
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-2 rounded-[var(--radius)] bg-[var(--surface-container-high)]">
            <div>
              <span className="text-xs text-[var(--on-surface)]">Always show picker</span>
              <span className="text-[9px] text-[var(--on-surface-variant)] block">
                Force the picker dialog even when auto-attach would apply.
              </span>
            </div>
            <Switch
              checked={value.alwaysAsk}
              onCheckedChange={(checked) => update('alwaysAsk', checked)}
            />
          </label>
        </>
      )}
    </div>
  )
}
