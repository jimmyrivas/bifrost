import { useTranslation } from 'react-i18next'

export function Sidebar(): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950 border-r border-zinc-800">
      {/* Bifrost branding */}
      <div className="flex items-center h-9 px-3 border-b border-zinc-800">
        <span
          className="text-sm font-semibold bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff)'
          }}
        >
          {t('app.name')}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        <button
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
          aria-label={t('sidebar.connections')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="4" cy="4" r="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 4h4l-4 8h4" />
          </svg>
          {t('sidebar.connections')}
        </button>
        <button
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
          aria-label={t('sidebar.clusters')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="10" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="10" width="5" height="5" rx="1" />
            <rect x="10" y="10" width="5" height="5" rx="1" />
          </svg>
          {t('sidebar.clusters')}
        </button>
      </nav>

      {/* Settings at bottom */}
      <div className="p-2 border-t border-zinc-800">
        <button
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
          aria-label={t('sidebar.settings')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="2" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" />
          </svg>
          {t('sidebar.settings')}
        </button>
      </div>
    </div>
  )
}
