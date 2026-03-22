import { useTranslation } from 'react-i18next'
import { useSessionsStore } from '@renderer/stores/sessions.store'

export function StatusBar(): JSX.Element {
  const { t } = useTranslation()
  const tabs = useSessionsStore((s) => s.tabs)

  return (
    <div className="flex items-center justify-between h-6 px-3 bg-zinc-900 border-t border-zinc-800 text-xs text-zinc-500 select-none">
      <div className="flex items-center gap-3">
        <span>{t('status.ready')}</span>
        <span>{tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>UTF-8</span>
      </div>
    </div>
  )
}
