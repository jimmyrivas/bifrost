import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Globe, Network, KeyRound } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore, type TerminalPreferences } from '@renderer/stores/preferences.store'

type PrefsTab = 'terminal' | 'language' | 'network' | 'keepass'

const tabConfig: Array<{ id: PrefsTab; icon: typeof Monitor; labelKey: string; fallback: string }> = [
  { id: 'terminal', icon: Monitor, labelKey: 'prefs.terminal', fallback: 'Terminal' },
  { id: 'language', icon: Globe, labelKey: 'prefs.language', fallback: 'Language' },
  { id: 'network', icon: Network, labelKey: 'prefs.network', fallback: 'Network' },
  { id: 'keepass', icon: KeyRound, labelKey: 'prefs.keepass', fallback: 'KeePass' },
]

const selectClass = 'flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400'
const checkClass = 'h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-zinc-400'
const tabClass = 'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors w-full text-left'

interface ProxyState {
  host: string
  port: number
  enabled: boolean
}

interface KeePassState {
  dbPath: string
  keyPath: string
}

export function Preferences(): JSX.Element {
  const { t, i18n } = useTranslation()
  const terminal = usePreferencesStore((s) => s.terminal)
  const language = usePreferencesStore((s) => s.language)
  const setTerminalPref = usePreferencesStore((s) => s.setTerminalPref)
  const setLanguage = usePreferencesStore((s) => s.setLanguage)

  const [activeTab, setActiveTab] = useState<PrefsTab>('terminal')
  const [proxy, setProxy] = useState<ProxyState>({ host: '', port: 1080, enabled: false })
  const [keepass, setKeepass] = useState<KeePassState>({ dbPath: '', keyPath: '' })

  const setTermPref = useCallback(<K extends keyof TerminalPreferences>(key: K, value: TerminalPreferences[K]) => {
    setTerminalPref(key, value)
  }, [setTerminalPref])

  const handleLanguageChange = useCallback((lang: 'en' | 'es') => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }, [setLanguage, i18n])

  return (
    <div className="flex gap-4 h-full">
      <nav className="w-44 shrink-0 flex flex-col gap-1 border-r border-zinc-800 pr-4" role="tablist" aria-label={t('prefs.title', 'Preferences')}>
        {tabConfig.map(({ id, icon: Icon, labelKey, fallback }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={cn(tabClass, activeTab === id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50')}
            onClick={() => setActiveTab(id)}
          >
            <Icon className="h-4 w-4" />
            {t(labelKey, fallback)}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-w-0 overflow-y-auto" role="tabpanel">
        {activeTab === 'terminal' && (
          <div className="flex flex-col gap-4 max-w-lg">
            <h3 className="text-sm font-semibold text-zinc-100">{t('prefs.terminalSettings', 'Terminal Settings')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="pref-font">{t('prefs.fontFamily', 'Font Family')}</Label>
                <Input id="pref-font" value={terminal.fontFamily} onChange={(e) => setTermPref('fontFamily', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pref-font-size">{t('prefs.fontSize', 'Font Size')}</Label>
                <Input id="pref-font-size" type="number" min={8} max={32} value={terminal.fontSize} onChange={(e) => setTermPref('fontSize', Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="pref-scrollback">{t('prefs.scrollback', 'Scrollback')}</Label>
                <Input id="pref-scrollback" type="number" min={100} max={100000} step={500} value={terminal.scrollback} onChange={(e) => setTermPref('scrollback', Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="pref-cursor">{t('prefs.cursorStyle', 'Cursor Style')}</Label>
                <select id="pref-cursor" className={selectClass} value={terminal.cursorStyle} onChange={(e) => setTermPref('cursorStyle', e.target.value as TerminalPreferences['cursorStyle'])}>
                  <option value="block">{t('prefs.block', 'Block')}</option>
                  <option value="underline">{t('prefs.underline', 'Underline')}</option>
                  <option value="bar">{t('prefs.bar', 'Bar')}</option>
                </select>
              </div>
              <div>
                <Label htmlFor="pref-theme">{t('prefs.theme', 'Theme')}</Label>
                <select id="pref-theme" className={selectClass} value={terminal.theme} onChange={(e) => setTermPref('theme', e.target.value as 'dark' | 'light')}>
                  <option value="dark">{t('prefs.dark', 'Dark')}</option>
                  <option value="light">{t('prefs.light', 'Light')}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer col-span-2">
                <input type="checkbox" className={checkClass} checked={terminal.cursorBlink} onChange={(e) => setTermPref('cursorBlink', e.target.checked)} />
                {t('prefs.cursorBlink', 'Cursor Blink')}
              </label>
            </div>
          </div>
        )}

        {activeTab === 'language' && (
          <div className="flex flex-col gap-4 max-w-lg">
            <h3 className="text-sm font-semibold text-zinc-100">{t('prefs.languageSettings', 'Language')}</h3>
            <div>
              <Label htmlFor="pref-lang">{t('prefs.selectLanguage', 'Interface Language')}</Label>
              <select id="pref-lang" className={selectClass} value={language} onChange={(e) => handleLanguageChange(e.target.value as 'en' | 'es')}>
                <option value="en">English</option>
                <option value="es">Espanol</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="flex flex-col gap-4 max-w-lg">
            <h3 className="text-sm font-semibold text-zinc-100">{t('prefs.networkSettings', 'Global SOCKS Proxy')}</h3>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" className={checkClass} checked={proxy.enabled} onChange={(e) => setProxy((p) => ({ ...p, enabled: e.target.checked }))} />
              {t('prefs.enableProxy', 'Enable SOCKS Proxy')}
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="pref-proxy-host">{t('prefs.proxyHost', 'Host')}</Label>
                <Input id="pref-proxy-host" value={proxy.host} onChange={(e) => setProxy((p) => ({ ...p, host: e.target.value }))} placeholder="127.0.0.1" disabled={!proxy.enabled} />
              </div>
              <div>
                <Label htmlFor="pref-proxy-port">{t('prefs.proxyPort', 'Port')}</Label>
                <Input id="pref-proxy-port" type="number" value={proxy.port} onChange={(e) => setProxy((p) => ({ ...p, port: Number(e.target.value) }))} disabled={!proxy.enabled} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'keepass' && (
          <div className="flex flex-col gap-4 max-w-lg">
            <h3 className="text-sm font-semibold text-zinc-100">{t('prefs.keepassSettings', 'KeePass Integration')}</h3>
            <div>
              <Label htmlFor="pref-kp-db">{t('prefs.dbPath', 'Database Path')}</Label>
              <Input id="pref-kp-db" value={keepass.dbPath} onChange={(e) => setKeepass((k) => ({ ...k, dbPath: e.target.value }))} placeholder="/path/to/database.kdbx" />
            </div>
            <div>
              <Label htmlFor="pref-kp-key">{t('prefs.keyFilePath', 'Key File Path')}</Label>
              <Input id="pref-kp-key" value={keepass.keyPath} onChange={(e) => setKeepass((k) => ({ ...k, keyPath: e.target.value }))} placeholder="/path/to/keyfile" />
            </div>
            <Button variant="outline" className="self-start">
              {t('prefs.testConnection', 'Test Connection')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
