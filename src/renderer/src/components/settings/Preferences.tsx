import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Globe, Network, KeyRound, GitBranch, Puzzle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore, type TerminalPreferences } from '@renderer/stores/preferences.store'
import { ColorSchemeSelector } from './ColorSchemeSelector'
import { ConfigSync } from './ConfigSync'
import { PluginManager } from './PluginManager'

type PrefsTab = 'terminal' | 'language' | 'network' | 'keepass' | 'sync' | 'plugins'

const tabConfig: Array<{ id: PrefsTab; icon: typeof Monitor; labelKey: string; fallback: string }> = [
  { id: 'terminal', icon: Monitor, labelKey: 'prefs.terminal', fallback: 'Terminal' },
  { id: 'language', icon: Globe, labelKey: 'prefs.language', fallback: 'Language' },
  { id: 'network', icon: Network, labelKey: 'prefs.network', fallback: 'Network' },
  { id: 'keepass', icon: KeyRound, labelKey: 'prefs.keepass', fallback: 'KeePass' },
  { id: 'sync', icon: GitBranch, labelKey: 'prefs.sync', fallback: 'Sync' },
  { id: 'plugins', icon: Puzzle, labelKey: 'prefs.plugins', fallback: 'Plugins' },
]

const selectClass = cn(
  'flex h-9 w-full rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-3 py-1',
  'text-sm text-[var(--on-surface)] ghost-border focus-visible:outline-none [font-family:var(--font-mono)]'
)

const fieldLabel = 'text-xs text-[var(--on-surface-variant)] mb-1 block'
const sectionCard = 'rounded-[var(--radius)] bg-[var(--surface-container-high)] p-4'

interface ProxyState { host: string; port: number; enabled: boolean }
interface KeePassState { dbPath: string; keyPath: string }

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
    <div className="flex gap-0 h-full">
      {/* Side tabs */}
      <nav className="w-48 shrink-0 surface-1 p-3 flex flex-col gap-1" role="tablist" aria-label={t('prefs.title', 'Preferences')}>
        {tabConfig.map(({ id, icon: Icon, labelKey, fallback }) => (
          <button
            key={id} role="tab" aria-selected={activeTab === id}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 text-sm rounded-[var(--radius)] transition-colors w-full text-left',
              activeTab === id
                ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/50'
            )}
            onClick={() => setActiveTab(id)}
          >
            <Icon className="h-4 w-4" />
            {t(labelKey, fallback)}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6" role="tabpanel">
        {activeTab === 'terminal' && (
          <div className="flex flex-col gap-5 max-w-lg">
            <h3 className="text-sm font-semibold text-[var(--on-surface)]">{t('prefs.terminalSettings', 'Terminal Settings')}</h3>
            <div className={sectionCard}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={fieldLabel} htmlFor="pref-font">{t('prefs.fontFamily', 'FONT FAMILY')}</label>
                  <Input id="pref-font" value={terminal.fontFamily} onChange={(e) => setTermPref('fontFamily', e.target.value)} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="pref-font-size">{t('prefs.fontSize', 'FONT SIZE')}</label>
                  <Input id="pref-font-size" type="number" min={8} max={32} value={terminal.fontSize} onChange={(e) => setTermPref('fontSize', Number(e.target.value))} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="pref-scrollback">{t('prefs.scrollback', 'SCROLLBACK')}</label>
                  <Input id="pref-scrollback" type="number" min={100} max={100000} step={500} value={terminal.scrollback} onChange={(e) => setTermPref('scrollback', Number(e.target.value))} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="pref-cursor">{t('prefs.cursorStyle', 'CURSOR STYLE')}</label>
                  <select id="pref-cursor" className={selectClass} value={terminal.cursorStyle} onChange={(e) => setTermPref('cursorStyle', e.target.value as TerminalPreferences['cursorStyle'])}>
                    <option value="block">Block</option>
                    <option value="underline">Underline</option>
                    <option value="bar">Bar</option>
                  </select>
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="pref-theme">{t('prefs.theme', 'THEME')}</label>
                  <select id="pref-theme" className={selectClass} value={terminal.theme} onChange={(e) => setTermPref('theme', e.target.value as 'dark' | 'light')}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
                <label className="flex items-center justify-between col-span-2 cursor-pointer">
                  <span className="text-xs text-[var(--on-surface-variant)]">{t('prefs.cursorBlink', 'Cursor Blink')}</span>
                  <Switch checked={terminal.cursorBlink} onCheckedChange={(v) => setTermPref('cursorBlink', v)} />
                </label>
                <label className="flex items-center justify-between col-span-2 cursor-pointer">
                  <span className="text-xs text-[var(--on-surface-variant)]">Multiline Paste Warning</span>
                  <Switch checked={terminal.pasteWarningEnabled} onCheckedChange={(v) => setTermPref('pasteWarningEnabled', v)} />
                </label>
                <label className="flex items-center justify-between col-span-2 cursor-pointer">
                  <span className="text-xs text-[var(--on-surface-variant)]">Auto-reconnect SSH</span>
                  <Switch checked={terminal.autoReconnect} onCheckedChange={(v) => setTermPref('autoReconnect', v)} />
                </label>
                <label className="flex items-center justify-between col-span-2 cursor-pointer">
                  <span className="text-xs text-[var(--on-surface-variant)]">Font Ligatures</span>
                  <Switch checked={terminal.fontLigatures} onCheckedChange={(v) => setTermPref('fontLigatures', v)} />
                </label>
                <label className="flex items-center justify-between col-span-2 cursor-pointer">
                  <span className="text-xs text-[var(--on-surface-variant)]">Copy on Select</span>
                  <Switch checked={terminal.copyOnSelect} onCheckedChange={(v) => setTermPref('copyOnSelect', v)} />
                </label>
              </div>
            </div>
            <div className={sectionCard}>
              <ColorSchemeSelector />
            </div>
          </div>
        )}

        {activeTab === 'language' && (
          <div className="flex flex-col gap-5 max-w-lg">
            <h3 className="text-sm font-semibold text-[var(--on-surface)]">{t('prefs.languageSettings', 'Language')}</h3>
            <div className={sectionCard}>
              <label className={fieldLabel} htmlFor="pref-lang">{t('prefs.selectLanguage', 'INTERFACE LANGUAGE')}</label>
              <select id="pref-lang" className={selectClass} value={language} onChange={(e) => handleLanguageChange(e.target.value as 'en' | 'es')}>
                <option value="en">English</option>
                <option value="es">Espanol</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="flex flex-col gap-5 max-w-lg">
            <h3 className="text-sm font-semibold text-[var(--on-surface)]">{t('prefs.networkSettings', 'Global SOCKS Proxy')}</h3>
            <div className={sectionCard}>
              <div className="flex flex-col gap-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-[var(--on-surface-variant)]">{t('prefs.enableProxy', 'Enable SOCKS Proxy')}</span>
                  <Switch checked={proxy.enabled} onCheckedChange={(v) => setProxy((p) => ({ ...p, enabled: v }))} />
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={fieldLabel} htmlFor="pref-proxy-host">{t('prefs.proxyHost', 'HOST')}</label>
                    <Input id="pref-proxy-host" value={proxy.host} onChange={(e) => setProxy((p) => ({ ...p, host: e.target.value }))} placeholder="127.0.0.1" disabled={!proxy.enabled} />
                  </div>
                  <div>
                    <label className={fieldLabel} htmlFor="pref-proxy-port">{t('prefs.proxyPort', 'PORT')}</label>
                    <Input id="pref-proxy-port" type="number" value={proxy.port} onChange={(e) => setProxy((p) => ({ ...p, port: Number(e.target.value) }))} disabled={!proxy.enabled} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'keepass' && (
          <div className="flex flex-col gap-5 max-w-lg">
            <h3 className="text-sm font-semibold text-[var(--on-surface)]">{t('prefs.keepassSettings', 'KeePass Integration')}</h3>
            <div className={sectionCard}>
              <div className="flex flex-col gap-4">
                <div>
                  <label className={fieldLabel} htmlFor="pref-kp-db">{t('prefs.dbPath', 'DATABASE PATH')}</label>
                  <Input id="pref-kp-db" value={keepass.dbPath} onChange={(e) => setKeepass((k) => ({ ...k, dbPath: e.target.value }))} placeholder="/path/to/database.kdbx" />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="pref-kp-key">{t('prefs.keyFilePath', 'KEY FILE PATH')}</label>
                  <Input id="pref-kp-key" value={keepass.keyPath} onChange={(e) => setKeepass((k) => ({ ...k, keyPath: e.target.value }))} placeholder="/path/to/keyfile" />
                </div>
                <Button variant="outline" className="self-start">{t('prefs.testConnection', 'Test Connection')}</Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sync' && (
          <ConfigSync />
        )}

        {activeTab === 'plugins' && (
          <PluginManager />
        )}
      </div>
    </div>
  )
}
