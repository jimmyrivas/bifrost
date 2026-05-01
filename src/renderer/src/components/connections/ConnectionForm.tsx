import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Eye, EyeOff, Tag, X, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'
import { useConnectionsStore } from '@renderer/stores/connections.store'
import { SshOptionsPanel } from './SshOptionsPanel'
import {
  MultiplexerPanel,
  defaultMultiplexer,
  type MultiplexerConfig
} from './MultiplexerPanel'
import { ConnectionStats } from './ConnectionStats'
import { COLOR_SCHEMES } from '@renderer/lib/color-schemes'

type Method = 'ssh' | 'mosh' | 'rdp' | 'vnc' | 'telnet' | 'local' | 'ftp' | 'custom'
type AuthType = 'userpass' | 'key' | 'key_pass' | 'fido2' | 'manual'
type FormTab = 'general' | 'advanced' | 'session' | 'hooks' | 'terminal'

interface ConnectionFormProps {
  connectionId?: string
  initialData?: Partial<FormState>
  onClose: () => void
}

interface FormState {
  name: string
  method: Method
  host: string
  port: number
  authType: AuthType
  username: string
  password: string
  privateKeyPath: string
  passphrase: string
  launchOnStartup: boolean
  reconnectOnDisconnect: boolean
  runWithSudo: boolean
  tabTitle: string
  autoSaveLog: boolean
  logPattern: string
  sendString: string
  sendIntervalSeconds: number
  sendIdleOnly: boolean
  totpSecret: string
  colorScheme: string
  fontSize: number
  fontFamily: string
  forwardSshAgent: boolean
  rdpClipboard: boolean
  rdpDriveRedirect: boolean
  rdpPrinterRedirect: boolean
  rdpAudioPlayback: boolean
  rdpColorDepth: 15 | 16 | 24 | 32
  rdpFullscreen: boolean
  rdpResolution: string
  customCommand: string
  tags: string
  sshOptions: Record<string, string>
  multiplexer: MultiplexerConfig
  termColorScheme: string
  termBackgroundTint: string
  termBackgroundPreset: 'production' | 'staging' | 'development' | 'custom'
  termFontSize: string
  termCursorStyle: string
  termFontFamily: string
}

interface ValidationErrors {
  host?: string
  port?: string
  name?: string
  customCommand?: string
}

const defaultForm: FormState = {
  name: '', method: 'ssh', host: '', port: 22, authType: 'userpass',
  username: '', password: '', privateKeyPath: '', passphrase: '',
  launchOnStartup: false, reconnectOnDisconnect: false, runWithSudo: false,
  tabTitle: '', autoSaveLog: false, logPattern: '',
  sendString: '', sendIntervalSeconds: 60, sendIdleOnly: true, totpSecret: '',
  colorScheme: '#6b6bff', fontSize: 14, fontFamily: 'JetBrains Mono',
  forwardSshAgent: false,
  rdpClipboard: true, rdpDriveRedirect: false, rdpPrinterRedirect: false,
  rdpAudioPlayback: false, rdpColorDepth: 24, rdpFullscreen: false, rdpResolution: '1280x800',
  customCommand: '',
  tags: '',
  sshOptions: {},
  multiplexer: { ...defaultMultiplexer },
  termColorScheme: '',
  termBackgroundTint: '#0d0d0f',
  termBackgroundPreset: 'development',
  termFontSize: '',
  termCursorStyle: '',
  termFontFamily: ''
}

const selectClass = cn(
  'flex h-9 w-full rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-3 py-1',
  'text-sm text-[var(--on-surface)] ghost-border',
  'focus-visible:outline-none [font-family:var(--font-mono)]'
)

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] mb-3'
const sectionCard = 'rounded-[var(--radius)] bg-[var(--surface-container-high)] p-4'
const fieldLabel = 'text-xs text-[var(--on-surface-variant)] mb-1 block'

const AUTH_TABS: Array<{ id: AuthType; label: string }> = [
  { id: 'key', label: 'KEY FILE' },
  { id: 'userpass', label: 'PASSWORD' },
  { id: 'key_pass', label: 'CERTIFICATE' },
  { id: 'fido2', label: 'HARDWARE KEY' },
]

const METHODS_WITH_TERMINAL: Method[] = ['ssh', 'mosh', 'telnet', 'local', 'custom']
const METHODS_WITH_HOOKS: Method[] = ['ssh', 'mosh', 'telnet', 'local', 'custom']
const METHODS_WITH_MULTIPLEXER: Method[] = ['ssh', 'mosh', 'local']

function getFormTabs(method: Method): Array<{ id: FormTab; label: string }> {
  const tabs: Array<{ id: FormTab; label: string }> = [
    { id: 'general', label: 'GENERAL' },
  ]
  if (method === 'ssh' || method === 'mosh') {
    tabs.push({ id: 'advanced', label: 'ADVANCED SSH' })
  }
  if (METHODS_WITH_MULTIPLEXER.includes(method)) {
    tabs.push({ id: 'session', label: 'SESSION' })
  }
  if (METHODS_WITH_HOOKS.includes(method)) {
    tabs.push({ id: 'hooks', label: 'HOOKS' })
  }
  if (METHODS_WITH_TERMINAL.includes(method)) {
    tabs.push({ id: 'terminal', label: 'TERMINAL' })
  }
  return tabs
}

interface ExecCommand {
  phase: 'pre' | 'post'
  command: string
  ask: boolean
  isDefault: boolean
  sortOrder: number
}

export function ConnectionForm({ connectionId, initialData, onClose }: ConnectionFormProps): JSX.Element {
  const { t } = useTranslation()
  const createConnection = useConnectionsStore((s) => s.createConnection)
  const updateConnection = useConnectionsStore((s) => s.updateConnection)

  const [form, setForm] = useState<FormState>({ ...defaultForm, ...initialData })
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [activeTab, setActiveTab] = useState<FormTab>('general')
  const [execCmds, setExecCmds] = useState<ExecCommand[]>([])
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; config: string }>>([])

  // Load templates
  useEffect(() => {
    window.bifrost?.templates?.list().then(setTemplates).catch(() => {})
  }, [])

  useEffect(() => {
    if (!connectionId) return
    setLoading(true)
    window.bifrost.connections.get(connectionId).then((conn) => {
      if (conn) {
        setForm((prev) => ({
          ...prev,
          name: conn.name ?? prev.name,
          method: (conn.method as Method) ?? prev.method,
          host: conn.host ?? '',
          port: conn.port ?? 22,
          authType: (conn.authType as AuthType) ?? prev.authType,
          username: conn.username ?? '',
          privateKeyPath: conn.privateKeyPath ?? '',
          launchOnStartup: conn.launchOnStartup ?? false,
          reconnectOnDisconnect: conn.reconnectOnDisconnect ?? false,
          runWithSudo: conn.runWithSudo ?? false,
          tabTitle: conn.tabTitle ?? '',
          autoSaveLog: conn.autoSaveLog ?? false,
          logPattern: conn.logPattern ?? '',
          sendString: conn.sendString ?? '',
          sendIntervalSeconds: conn.sendIntervalSeconds ?? 60,
          sendIdleOnly: conn.sendIdleOnly ?? true,
          tags: (() => {
            try {
              const cfg = conn.sshConfig ? JSON.parse(conn.sshConfig) : {}
              return cfg.tags ?? ''
            } catch { return '' }
          })(),
          totpSecret: (() => {
            try {
              const cfg = conn.sshConfig ? JSON.parse(conn.sshConfig) : {}
              return cfg.totpSecret ?? ''
            } catch { return '' }
          })(),
          sshOptions: (() => {
            try {
              const cfg = conn.sshConfig ? JSON.parse(conn.sshConfig) : {}
              return cfg.options ?? {}
            } catch { return {} }
          })(),
          multiplexer: (() => {
            try {
              const cfg = conn.sshConfig ? JSON.parse(conn.sshConfig) : {}
              return { ...defaultMultiplexer, ...(cfg.multiplexer ?? {}) }
            } catch { return { ...defaultMultiplexer } }
          })(),
          ...(() => {
            try {
              const tc = conn.terminalConfig ? JSON.parse(conn.terminalConfig) : {}
              return {
                termColorScheme: tc.colorScheme ?? '',
                termBackgroundTint: tc.backgroundColor ?? '#0d0d0f',
                termBackgroundPreset: tc.backgroundColor === '#1a0505' ? 'production' as const
                  : tc.backgroundColor === '#051a0a' ? 'staging' as const
                  : tc.backgroundColor && tc.backgroundColor !== '#0d0d0f' ? 'custom' as const
                  : 'development' as const,
                termFontSize: tc.fontSize ? String(tc.fontSize) : '',
                termCursorStyle: tc.cursorStyle ?? '',
                termFontFamily: tc.fontFamily ?? ''
              }
            } catch { return {} }
          })()
        }))
      }
      setLoading(false)
      // Load exec commands
      window.bifrost?.execCommands?.list(connectionId).then((cmds) => {
        if (cmds) setExecCmds(cmds.map((c) => ({ phase: c.phase as 'pre' | 'post', command: c.command, ask: c.ask, isDefault: c.isDefault, sortOrder: c.sortOrder })))
      }).catch(() => {})
    })
  }, [connectionId])

  // Reset active tab if current tab no longer available for this method
  useEffect(() => {
    const available = getFormTabs(form.method).map((t) => t.id)
    if (!available.includes(activeTab)) {
      setActiveTab('general')
    }
  }, [form.method, activeTab])

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const validate = useCallback((): boolean => {
    const errs: ValidationErrors = {}
    if (!form.name.trim()) errs.name = 'Connection name is required'
    if (form.method !== 'local' && form.method !== 'custom') {
      if (!form.host.trim()) errs.host = 'Host address is required'
      if (!form.port || form.port < 1 || form.port > 65535) errs.port = 'Port must be 1-65535'
    }
    if (form.method === 'custom' && !form.customCommand.trim()) {
      errs.customCommand = 'Command is required'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [form])

  const handleSave = async (): Promise<void> => {
    if (!validate()) return
    setSaving(true)
    try {
      const sshConfigObj: Record<string, unknown> = {}
      if (form.tags.trim()) sshConfigObj.tags = form.tags.trim()
      if (form.totpSecret.trim()) sshConfigObj.totpSecret = form.totpSecret.trim()
      if (Object.keys(form.sshOptions).length > 0) sshConfigObj.options = form.sshOptions
      if (form.multiplexer.preferred !== 'none') sshConfigObj.multiplexer = form.multiplexer
      const sshConfig = Object.keys(sshConfigObj).length > 0 ? JSON.stringify(sshConfigObj) : undefined

      const termConfigObj: Record<string, unknown> = {}
      if (form.termColorScheme) termConfigObj.colorScheme = form.termColorScheme
      if (form.termBackgroundTint && form.termBackgroundTint !== '#0d0d0f') termConfigObj.backgroundColor = form.termBackgroundTint
      if (form.termFontSize) termConfigObj.fontSize = Number(form.termFontSize)
      if (form.termCursorStyle) termConfigObj.cursorStyle = form.termCursorStyle
      if (form.termFontFamily) termConfigObj.fontFamily = form.termFontFamily
      const terminalConfig = Object.keys(termConfigObj).length > 0 ? JSON.stringify(termConfigObj) : undefined

      const data = {
        name: form.name, method: form.method, host: form.host || undefined,
        port: form.port || undefined, authType: form.authType,
        username: form.username || undefined,
        privateKeyPath: form.privateKeyPath || null,
        launchOnStartup: form.launchOnStartup,
        reconnectOnDisconnect: form.reconnectOnDisconnect,
        runWithSudo: form.runWithSudo, tabTitle: form.tabTitle || undefined,
        autoSaveLog: form.autoSaveLog, logPattern: form.logPattern || undefined,
        sendString: form.sendString || undefined,
        sendIntervalSeconds: form.sendIntervalSeconds || undefined,
        sendIdleOnly: form.sendIdleOnly, groupId: null as string | null,
        sshConfig,
        terminalConfig
      }
      let savedId = connectionId
      if (connectionId) {
        await updateConnection(connectionId, data)
      } else {
        savedId = await createConnection(data)
      }
      if (savedId && form.password) {
        await window.bifrost.credentials.setPassword(savedId, form.password)
      }
      if (savedId && form.passphrase) {
        await window.bifrost.credentials.setPassphrase(savedId, form.passphrase)
      }
      // Save exec commands (hooks)
      if (savedId && execCmds.length > 0) {
        await window.bifrost.execCommands.save(savedId, execCmds)
      }
      onClose()
    } finally { setSaving(false) }
  }

  const needsHost = form.method !== 'local' && form.method !== 'custom'
  const needsAuth = form.method === 'ssh' || form.method === 'mosh'

  return (
    <div className="flex flex-col gap-4 p-6 surface-1 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-[var(--on-surface)]">
            {connectionId ? t('connections.edit', 'Edit Connection') : t('connections.new', 'New Connection')}
          </h2>
          <p className="text-xs text-[var(--on-surface-variant)] mt-1">Configure environment parameters for spectral tunneling.</p>
        </div>
        <div className="flex gap-2 items-center">
          {!connectionId && templates.length > 0 && (
            <select
              className="h-8 rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-2 text-[10px] text-[var(--on-surface)] ghost-border"
              value=""
              onChange={(e) => {
                const tpl = templates.find((t) => t.id === e.target.value)
                if (!tpl) return
                try {
                  const cfg = JSON.parse(tpl.config)
                  setForm((prev) => ({ ...prev, ...cfg, name: prev.name || tpl.name.replace(' Template', '') }))
                } catch { /* invalid config */ }
                e.target.value = ''
              }}
            >
              <option value="">From Template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button variant="spectral" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving...' : connectionId ? t('actions.save', 'Save') : t('connections.save', 'Save')}
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 shrink-0" role="tablist">
        {getFormTabs(form.method).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={cn(
              'px-5 py-2 text-[10px] font-semibold tracking-wider transition-colors rounded-t-[var(--radius)]',
              activeTab === tab.id
                ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/40'
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* ═══ GENERAL TAB ═══ */}
        {activeTab === 'general' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-[1fr_auto] gap-6">
              <div className="flex flex-col gap-6">
                {/* General Configuration */}
                <section>
                  <h3 className={sectionLabel}>{t('connections.general', 'GENERAL CONFIGURATION')}</h3>
                  <div className={sectionCard}>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className={fieldLabel} htmlFor="conn-name">{t('connections.name', 'CONNECTION NAME')}</label>
                        <Input id="conn-name" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
                        {errors.name && <span className="text-[10px] text-[var(--error)] mt-0.5 block">{errors.name}</span>}
                      </div>
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
                        <div>
                          <label className={fieldLabel} htmlFor="conn-method">{t('connections.method', 'PROTOCOL')}</label>
                          <select id="conn-method" className={selectClass} value={form.method} onChange={(e) => set('method', e.target.value as Method)}>
                            <option value="ssh">SSH (Secure Shell)</option>
                            <option value="mosh">Mosh (Mobile Shell)</option>
                            <option value="rdp">RDP</option>
                            <option value="vnc">VNC</option>
                            <option value="telnet">Telnet</option>
                            <option value="local">Local</option>
                            <option value="custom">Custom Command</option>
                          </select>
                        </div>
                        {needsHost && (
                          <>
                            <div>
                              <label className={fieldLabel} htmlFor="conn-host">{t('connections.host', 'HOST ADDRESS')}</label>
                              <Input id="conn-host" value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="10.0.0.133" />
                              {errors.host && <span className="text-[10px] text-[var(--error)] mt-0.5 block">{errors.host}</span>}
                            </div>
                            <div className="w-20">
                              <label className={fieldLabel} htmlFor="conn-port">{t('connections.port', 'PORT')}</label>
                              <Input id="conn-port" type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} />
                              {errors.port && <span className="text-[10px] text-[var(--error)] mt-0.5 block">{errors.port}</span>}
                            </div>
                          </>
                        )}
                        {form.method === 'custom' && (
                          <div className="col-span-full">
                            <label className={fieldLabel} htmlFor="conn-custom-cmd">COMMAND</label>
                            <Input id="conn-custom-cmd" value={form.customCommand} onChange={(e) => set('customCommand', e.target.value)} placeholder="mysql -h host -u user -p" />
                            {errors.customCommand && <span className="text-[10px] text-[var(--error)] mt-0.5 block">{errors.customCommand}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Identity & Access */}
                {needsAuth && (
                  <section>
                    <h3 className={sectionLabel}>{t('connections.identity', 'IDENTITY & ACCESS')}</h3>
                    <div className={sectionCard}>
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className={fieldLabel}>{t('connections.authMethod', 'AUTH METHOD')}</label>
                          <div className="flex gap-0" role="tablist">
                            {AUTH_TABS.map((tab) => (
                              <button
                                key={tab.id} role="tab" aria-selected={form.authType === tab.id}
                                className={cn(
                                  'px-4 py-1.5 text-[10px] font-semibold tracking-wider transition-colors rounded-[var(--radius)]',
                                  form.authType === tab.id
                                    ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                                )}
                                onClick={() => set('authType', tab.id)}
                              >{tab.label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={fieldLabel} htmlFor="conn-user">{t('connections.username', 'USERNAME')}</label>
                            <Input id="conn-user" value={form.username} onChange={(e) => set('username', e.target.value)} />
                          </div>
                          {form.authType === 'userpass' && (
                            <div>
                              <label className={fieldLabel} htmlFor="conn-pass">{t('connections.password', 'PASSWORD')}</label>
                              <div className="relative">
                                <Input id="conn-pass" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} className="pr-9" />
                                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide' : 'Show'}>
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        {form.authType === 'fido2' && (
                          <div className="col-span-2 rounded-[var(--radius)] bg-[#6bd5ff]/5 p-2">
                            <span className="text-[10px] text-[#6bd5ff]">
                              FIDO2/WebAuthn: Use an ed25519-sk or ecdsa-sk key. Requires physical touch on the security key during connection.
                            </span>
                          </div>
                        )}
                        {(form.authType === 'key' || form.authType === 'key_pass' || form.authType === 'fido2') && (
                          <>
                            <div>
                              <label className={fieldLabel} htmlFor="conn-keypath">{t('connections.keyPath', 'PRIVATE KEY FILE')}</label>
                              <div className="flex gap-2">
                                <Input id="conn-keypath" value={form.privateKeyPath} onChange={(e) => set('privateKeyPath', e.target.value)} placeholder="~/.ssh/id_rsa" className="flex-1" />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={t('connections.browse', 'Browse')}
                                  onClick={async () => {
                                    const paths = await window.bifrost?.window?.showOpenDialog?.()
                                    if (paths && paths.length > 0) set('privateKeyPath', paths[0])
                                  }}
                                >
                                  <FolderOpen className="h-4 w-4" /> BROWSE
                                </Button>
                              </div>
                            </div>
                            {form.authType === 'key_pass' && (
                              <div>
                                <label className={fieldLabel} htmlFor="conn-passphrase">KEY PASSPHRASE</label>
                                <div className="relative">
                                  <Input id="conn-passphrase" type={showPassword ? 'text' : 'password'} value={form.passphrase} onChange={(e) => set('passphrase', e.target.value)} placeholder="Passphrase for encrypted key" className="pr-9" />
                                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-xs text-[var(--on-surface-variant)]">Forward SSH Agent</span>
                          <Switch checked={form.forwardSshAgent} onCheckedChange={(v) => set('forwardSshAgent', v)} />
                        </label>
                      </div>
                    </div>
                  </section>
                )}

                {/* RDP Advanced */}
                {form.method === 'rdp' && (
                  <section>
                    <h3 className={sectionLabel}>RDP ADVANCED OPTIONS</h3>
                    <div className={sectionCard}>
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          {([
                            ['rdpClipboard', 'Clipboard Forwarding'],
                            ['rdpDriveRedirect', 'Drive Redirection'],
                            ['rdpPrinterRedirect', 'Printer Redirection'],
                            ['rdpAudioPlayback', 'Audio Playback'],
                            ['rdpFullscreen', 'Fullscreen']
                          ] as const).map(([key, label]) => (
                            <label key={key} className="flex items-center justify-between cursor-pointer">
                              <span className="text-xs text-[var(--on-surface-variant)]">{label}</span>
                              <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
                            </label>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={fieldLabel} htmlFor="rdp-depth">COLOR DEPTH</label>
                            <select id="rdp-depth" className={selectClass} value={form.rdpColorDepth} onChange={(e) => set('rdpColorDepth', Number(e.target.value) as 15 | 16 | 24 | 32)}>
                              <option value={15}>15-bit</option>
                              <option value={16}>16-bit</option>
                              <option value={24}>24-bit</option>
                              <option value={32}>32-bit</option>
                            </select>
                          </div>
                          <div>
                            <label className={fieldLabel} htmlFor="rdp-res">RESOLUTION (WxH)</label>
                            <Input id="rdp-res" value={form.rdpResolution} onChange={(e) => set('rdpResolution', e.target.value)} placeholder="1280x800" disabled={form.rdpFullscreen} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Right column: Behavior + Tags */}
              <div className="w-64 flex flex-col gap-6">
                <section>
                  <h3 className={sectionLabel}>{t('connections.behavior', 'BEHAVIOR')}</h3>
                  <div className={cn(sectionCard, 'flex flex-col gap-3')}>
                    {([
                      ['reconnectOnDisconnect', t('connections.reconnect', 'Auto-reconnect on drop')],
                      ['runWithSudo', t('connections.sudo', 'Elevate (Run with sudo)')],
                      ['autoSaveLog', t('connections.autoLog', 'Auto-save session logs')],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs text-[var(--on-surface-variant)]">{label}</span>
                        <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
                      </label>
                    ))}
                    {needsAuth && (
                      <div>
                        <label className={fieldLabel} htmlFor="conn-totp">TOTP / 2FA SECRET</label>
                        <Input
                          id="conn-totp"
                          value={form.totpSecret}
                          onChange={(e) => set('totpSecret', e.target.value.replace(/\s/g, '').toUpperCase())}
                          placeholder="JBSWY3DPEHPK3PXP"
                          className="h-7 text-xs font-['JetBrains_Mono']"
                          type="password"
                        />
                        <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
                          Base32 secret. Auto-fills verification code during SSH login.
                        </span>
                      </div>
                    )}
                    <div>
                      <label className={fieldLabel} htmlFor="conn-tab-title">TAB TITLE TEMPLATE</label>
                      <Input
                        id="conn-tab-title"
                        value={form.tabTitle}
                        onChange={(e) => set('tabTitle', e.target.value)}
                        placeholder="<USER>@<IP> - <NAME>"
                        className="h-7 text-xs font-['JetBrains_Mono']"
                      />
                      <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
                        Variables: &lt;USER&gt; &lt;IP&gt; &lt;PORT&gt; &lt;NAME&gt; &lt;ENV:name&gt; &lt;GV:name&gt;
                      </span>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className={sectionLabel}>TAGS</h3>
                  <div className={cn(sectionCard, 'flex flex-col gap-2')}>
                    <div className="flex items-center gap-1.5">
                      <Tag size={12} className="text-[var(--on-surface-variant)]" />
                      <Input
                        value={form.tags}
                        onChange={(e) => set('tags', e.target.value)}
                        placeholder="web, production, us-east"
                        className="h-7 text-xs"
                        aria-label="Tags (comma-separated)"
                      />
                    </div>
                    {form.tags && (
                      <div className="flex flex-wrap gap-1">
                        {form.tags.split(',').map((tag, i) => {
                          const t = tag.trim()
                          if (!t) return null
                          return (
                            <span key={i} className="px-1.5 py-0.5 rounded-[var(--radius)] text-[9px] font-semibold bg-[#6bd5ff]/15 text-[#6bd5ff]">
                              {t}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </section>

                {connectionId && (
                  <section>
                    <h3 className={sectionLabel}>STATISTICS</h3>
                    <div className={sectionCard}>
                      <ConnectionStats connectionId={connectionId} connectionName={form.name || 'Connection'} />
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ADVANCED SSH TAB ═══ */}
        {activeTab === 'advanced' && (
          <div className="flex flex-col gap-6">
            {/* Port Forwarding */}
            <PortForwardingSection
              options={form.sshOptions}
              onChange={(opts) => set('sshOptions', opts)}
            />
            <SshOptionsPanel
              options={form.sshOptions}
              onChange={(opts) => set('sshOptions', opts)}
            />
          </div>
        )}

        {/* ═══ SESSION TAB ═══ */}
        {activeTab === 'session' && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[var(--on-surface-variant)]">
              Persist your shell across reconnects with dtach or tmux. Bifrost will probe the host
              for the chosen tool and offer existing sessions to attach.
            </p>
            <MultiplexerPanel
              value={form.multiplexer}
              onChange={(next) => set('multiplexer', next)}
              disabled={form.method === 'mosh'}
              disabledReason={
                form.method === 'mosh'
                  ? 'Mosh already keeps sessions alive across disconnects, so a multiplexer is not needed.'
                  : undefined
              }
            />
          </div>
        )}

        {/* ═══ HOOKS TAB ═══ */}
        {activeTab === 'hooks' && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[var(--on-surface-variant)]">
              Commands executed before or after establishing the connection. Use variables: &lt;USER&gt; &lt;IP&gt; &lt;NAME&gt;
            </p>
            {execCmds.length > 0 && (
              <div className={cn(sectionCard, 'flex flex-col gap-2 p-3')}>
                {execCmds.map((cmd, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      className="h-7 rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-2 text-[10px] text-[var(--on-surface)] ghost-border w-16 shrink-0"
                      value={cmd.phase}
                      onChange={(e) => {
                        const next = [...execCmds]
                        next[idx] = { ...cmd, phase: e.target.value as 'pre' | 'post' }
                        setExecCmds(next)
                      }}
                    >
                      <option value="pre">PRE</option>
                      <option value="post">POST</option>
                    </select>
                    <Input
                      value={cmd.command}
                      onChange={(e) => {
                        const next = [...execCmds]
                        next[idx] = { ...cmd, command: e.target.value }
                        setExecCmds(next)
                      }}
                      placeholder="echo 'connecting...'"
                      className="flex-1 h-7 text-xs font-[family-name:var(--font-mono)]"
                    />
                    <label className="flex items-center gap-1 shrink-0 cursor-pointer" title="Ask before execute">
                      <input
                        type="checkbox"
                        checked={cmd.ask}
                        onChange={(e) => {
                          const next = [...execCmds]
                          next[idx] = { ...cmd, ask: e.target.checked }
                          setExecCmds(next)
                        }}
                        className="w-3 h-3 accent-[#6bd5ff]"
                      />
                      <span className="text-[9px] text-[var(--on-surface-variant)]">Ask</span>
                    </label>
                    <button
                      onClick={() => setExecCmds(execCmds.filter((_, i) => i !== idx))}
                      className="text-[var(--on-surface-variant)] hover:text-[var(--error)] p-0.5 shrink-0"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setExecCmds([...execCmds, { phase: 'pre', command: '', ask: false, isDefault: true, sortOrder: execCmds.length }])}
            >
              + Add Hook
            </Button>
          </div>
        )}

        {/* ═══ TERMINAL TAB ═══ */}
        {activeTab === 'terminal' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Left column: scheme + tint + font */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className={fieldLabel} htmlFor="conn-term-scheme">COLOR SCHEME</label>
                  <select id="conn-term-scheme" className={selectClass} value={form.termColorScheme} onChange={(e) => set('termColorScheme', e.target.value)}>
                    <option value="">Global default</option>
                    {COLOR_SCHEMES.map((s) => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>ENVIRONMENT TINT</label>
                  <div className="flex gap-1.5 mt-1">
                    {([
                      { id: 'production', color: '#1a0505', label: 'Production', emoji: '🔴' },
                      { id: 'staging', color: '#051a0a', label: 'Staging', emoji: '🟢' },
                      { id: 'development', color: '#0d0d0f', label: 'Default', emoji: '⚫' },
                      { id: 'custom', color: form.termBackgroundTint, label: 'Custom', emoji: '🎨' }
                    ] as const).map((p) => (
                      <button key={p.id} onClick={() => { set('termBackgroundPreset', p.id); if (p.id !== 'custom') set('termBackgroundTint', p.color) }}
                        className={cn('flex-1 flex flex-col items-center gap-1 py-2 rounded-[var(--radius)] text-[10px] transition-colors',
                          form.termBackgroundPreset === p.id ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)] ring-1 ring-[var(--outline-variant)]' : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-highest)]/50')}>
                        <span className="w-5 h-5 rounded-full" style={{ backgroundColor: p.color, border: '1px solid rgba(199,196,215,0.15)' }} />
                        <span className="font-semibold">{p.label}</span>
                      </button>
                    ))}
                  </div>
                  {form.termBackgroundPreset === 'custom' && (
                    <div className="mt-2 flex items-center gap-2">
                      <input type="color" value={form.termBackgroundTint} onChange={(e) => set('termBackgroundTint', e.target.value)} className="w-8 h-8 rounded-[var(--radius)] border-none cursor-pointer bg-transparent" />
                      <Input value={form.termBackgroundTint} onChange={(e) => set('termBackgroundTint', e.target.value)} placeholder="#1a0505" className="flex-1 h-7 text-xs" />
                    </div>
                  )}
                </div>
                <div>
                  <label className={fieldLabel}>FONT FAMILY</label>
                  <FontFamilySelect value={form.termFontFamily} onChange={(v) => set('termFontFamily', v)} />
                </div>
              </div>
              {/* Right column: size + cursor + preview */}
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={fieldLabel} htmlFor="conn-term-fontsize">FONT SIZE</label>
                    <Input id="conn-term-fontsize" type="number" min={8} max={32} value={form.termFontSize} onChange={(e) => set('termFontSize', e.target.value)} placeholder="14" />
                  </div>
                  <div>
                    <label className={fieldLabel} htmlFor="conn-term-cursor">CURSOR</label>
                    <select id="conn-term-cursor" className={selectClass} value={form.termCursorStyle} onChange={(e) => set('termCursorStyle', e.target.value)}>
                      <option value="">Default</option>
                      <option value="block">Block ▊</option>
                      <option value="underline">Underline _</option>
                      <option value="bar">Bar |</option>
                    </select>
                  </div>
                </div>
                {/* Live preview */}
                <div>
                  <label className={fieldLabel}>PREVIEW</label>
                  <div
                    className="rounded-[var(--radius)] p-3 leading-relaxed overflow-hidden"
                    style={{
                      backgroundColor: form.termBackgroundTint || '#0d0d0f',
                      fontFamily: form.termFontFamily || "'JetBrains Mono', monospace",
                      fontSize: `${form.termFontSize || 14}px`,
                      minHeight: '140px'
                    }}
                  >
                    <div style={{ color: '#22c55e' }}><span style={{ color: '#3b82f6' }}>{form.username || 'user'}@{form.host || 'server'}</span>:<span style={{ color: '#a855f7' }}>~</span>$<span style={{ color: '#e4e4e7' }}> systemctl status nginx</span></div>
                    <div style={{ color: '#22c55e' }}>● nginx.service - A high performance web server</div>
                    <div style={{ color: '#c7c4d7' }}>&nbsp;&nbsp;Active: <span style={{ color: '#22c55e' }}>active (running)</span> since Mon 2025-01-20</div>
                    <div style={{ color: '#c7c4d7' }}>&nbsp;&nbsp;Memory: <span style={{ color: '#eab308' }}>4.2M</span> | Tasks: <span style={{ color: '#eab308' }}>3</span></div>
                    <div style={{ color: '#71717a' }}>0123456789 =&gt; -&gt; != &lt;= &gt;= === !== &amp;&amp; ||</div>
                    <div style={{ color: '#22c55e' }}><span style={{ color: '#3b82f6' }}>{form.username || 'user'}@{form.host || 'server'}</span>:<span style={{ color: '#a855f7' }}>~</span>$ <span style={{ color: '#71717a' }}>{form.termCursorStyle === 'underline' ? '_' : form.termCursorStyle === 'bar' ? '|' : '▊'}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PortForwardingSection({ options, onChange }: { options: Record<string, string>; onChange: (opts: Record<string, string>) => void }): JSX.Element {
  const types = [
    { key: 'LocalForward', label: 'Local', placeholder: '8080 localhost:80', desc: 'Forward local port to remote' },
    { key: 'RemoteForward', label: 'Remote', placeholder: '9090 localhost:3000', desc: 'Forward remote port to local' },
    { key: 'DynamicForward', label: 'Dynamic (SOCKS)', placeholder: '1080', desc: 'SOCKS proxy on local port' }
  ] as const

  const addForward = (key: string, value: string): void => {
    const existing = options[key]
    const next = { ...options }
    // Append with semicolon separator for multiple forwards
    next[key] = existing ? `${existing};${value}` : value
    onChange(next)
  }

  const removeForward = (key: string, idx: number): void => {
    const parts = (options[key] ?? '').split(';').filter(Boolean)
    parts.splice(idx, 1)
    const next = { ...options }
    if (parts.length === 0) {
      delete next[key]
    } else {
      next[key] = parts.join(';')
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
        Port Forwarding
      </span>
      {types.map(({ key, label, placeholder, desc }) => {
        const forwards = (options[key] ?? '').split(';').filter(Boolean)
        return (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--on-surface)]">{label}</span>
              <button
                onClick={() => {
                  const val = window.prompt(`${label} forward (e.g. ${placeholder}):`)
                  if (val?.trim()) addForward(key, val.trim())
                }}
                className="text-[9px] text-[#6bd5ff] hover:underline"
              >
                + Add
              </button>
            </div>
            <span className="text-[9px] text-[var(--on-surface-variant)]">{desc}</span>
            {forwards.length > 0 && (
              <div className="flex flex-col gap-0.5 pl-2">
                {forwards.map((fwd, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px]">
                    <span className="font-[family-name:var(--font-mono)] text-[var(--on-surface)] flex-1">{fwd}</span>
                    <button onClick={() => removeForward(key, idx)} className="text-[var(--on-surface-variant)] hover:text-[var(--error)] p-0.5">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FontFamilySelect({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const [fonts, setFonts] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.bifrost?.fonts?.listMonospace().then((f) => setFonts(f)).catch(() => {
      setFonts(['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro', 'Meslo LG S', 'Menlo', 'Ubuntu Mono', 'Hack', 'Inconsolata', 'monospace'])
    })
  }, [])

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

  const filtered = filter ? fonts.filter((f) => f.toLowerCase().includes(filter.toLowerCase())) : fonts

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(selectClass, 'text-left justify-between cursor-pointer')}
      >
        <span className="truncate" style={{ fontFamily: value || 'inherit' }}>{value || 'Global default'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-[var(--radius)] bg-[var(--surface-container-high)] shadow-lg max-h-64 overflow-hidden flex flex-col border border-[rgba(199,196,215,0.1)]">
          <div className="p-1.5">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search fonts..."
              className="w-full bg-[var(--surface-container-highest)] rounded-[var(--radius)] px-2 py-1 text-xs text-[var(--on-surface)] outline-none placeholder-[var(--on-surface-variant)]/50"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            <button type="button" onClick={() => { onChange(''); setOpen(false); setFilter('') }}
              className={cn('w-full text-left px-3 py-2 text-xs hover:bg-[var(--surface-bright)]/10 transition-colors', !value && 'text-[var(--on-surface)] bg-[var(--surface-bright)]/5')}>
              Global default
            </button>
            {filtered.map((f) => (
              <button key={f} type="button" onClick={() => { onChange(f); setOpen(false); setFilter('') }}
                className={cn('w-full text-left px-3 py-2 hover:bg-[var(--surface-bright)]/10 transition-colors flex flex-col gap-0.5', value === f && 'text-[var(--on-surface)] bg-[var(--surface-bright)]/5')}>
                <span className="text-xs truncate text-[var(--on-surface)]">{f}</span>
                <span className="text-[13px] text-[var(--on-surface-variant)] leading-tight" style={{ fontFamily: `'${f}', monospace` }}>
                  The quick brown fox 0123 =&gt; !=
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
