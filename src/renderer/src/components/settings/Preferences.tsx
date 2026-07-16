import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Globe, Network, KeyRound, GitBranch, Puzzle, Shield, Lock, Bot, Keyboard, Cpu, FolderInput, Radar } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore, type TerminalPreferences } from '@renderer/stores/preferences.store'
import { ColorSchemeSelector } from './ColorSchemeSelector'
import { ConfigSync } from './ConfigSync'
import { PluginManager } from './PluginManager'
import { KeyBindings } from './KeyBindings'
import { KnownHostsPanel } from './KnownHostsPanel'
import { MultiplexerPanel } from '@renderer/components/connections/MultiplexerPanel'
import { CaptureFilesBrowser, type CaptureTab } from '@renderer/components/terminal/CaptureFilesBrowser'
import { ImportExportPanel } from './ImportExportPanel'
import { DiscoveryPanel } from './DiscoveryPanel'
import { DbEncryptionSection } from './DbEncryptionSection'
import { SecretsManagersPanel } from './SecretsManagersPanel'
import { SshCaPanel } from './SshCaPanel'
import { showToast } from '@renderer/lib/protocol-dispatch'

type PrefsTab = 'terminal' | 'ai' | 'ssh' | 'security' | 'secrets' | 'keybindings' | 'language' | 'network' | 'keepass' | 'sync' | 'plugins' | 'mcp' | 'import' | 'discovery'

const tabConfig: Array<{ id: PrefsTab; icon: typeof Monitor; labelKey: string; fallback: string }> = [
  { id: 'terminal', icon: Monitor, labelKey: 'prefs.terminal', fallback: 'Terminal' },
  { id: 'ai', icon: Bot, labelKey: 'prefs.ai', fallback: 'AI' },
  { id: 'mcp', icon: Cpu, labelKey: 'prefs.mcp', fallback: 'MCP Server' },
  { id: 'ssh', icon: Shield, labelKey: 'prefs.ssh', fallback: 'SSH' },
  { id: 'security', icon: Lock, labelKey: 'prefs.security', fallback: 'Security' },
  { id: 'secrets', icon: KeyRound, labelKey: 'prefs.secrets', fallback: 'Secret Managers' },
  { id: 'keybindings', icon: Keyboard, labelKey: 'prefs.keybindings', fallback: 'Key Bindings' },
  { id: 'language', icon: Globe, labelKey: 'prefs.language', fallback: 'Language' },
  { id: 'network', icon: Network, labelKey: 'prefs.network', fallback: 'Network' },
  { id: 'import', icon: FolderInput, labelKey: 'prefs.import', fallback: 'Import / Export' },
  { id: 'discovery', icon: Radar, labelKey: 'prefs.discovery', fallback: 'Discovery' },
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
  const localMultiplexer = usePreferencesStore((s) => s.localMultiplexer)
  const setLocalMultiplexer = usePreferencesStore((s) => s.setLocalMultiplexer)
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
                <label className="flex items-center justify-between col-span-2 cursor-pointer">
                  <span className="text-xs text-[var(--on-surface-variant)]">
                    Paste image to server
                    <span className="block text-[9px] text-[var(--on-surface-variant)]/70">
                      On SSH tabs, pasting an image uploads it and types the remote path
                    </span>
                  </span>
                  <Switch checked={terminal.imagePasteEnabled} onCheckedChange={(v) => setTermPref('imagePasteEnabled', v)} />
                </label>
                <div className="col-span-2">
                  <label className={fieldLabel} htmlFor="pref-image-dir">IMAGE UPLOAD DIRECTORY (REMOTE)</label>
                  <Input
                    id="pref-image-dir"
                    value={terminal.imagePasteDir}
                    onChange={(e) => setTermPref('imagePasteDir', e.target.value)}
                    placeholder="~/.bifrost/pastes"
                    className="font-['JetBrains_Mono'] text-xs"
                  />
                  <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
                    Where pasted images are stored on the server. <code>~</code> expands to the remote home.
                  </span>
                </div>
                <label className="flex items-center justify-between col-span-2 cursor-pointer">
                  <span className="text-xs text-[var(--on-surface-variant)]">Delete uploaded images on app close</span>
                  <Switch checked={terminal.imagePasteDeleteOnClose} onCheckedChange={(v) => setTermPref('imagePasteDeleteOnClose', v)} />
                </label>
                <label className="flex items-center justify-between col-span-2 cursor-pointer">
                  <span className="text-xs text-[var(--on-surface-variant)]">
                    Markdown file links
                    <span className="block text-[9px] text-[var(--on-surface-variant)]/70">
                      Turn <code>.md</code> paths in SSH output into links that open an internal viewer
                    </span>
                  </span>
                  <Switch checked={terminal.markdownLinksEnabled} onCheckedChange={(v) => setTermPref('markdownLinksEnabled', v)} />
                </label>
                <div className="col-span-2">
                  <label className={fieldLabel} htmlFor="pref-md-activation">MARKDOWN LINK ACTIVATION</label>
                  <select
                    id="pref-md-activation"
                    className={selectClass}
                    value={terminal.markdownLinkActivation}
                    onChange={(e) => setTermPref('markdownLinkActivation', e.target.value as TerminalPreferences['markdownLinkActivation'])}
                  >
                    <option value="ctrl-click">Ctrl+Click (recommended)</option>
                    <option value="click">Single click</option>
                  </select>
                  <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
                    Single click can interfere with text selection in the terminal.
                  </span>
                </div>
                <div className="col-span-2">
                  <label className={fieldLabel} htmlFor="pref-md-maxkb">MARKDOWN VIEWER SIZE LIMIT (KB)</label>
                  <Input
                    id="pref-md-maxkb"
                    type="number"
                    min={1}
                    max={20000}
                    value={Math.round(terminal.markdownMaxBytes / 1024)}
                    onChange={(e) => {
                      const kb = Number(e.target.value)
                      if (Number.isFinite(kb) && kb > 0) {
                        setTermPref('markdownMaxBytes', Math.min(Math.max(kb, 1), 20000) * 1024)
                      }
                    }}
                    className="font-['JetBrains_Mono'] text-xs"
                  />
                  <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
                    Files larger than this are truncated in the viewer. Default 2048 KB (2 MB).
                  </span>
                </div>
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
            <div className={sectionCard}>
              <h4 className="text-xs font-semibold text-[var(--on-surface)] uppercase tracking-wider mb-1">
                Local session persistence
              </h4>
              <p className="text-[10px] text-[var(--on-surface-variant)] mb-3">
                Wrap new local terminal tabs in dtach, tmux or zellij so the
                shell survives accidental tab closes and app restarts. Pick a
                multiplexer here and Bifrost will offer you any existing
                sessions when you open a new local tab.
              </p>
              <MultiplexerPanel
                value={localMultiplexer}
                onChange={setLocalMultiplexer}
              />
            </div>
            <div className={sectionCard}>
              <SessionCaptureSection />
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
                  <div className="flex gap-2">
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!window.confirm('Re-encrypt every stored credential with the current keychain key?')) return
                        try {
                          const { reEncrypted } = await window.bifrost.credentials.changeVaultPassword()
                          showToast({ variant: 'success', message: `Re-encrypted ${reEncrypted} secret${reEncrypted === 1 ? '' : 's'}` })
                        } catch (err) {
                          showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
                        }
                      }}
                    >
                      Re-encrypt vault
                    </Button>
                  </div>
                </div>
                <div className="h-[1px] bg-[var(--surface-container-highest)]" />
                <DbEncryptionSection />
                <div className="h-[1px] bg-[var(--surface-container-highest)]" />
                <div>
                  <label className={fieldLabel}>SECRET REDACTION</label>
                  <p className="text-xs text-[var(--on-surface-variant)] mb-3">
                    Automatically mask API keys, tokens, and passwords in terminal output. Prevents accidental exposure.
                  </p>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-[var(--on-surface-variant)]">Redact secrets in terminal output</span>
                    <Switch
                      checked={terminal.secretRedactionEnabled}
                      onCheckedChange={(v) => setTerminalPref('secretRedactionEnabled', v)}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'keybindings' && (
          <KeyBindings />
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

        {activeTab === 'secrets' && (
          <div className="flex flex-col gap-8">
            <SecretsManagersPanel />
            <SshCaPanel />
          </div>
        )}

        {activeTab === 'import' && (
          <ImportExportPanel />
        )}

        {activeTab === 'discovery' && (
          <DiscoveryPanel />
        )}

        {activeTab === 'sync' && (
          <ConfigSync />
        )}

        {activeTab === 'plugins' && (
          <PluginManager />
        )}

        {activeTab === 'mcp' && (
          <McpSettingsPanel />
        )}
      </div>
    </div>
  )
}

/** Read-only utility surface: shows where session recordings and logs live and opens them. */
function SessionCaptureSection(): JSX.Element {
  const [recordingsDir, setRecordingsDir] = useState<string | null>(null)
  const [logDir, setLogDir] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [browserTab, setBrowserTab] = useState<CaptureTab | null>(null)

  useEffect(() => {
    window.bifrost?.system?.getRecordingsDir?.().then(setRecordingsDir).catch(() => {})
    window.bifrost?.system?.getLogDir?.().then(setLogDir).catch(() => {})
  }, [])

  const openFolder = useCallback(async (dir: string | null) => {
    if (!dir) return
    setOpenError(null)
    try {
      const result = await window.bifrost?.system?.openPath?.(dir)
      if (result) setOpenError(result)
    } catch (err) {
      setOpenError((err as Error).message)
    }
  }, [])

  const pathRow = (
    label: string,
    dir: string | null,
    tab: CaptureTab
  ): JSX.Element => (
    <div>
      <label className={fieldLabel}>{label}</label>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0 flex h-9 items-center rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-3 text-xs text-[var(--on-surface)] [font-family:var(--font-mono)]">
          <span className="truncate" title={dir ?? undefined}>
            {dir ?? 'Resolving…'}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setBrowserTab(tab)}>
          Browse…
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!dir}
          onClick={() => openFolder(dir)}
        >
          Open
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-xs font-semibold text-[var(--on-surface)] uppercase tracking-wider">
        Session Capture
      </h4>
      <p className="text-[10px] text-[var(--on-surface-variant)]">
        Session <span className="text-[var(--on-surface)]">recordings</span> are asciicast{' '}
        <code className="font-mono bg-[var(--surface-container-highest)] px-1 rounded">.cast</code>{' '}
        files you can replay with{' '}
        <code className="font-mono bg-[var(--surface-container-highest)] px-1 rounded">asciinema play &lt;file&gt;</code>.
        Session <span className="text-[var(--on-surface)]">logs</span> are plain-text transcripts of terminal
        output. Both live under Bifrost&apos;s user-data folder. Recording is started per-session from the
        terminal&apos;s right-click → Capture menu.
      </p>
      {pathRow('RECORDINGS FOLDER', recordingsDir, 'recordings')}
      {pathRow('SESSION LOGS FOLDER', logDir, 'logs')}
      {openError && (
        <span className="text-[9px] text-[#ef4444] block">Could not open folder: {openError}</span>
      )}
      <CaptureFilesBrowser
        open={browserTab !== null}
        defaultTab={browserTab ?? 'recordings'}
        onClose={() => setBrowserTab(null)}
      />
    </div>
  )
}

function McpSettingsPanel(): JSX.Element {
  const [config, setConfig] = useState<{
    enabled: boolean
    transport: 'stdio' | 'http'
    port: number
    securityLevel: 0 | 1 | 2
    autoStart: boolean
    token: string
  } | null>(null)
  const [status, setStatus] = useState<{
    running: boolean
    pid: number | null
    transport: 'stdio' | 'http' | null
    port: number | null
    uptime: number | null
    logs: string[]
  } | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const [cfg, st] = await Promise.all([
      window.bifrost?.mcp?.getConfig(),
      window.bifrost?.mcp?.status()
    ])
    if (cfg) setConfig(cfg)
    if (st) {
      setStatus(st)
      setLogs(st.logs)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, showLogs])

  const updateConfig = async (updates: Partial<NonNullable<typeof config>>): Promise<void> => {
    const result = await window.bifrost?.mcp?.setConfig(updates)
    if (result) setConfig(result as NonNullable<typeof config>)
  }

  const handleStart = async (): Promise<void> => {
    try {
      setActionStatus('Starting...')
      await updateConfig({ enabled: true })
      await window.bifrost?.mcp?.start()
      setActionStatus('Started')
      setTimeout(() => { setActionStatus(null); refresh() }, 1500)
    } catch (err) {
      setActionStatus(`Error: ${(err as Error).message}`)
      setTimeout(() => setActionStatus(null), 3000)
    }
  }

  const handleStop = async (): Promise<void> => {
    try {
      setActionStatus('Stopping...')
      await window.bifrost?.mcp?.stop()
      setActionStatus('Stopped')
      setTimeout(() => { setActionStatus(null); refresh() }, 1500)
    } catch (err) {
      setActionStatus(`Error: ${(err as Error).message}`)
      setTimeout(() => setActionStatus(null), 3000)
    }
  }

  const handleRegenToken = async (): Promise<void> => {
    const token = await window.bifrost?.mcp?.generateToken()
    if (token && config) {
      setConfig({ ...config, token })
      setShowToken(true)
    }
  }

  if (!config) return <div className="text-xs text-[var(--on-surface-variant)]">Loading...</div>

  const uptime = status?.uptime
    ? `${Math.floor(status.uptime / 60000)}m ${Math.floor((status.uptime % 60000) / 1000)}s`
    : null

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <h3 className="text-sm font-semibold text-[var(--on-surface)]">MCP Server</h3>

      {/* Status card */}
      <div className={sectionCard}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-block w-2 h-2 rounded-full',
              status?.running ? 'bg-[#22c55e]' : 'bg-[#c7c4d7]/30'
            )} />
            <span className="text-xs font-medium text-[var(--on-surface)]">
              {status?.running ? 'Running' : 'Stopped'}
            </span>
            {status?.running && status.pid && (
              <span className="text-[10px] text-[var(--on-surface-variant)]">PID {status.pid}</span>
            )}
            {uptime && (
              <span className="text-[10px] text-[var(--on-surface-variant)]">Uptime: {uptime}</span>
            )}
          </div>
          <div className="flex gap-2">
            {!status?.running ? (
              <Button variant="spectral" size="sm" onClick={handleStart}>Start</Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleStop}>Stop</Button>
            )}
          </div>
        </div>
        {status?.running && config.transport === 'http' && (
          <div className="text-[10px] text-[var(--on-surface-variant)] font-mono bg-[var(--surface-container-highest)] rounded px-2 py-1">
            http://127.0.0.1:{config.port}/mcp
          </div>
        )}
        {actionStatus && (
          <span className="text-[10px] text-[var(--on-surface-variant)] mt-1 block">{actionStatus}</span>
        )}
      </div>

      {/* Configuration */}
      <div className={sectionCard}>
        <div className="flex flex-col gap-4">
          <div>
            <label className={fieldLabel}>TRANSPORT</label>
            <select
              className={selectClass}
              value={config.transport}
              onChange={(e) => updateConfig({ transport: e.target.value as 'stdio' | 'http' })}
            >
              <option value="http">HTTP (remote access, web clients)</option>
              <option value="stdio">Stdio (Claude Code, Cursor — local only)</option>
            </select>
            <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
              {config.transport === 'http'
                ? 'Starts an HTTP server for remote AI clients. Requires a token for security.'
                : 'Stdio is used when Claude Code or Cursor spawns the MCP server as a child process.'}
            </span>
          </div>

          {config.transport === 'http' && (
            <div>
              <label className={fieldLabel}>PORT</label>
              <Input
                type="number"
                min={1024}
                max={65535}
                value={config.port}
                onChange={(e) => updateConfig({ port: Number(e.target.value) })}
              />
            </div>
          )}

          <div>
            <label className={fieldLabel}>SECURITY LEVEL</label>
            <select
              className={selectClass}
              value={config.securityLevel}
              onChange={(e) => updateConfig({ securityLevel: Number(e.target.value) as 0 | 1 | 2 })}
            >
              <option value={0}>0 — Read only (list connections, audit, health)</option>
              <option value={1}>1 — Execute (SSH, terminal, discovery, snippets)</option>
              <option value={2}>2 — Full (SFTP write, cluster broadcast, tunnel create)</option>
            </select>
          </div>

          {config.transport === 'http' && (
            <div>
              <label className={fieldLabel}>API TOKEN</label>
              <div className="flex gap-2">
                <Input
                  type={showToken ? 'text' : 'password'}
                  value={config.token}
                  readOnly
                  className="font-mono text-xs flex-1"
                  onClick={() => setShowToken(!showToken)}
                />
                <Button variant="outline" size="sm" onClick={handleRegenToken} title="Generate new token">
                  Regenerate
                </Button>
              </div>
              <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
                Required for HTTP transport. Click to show/hide. Use as: Authorization: Bearer &lt;token&gt;
              </span>
            </div>
          )}

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-[var(--on-surface-variant)]">Start MCP server with Bifrost</span>
            <Switch
              checked={config.autoStart}
              onCheckedChange={(v) => updateConfig({ autoStart: v, enabled: v })}
            />
          </label>
        </div>
      </div>

      {/* Claude Code config snippet */}
      <div className={sectionCard}>
        <label className={fieldLabel}>CLAUDE CODE CONFIGURATION</label>
        <p className="text-[10px] text-[var(--on-surface-variant)] mb-2">
          Add this to your Claude Code settings or run <code className="font-mono bg-[var(--surface-container-highest)] px-1 rounded">npm run mcp:install</code>
        </p>
        <pre className="text-[10px] font-mono bg-[#0d0d0f] rounded p-2 overflow-x-auto text-[#c7c4d7] leading-relaxed select-all">
{config.transport === 'http'
  ? `"bifrost": {
  "url": "http://127.0.0.1:${config.port}/mcp",
  "headers": {
    "Authorization": "Bearer ${showToken ? config.token : '<token>'}"
  }
}`
  : `"bifrost": {
  "command": "npx",
  "args": ["tsx", "src/mcp/index.ts"]
}`}
        </pre>
      </div>

      {/* Logs */}
      <div className={sectionCard}>
        <button
          className="text-xs text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors w-full text-left"
          onClick={() => { setShowLogs(!showLogs); if (!showLogs) refresh() }}
        >
          {showLogs ? '▾ Hide Logs' : '▸ Show Logs'} ({logs.length} entries)
        </button>
        {showLogs && (
          <div className="mt-2 max-h-48 overflow-y-auto bg-[#0d0d0f] rounded p-2">
            {logs.length === 0 ? (
              <span className="text-[10px] text-[#71717a] font-mono">No logs yet. Start the server to see output.</span>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="text-[10px] font-mono text-[#c7c4d7]/80 leading-relaxed whitespace-pre-wrap">
                  {line}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className={sectionCard}>
        <p className="text-xs text-[var(--on-surface-variant)]">
          The MCP server exposes Bifrost&apos;s infrastructure management (SSH, SFTP, tunnels, clusters, discovery)
          to AI agents via the Model Context Protocol. 42 tools, 9 resources, 8 prompt templates.
        </p>
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
