import { useTranslation } from 'react-i18next'
import { useSessionsStore } from '@renderer/stores/sessions.store'

export function TabBar(): JSX.Element {
  const { t } = useTranslation()
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const setActiveTab = useSessionsStore((s) => s.setActiveTab)
  const createTab = useSessionsStore((s) => s.createTab)
  const closeTab = useSessionsStore((s) => s.closeTab)

  return (
    <div className="flex items-center h-9 bg-zinc-900 border-b border-zinc-800 select-none">
      <div className="flex items-center overflow-x-auto flex-1 scrollbar-none">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group flex items-center gap-1 px-3 h-9 text-sm cursor-pointer border-r border-zinc-800 shrink-0 transition-colors ${
              tab.id === activeTabId
                ? 'bg-zinc-800/80 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
            onClick={() => setActiveTab(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1) closeTab(tab.id)
            }}
            role="tab"
            aria-selected={tab.id === activeTabId}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setActiveTab(tab.id)
            }}
          >
            <span className="truncate max-w-[140px]">{tab.title}</span>
            <button
              className="ml-1 w-4 h-4 rounded-sm flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
              aria-label={t('tabs.closeTab')}
              tabIndex={-1}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l6 6M8 2l-6 6" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        className="flex items-center justify-center w-9 h-9 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors shrink-0"
        onClick={() => createTab()}
        aria-label={t('tabs.newTab')}
        title={t('tabs.newTab')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M7 1v12M1 7h12" />
        </svg>
      </button>
    </div>
  )
}
