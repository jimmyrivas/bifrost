import { useTranslation } from 'react-i18next'
import { X, Plus, Terminal } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSessionsStore } from '@renderer/stores/sessions.store'

const SPECTRAL_GRADIENT =
  'linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff)'

export function TabBar(): JSX.Element {
  const { t } = useTranslation()
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const setActiveTab = useSessionsStore((s) => s.setActiveTab)
  const createTab = useSessionsStore((s) => s.createTab)
  const closeTab = useSessionsStore((s) => s.closeTab)

  return (
    <div
      className="flex items-center h-9 bg-[#1b1b1e] select-none shrink-0"
      role="tablist"
      aria-label="Terminal tabs"
    >
      <div className="flex items-center overflow-x-auto flex-1 scrollbar-none gap-[1px]">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className={cn(
                'group relative flex items-center gap-1.5 px-3 h-9 text-sm cursor-pointer shrink-0 transition-colors',
                isActive
                  ? 'bg-[#2a2a2d] text-[#e6e1e5]'
                  : 'bg-[#1b1b1e] text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/40'
              )}
              onClick={() => setActiveTab(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(tab.id)
              }}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setActiveTab(tab.id)
              }}
            >
              <Terminal size={13} strokeWidth={1.5} className="shrink-0 opacity-60" />
              <span className="truncate max-w-[140px] font-['Inter'] text-[13px]">
                {tab.title}
              </span>
              <button
                className={cn(
                  'ml-1 w-4 h-4 rounded-sm flex items-center justify-center',
                  'text-[#c7c4d7]/50 hover:text-[#e6e1e5] hover:bg-[#39393c]',
                  'opacity-0 group-hover:opacity-100 transition-opacity'
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
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

      {/* New tab button */}
      <button
        className={cn(
          'flex items-center justify-center w-9 h-9 shrink-0 transition-colors',
          'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
        )}
        onClick={() => createTab()}
        aria-label={t('tabs.newTab')}
        title={t('tabs.newTab')}
      >
        <Plus size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
