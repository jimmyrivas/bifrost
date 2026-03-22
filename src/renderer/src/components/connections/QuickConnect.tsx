import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

const SPECTRAL_GRADIENT =
  'linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff)'

interface QuickConnectProps {
  onConnect: (host: string, port: number, username: string) => void
}

export function QuickConnect({ onConnect }: QuickConnectProps): JSX.Element {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return

    let username = ''
    let host = trimmed
    let port = 22

    if (host.includes('@')) {
      const parts = host.split('@')
      username = parts[0]
      host = parts[1]
    }

    if (host.includes(':')) {
      const parts = host.split(':')
      host = parts[0]
      const parsed = parseInt(parts[1], 10)
      if (!isNaN(parsed)) port = parsed
    }

    onConnect(host, port, username)
    setValue('')
  }, [value, onConnect])

  return (
    <div className="relative flex items-center gap-1.5 px-2 py-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="user@host:port"
          className={cn(
            'w-full bg-[#39393c] rounded px-2.5 py-1.5',
            "text-sm text-[#e6e1e5] placeholder-[#c7c4d7]/40 font-['JetBrains_Mono',monospace]",
            'outline-none transition-colors'
          )}
          aria-label="Quick connect"
        />
        {/* Spectral thread focus indicator */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-[1px] rounded-b transition-opacity',
            isFocused ? 'opacity-100' : 'opacity-0'
          )}
          style={{ background: SPECTRAL_GRADIENT }}
        />
      </div>
      <button
        onClick={handleSubmit}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded shrink-0 transition-colors',
          'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]'
        )}
        aria-label={t('actions.connect')}
      >
        <Zap size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
