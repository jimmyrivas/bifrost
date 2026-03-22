import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface QuickConnectProps {
  onConnect: (host: string, port: number, username: string) => void
}

export function QuickConnect({ onConnect }: QuickConnectProps): JSX.Element {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return

    // Parse formats: user@host:port, user@host, host:port, host
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
    <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-800">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
        placeholder="user@host:port"
        className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
        aria-label="Quick connect"
      />
      <button
        onClick={handleSubmit}
        className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
        aria-label={t('actions.connect')}
      >
        {t('actions.connect')}
      </button>
    </div>
  )
}
