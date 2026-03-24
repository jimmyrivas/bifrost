import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Globe, Network, KeyRound, GitBranch, Puzzle, Shield, Lock, Bot } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore, type TerminalPreferences } from '@renderer/stores/preferences.store'
import { ColorSchemeSelector } from './ColorSchemeSelector'
import { ConfigSync } from './ConfigSync'
import { PluginManager } from './PluginManager'
import { KnownHostsPanel } from './KnownHostsPanel'
import { setSecretRedactionEnabled, isSecretRedactionEnabled } from '@renderer/lib/secret-redactor'

type PrefsTab = 'terminal' | 'ai' | 'ssh' | 'security' | 'language' | 'network' | 'keepass' | 'sync' | 'plugins'

const tabConfig: Array<{ id: PrefsTab; icon: typeof Monitor; labelKey: string; fallback: string }> = [
  { id: 'terminal', icon: Monitor, labelKey: 'prefs.terminal', fallback: 'Terminal' },
  { id: 'ai', icon: Bot, labelKey: 'prefs.ai', fallback: 'AI' },
  { id: 'ssh', icon: Shield, labelKey: 'prefs.ssh', fallback: 'SSH' },
  { id: 'security', icon: Lock, labelKey: 'prefs.security', fallback: 'Security' },
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
  const [systemFonts, setSystemFonts] = useState<string[]>([])

  useEffect(() => {
    window.bifrost?.fonts?.listMonospace().then(setSystemFonts).catch(() => {})
  }, [])

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
                  <FontFamilyPicker
                    id="pref-font"
                    value={terminal.fontFamily}
                    fonts={systemFonts}
                    fontSize={terminal.fontSize}
                    onChange={(v) => setTermPref('fontFamily', v)}
                  />
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
                <div className="col-span-2">
                  <label className={fieldLabel} htmlFor="pref-tab-title">DEFAULT TAB TITLE TEMPLATE</label>
                  <Input
                    id="pref-tab-title"
                    value={terminal.tabTitleTemplate}
                    onChange={(e) => setTermPref('tabTitleTemplate', e.target.value)}
                    placeholder="<USER>@<IP> - <NAME>"
                    className="font-['JetBrains_Mono'] text-xs"
                  />
                  <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
                    Used when a connection has no custom tab title. Variables: &lt;USER&gt; &lt;IP&gt; &lt;PORT&gt; &lt;NAME&gt; &lt;ENV:name&gt;
                  </span>
                </div>
              </div>
            </div>
            <div className={sectionCard}>
              <ColorSchemeSelector />
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <AiSettingsPanel />
        )}

        {activeTab === 'ssh' && (
          <div className="flex flex-col gap-5 max-w-2xl">
            <h3 className="text-sm font-semibold text-[var(--on-surface)]">SSH Settings</h3>
            <div className={sectionCard}>
              <KnownHostsPanel />
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="flex flex-col gap-5 max-w-lg">
            <h3 className="text-sm font-semibold text-[var(--on-surface)]">Security</h3>
            <div className={sectionCard}>
              <div className="flex flex-col gap-4">
                <div>
                  <label className={fieldLabel}>CREDENTIAL VAULT</label>
                  <p className="text-xs text-[var(--on-surface-variant)] mb-3">
                    Passwords and passphrases are encrypted using the system keychain (gnome-keyring/kwallet).
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const available = await window.bifrost?.credentials?.isAvailable()
                      if (available) {
                        window.alert('Credential vault is available and using system keychain encryption.')
                      } else {
                        window.alert('System keychain not available. Credentials are stored with base64 encoding (less secure).')
                      }
                    }}
                  >
                    Check Vault Status
                  </Button>
                </div>
                <div className="h-[1px] bg-[var(--surface-container-highest)]" />
                <div>
                  <label className={fieldLabel}>CONFIGURATION ENCRYPTION</label>
                  <p className="text-xs text-[var(--on-surface-variant)] mb-3">
                    Database stores connection passwords and passphrases encrypted. SSH keys are referenced by path (not stored in DB).
                  </p>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-[var(--on-surface-variant)]">Encrypt exported configurations</span>
                    <Switch checked={false} onCheckedChange={() => window.alert('Feature in development')} />
                  </label>
                </div>
                <div className="h-[1px] bg-[var(--surface-container-highest)]" />
                <div>
                  <label className={fieldLabel}>SECRET REDACTION</label>
                  <p className="text-xs text-[var(--on-surface-variant)] mb-3">
                    Automatically mask API keys, tokens, and passwords in terminal output. Prevents accidental exposure.
                  </p>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-[var(--on-surface-variant)]">Redact secrets in terminal output</span>
                    <Switch
                      checked={isSecretRedactionEnabled()}
                      onCheckedChange={(v) => setSecretRedactionEnabled(v)}
                    />
                  </label>
                </div>
              </div>
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

/** Searchable font family dropdown with preview */
function AiSettingsPanel(): JSX.Element {
  const [provider, setProvider] = useState('ollama')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    window.bifrost?.ai?.getConfig?.().then((cfg) => {
      if (cfg) {
        setProvider(cfg.provider)
        setApiKey(cfg.apiKey)
        setModel(cfg.model)
        setOllamaUrl(cfg.ollamaUrl)
      }
    }).catch(() => {})
  }, [])

  const handleSave = async (): Promise<void> => {
    await window.bifrost?.ai?.setConfig?.({ provider, apiKey, model, ollamaUrl })
    setStatus('Saved')
    setTimeout(() => setStatus(null), 2000)
  }

  const handleTest = async (): Promise<void> => {
    setStatus('Testing...')
    try {
      await window.bifrost?.ai?.setConfig?.({ provider, apiKey, model, ollamaUrl })
      const ok = await window.bifrost?.ai?.checkAvailable?.()
      setStatus(ok ? 'Connected!' : 'Connection failed')
    } catch { setStatus('Connection failed') }
    setTimeout(() => setStatus(null), 3000)
  }

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <h3 className="text-sm font-semibold text-[var(--on-surface)]">AI Assistant</h3>
      <div className={sectionCard}>
        <div className="flex flex-col gap-4">
          <div>
            <label className={fieldLabel}>PROVIDER</label>
            <select className={selectClass} value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="ollama">Ollama (Local)</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>
          {provider === 'ollama' ? (
            <div>
              <label className={fieldLabel}>OLLAMA URL</label>
              <Input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" />
              <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">Install: curl -fsSL https://ollama.com/install.sh | sh</span>
            </div>
          ) : (
            <div>
              <label className={fieldLabel}>API KEY</label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider === 'openrouter' ? 'sk-or-...' : provider === 'deepseek' ? 'sk-...' : 'sk-...'} />
              <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
                {provider === 'openrouter' && 'Get key at openrouter.ai/keys'}
                {provider === 'openai' && 'Get key at platform.openai.com/api-keys'}
                {provider === 'deepseek' && 'Get key at platform.deepseek.com/api_keys'}
              </span>
            </div>
          )}
          <div>
            <label className={fieldLabel}>MODEL (optional)</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === 'ollama' ? 'Auto-detect' : provider === 'openrouter' ? 'anthropic/claude-3.5-haiku' : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'} />
            <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">Leave empty for default model</span>
          </div>
          <div className="flex gap-2">
            <Button variant="spectral" size="sm" onClick={handleSave}>Save</Button>
            <Button variant="outline" size="sm" onClick={handleTest}>Test Connection</Button>
            {status && <span className="text-[10px] text-[var(--on-surface-variant)] self-center">{status}</span>}
          </div>
        </div>
      </div>
      <div className={sectionCard}>
        <p className="text-xs text-[var(--on-surface-variant)]">
          AI powers: command suggestions, error explanations, proactive fix suggestions, and the AI Assistant panel.
          API keys are stored locally and never shared. For maximum privacy use Ollama (runs 100% locally).
        </p>
      </div>
    </div>
  )
}

function FontFamilyPicker({
  id,
  value,
  fonts,
  fontSize,
  onChange
}: {
  id: string
  value: string
  fonts: string[]
  fontSize?: number
  onChange: (font: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = search
    ? fonts.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : fonts

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const previewSize = fontSize ?? 14

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      <Input
        id={id}
        value={open ? search : value}
        onChange={(e) => {
          setSearch(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          setSearch('')
        }}
        placeholder="Search fonts..."
      />
      {/* Live terminal preview of selected font */}
      <div
        className="rounded-[var(--radius)] p-3 leading-relaxed overflow-hidden bg-[#0d0d0f]"
        style={{
          fontFamily: `'${value}', monospace`,
          fontSize: `${previewSize}px`
        }}
      >
        <div style={{ color: '#22c55e' }}>user@bifrost<span style={{ color: '#c7c4d7' }}>:</span><span style={{ color: '#3b82f6' }}>~</span><span style={{ color: '#c7c4d7' }}>$</span> <span style={{ color: '#e4e4e7' }}>echo &quot;Hello Bifrost&quot;</span></div>
        <div style={{ color: '#e4e4e7' }}>Hello Bifrost</div>
        <div style={{ color: '#71717a' }}>0123456789 !@#$%^&amp;*() {'{}'} [] &lt;&gt; =&gt; -&gt; != &lt;= &gt;= === !==</div>
        <div style={{ color: '#22c55e' }}>user@bifrost<span style={{ color: '#c7c4d7' }}>:</span><span style={{ color: '#3b82f6' }}>~</span><span style={{ color: '#c7c4d7' }}>$</span> <span style={{ color: '#71717a' }}>▊</span></div>
      </div>
      {open && (
        <div
          className="absolute z-50 top-10 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius)] bg-[var(--surface-container-high)] shadow-lg border border-[rgba(199,196,215,0.1)]"
          role="listbox"
          aria-label="Font families"
        >
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-[var(--on-surface-variant)]">No fonts found</div>
          )}
          {filtered.map((font) => (
            <button
              key={font}
              role="option"
              aria-selected={value === font}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-[var(--surface-container-highest)] transition-colors flex flex-col gap-0.5',
                value === font && 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
              )}
              onClick={() => {
                onChange(font)
                setOpen(false)
                setSearch('')
              }}
            >
              <span className="text-xs truncate text-[var(--on-surface)]">{font}</span>
              <span
                className="text-[13px] text-[var(--on-surface-variant)] leading-tight"
                style={{ fontFamily: `'${font}', monospace` }}
              >
                The quick brown fox jumps 0123456789 =&gt; != {}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
