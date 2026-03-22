import { useCallback } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { COLOR_SCHEMES, type ColorScheme } from '@renderer/lib/color-schemes'
import { usePreferencesStore } from '@renderer/stores/preferences.store'

function SchemePreview({ scheme, isSelected, onSelect }: {
  scheme: ColorScheme
  isSelected: boolean
  onSelect: () => void
}): JSX.Element {
  const { colors } = scheme
  const ansiColors = [
    colors.red, colors.green, colors.yellow, colors.blue,
    colors.magenta, colors.cyan, colors.white, colors.brightBlack
  ]

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col gap-1.5 p-2.5 rounded-[var(--radius,0.25rem)] transition-all',
        'hover:ring-1 hover:ring-[#39393c]/30',
        isSelected
          ? 'bg-[#2a2a2d] ring-1 ring-[#a855f7]/40'
          : 'bg-[#1b1b1e] hover:bg-[#2a2a2d]/60'
      )}
      aria-label={`Color scheme: ${scheme.name}`}
      aria-pressed={isSelected}
    >
      {/* Mini terminal preview */}
      <div
        className="w-full h-14 rounded-sm flex flex-col justify-end p-1.5 gap-0.5 overflow-hidden"
        style={{ backgroundColor: colors.background as string }}
      >
        {/* Fake prompt line */}
        <div className="flex items-center gap-1">
          <span
            className="text-[7px] font-['JetBrains_Mono'] leading-none"
            style={{ color: colors.green as string }}
          >
            user@host
          </span>
          <span
            className="text-[7px] font-['JetBrains_Mono'] leading-none"
            style={{ color: colors.blue as string }}
          >
            ~/project
          </span>
          <span
            className="text-[7px] font-['JetBrains_Mono'] leading-none"
            style={{ color: colors.foreground as string }}
          >
            $
          </span>
        </div>
        {/* ANSI color bars */}
        <div className="flex gap-px">
          {ansiColors.map((color, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-[1px]"
              style={{ backgroundColor: color as string }}
            />
          ))}
        </div>
      </div>

      {/* Label */}
      <div className="flex items-center justify-between w-full">
        <span className="text-[10px] font-medium text-[#e4e4e7] truncate">
          {scheme.name}
        </span>
        {isSelected && (
          <Check size={12} className="text-[#a855f7] shrink-0" />
        )}
      </div>
      {scheme.author && (
        <span className="text-[9px] text-[#c7c4d7]/50 truncate w-full text-left -mt-1">
          {scheme.author}
        </span>
      )}
    </button>
  )
}

export function ColorSchemeSelector(): JSX.Element {
  const currentScheme = usePreferencesStore((s) => s.terminal.colorScheme)
  const setTerminalPref = usePreferencesStore((s) => s.setTerminalPref)

  const handleSelect = useCallback(
    (name: string) => {
      setTerminalPref('colorScheme', name)
    },
    [setTerminalPref]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-[var(--on-surface-variant)] uppercase tracking-[0.1em] font-semibold">
          Color Scheme
        </label>
        <span className="text-[10px] text-[#c7c4d7]/50">
          {COLOR_SCHEMES.length} schemes
        </span>
      </div>
      <div
        className="grid grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1"
        role="radiogroup"
        aria-label="Terminal color scheme"
      >
        {COLOR_SCHEMES.map((scheme) => (
          <SchemePreview
            key={scheme.name}
            scheme={scheme}
            isSelected={currentScheme === scheme.name}
            onSelect={() => handleSelect(scheme.name)}
          />
        ))}
      </div>
    </div>
  )
}
