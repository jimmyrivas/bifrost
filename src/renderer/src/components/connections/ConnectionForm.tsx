import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Eye, EyeOff, Tag } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'
import { useConnectionsStore } from '@renderer/stores/connections.store'
import { SshOptionsPanel } from './SshOptionsPanel'

type Method = 'ssh' | 'rdp' | 'vnc' | 'telnet' | 'local' | 'ftp' | 'custom'
type AuthType = 'userpass' | 'key' | 'key_pass' | 'manual'

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
  colorScheme: string
  fontSize: number
  fontFamily: string
  // SSH agent forwarding (#20)
  forwardSshAgent: boolean
  // RDP advanced (#47)
  rdpClipboard: boolean
  rdpDriveRedirect: boolean
  rdpPrinterRedirect: boolean
  rdpAudioPlayback: boolean
  rdpColorDepth: 15 | 16 | 24 | 32
  rdpFullscreen: boolean
  rdpResolution: string
  // Custom command (#46)
  customCommand: string
  // Tags (#102)
  tags: string
  // SSH advanced options (#67)
  sshOptions: Record<string, string>
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
  sendString: '', sendIntervalSeconds: 60, sendIdleOnly: true,
  colorScheme: '#6b6bff', fontSize: 14, fontFamily: 'JetBrains Mono',
  forwardSshAgent: false,
  rdpClipboard: true, rdpDriveRedirect: false, rdpPrinterRedirect: false,
  rdpAudioPlayback: false, rdpColorDepth: 24, rdpFullscreen: false, rdpResolution: '1280x800',
  customCommand: '',
  tags: '',
  sshOptions: {}
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
]

const COLOR_OPTIONS = ['#6b6bff', '#d56bff', '#ff6b6b', '#ffa36b', '#22c55e', '#6bd5ff', '#ffd56b', '#c7c4d7']

export function ConnectionForm({ connectionId, initialData, onClose }: ConnectionFormProps): JSX.Element {
  const { t } = useTranslation()
  const createConnection = useConnectionsStore((s) => s.createConnection)
  const updateConnection = useConnectionsStore((s) => s.updateConnection)

  const [form, setForm] = useState<FormState>({ ...defaultForm, ...initialData })
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})

  // Load existing connection data when editing
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
          sshOptions: (() => {
            try {
              const cfg = conn.sshConfig ? JSON.parse(conn.sshConfig) : {}
              return cfg.options ?? {}
            } catch { return {} }
          })()
        }))
      }
      setLoading(false)
    })
  }, [connectionId])

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
      // Build sshConfig JSON with tags (#102) and SSH options (#67)
      const sshConfigObj: Record<string, unknown> = {}
      if (form.tags.trim()) sshConfigObj.tags = form.tags.trim()
      if (Object.keys(form.sshOptions).length > 0) sshConfigObj.options = form.sshOptions
      const sshConfig = Object.keys(sshConfigObj).length > 0 ? JSON.stringify(sshConfigObj) : undefined

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
        sshConfig
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
      onClose()
    } finally { setSaving(false) }
  }

  const needsHost = form.method !== 'local' && form.method !== 'custom'
  const needsAuth = form.method === 'ssh'

  return (
    <div className="flex flex-col gap-6 p-6 surface-1 max-h-[80vh] overflow-y-auto">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--on-surface)]">
            {connectionId ? t('connections.edit', 'Edit Connection') : t('connections.new', 'New Connection')}
          </h2>
          <p className="text-xs text-[var(--on-surface-variant)] mt-1">Configure environment parameters for spectral tunneling.</p>
        </div>
        <Button variant="spectral" onClick={handleSave} disabled={saving || !form.name.trim()}>
          {t('connections.initialize', 'INITIALIZE')}
        </Button>
      </div>

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

          {/* RDP Advanced (#47) */}
          {form.method === 'rdp' && (
            <section>
              <h3 className={sectionLabel}>RDP ADVANCED OPTIONS</h3>
              <div className={sectionCard}>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-[var(--on-surface-variant)]">Clipboard Forwarding</span>
                      <Switch checked={form.rdpClipboard} onCheckedChange={(v) => set('rdpClipboard', v)} />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-[var(--on-surface-variant)]">Drive Redirection</span>
                      <Switch checked={form.rdpDriveRedirect} onCheckedChange={(v) => set('rdpDriveRedirect', v)} />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-[var(--on-surface-variant)]">Printer Redirection</span>
                      <Switch checked={form.rdpPrinterRedirect} onCheckedChange={(v) => set('rdpPrinterRedirect', v)} />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-[var(--on-surface-variant)]">Audio Playback</span>
                      <Switch checked={form.rdpAudioPlayback} onCheckedChange={(v) => set('rdpAudioPlayback', v)} />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-[var(--on-surface-variant)]">Fullscreen</span>
                      <Switch checked={form.rdpFullscreen} onCheckedChange={(v) => set('rdpFullscreen', v)} />
                    </label>
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
                  {(form.authType === 'key' || form.authType === 'key_pass') && (
                    <div>
                      <label className={fieldLabel} htmlFor="conn-keypath">{t('connections.keyPath', 'PRIVATE KEY FILE')}</label>
                      <div className="flex gap-2">
                        <Input id="conn-keypath" value={form.privateKeyPath} onChange={(e) => set('privateKeyPath', e.target.value)} placeholder="~/.ssh/spectral_id_rsa" className="flex-1" />
                        <Button variant="outline" size="sm" aria-label={t('connections.browse', 'Browse')}>
                          <FolderOpen className="h-4 w-4" /> BROWSE
                        </Button>
                      </div>
                    </div>
                  )}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-[var(--on-surface-variant)]">Forward SSH Agent</span>
                    <Switch checked={form.forwardSshAgent} onCheckedChange={(v) => set('forwardSshAgent', v)} />
                  </label>
                </div>
              </div>
              {/* SSH Advanced Options (#67) */}
              <div className="mt-3">
                <SshOptionsPanel
                  options={form.sshOptions}
                  onChange={(opts) => set('sshOptions', opts)}
                />
              </div>
            </section>
          )}
        </div>

        <div className="w-64 flex flex-col gap-6">
          {/* Behavior */}
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
            </div>
          </section>

          {/* Tags (#102) */}
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
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded-[var(--radius)] text-[9px] font-semibold bg-[#6bd5ff]/15 text-[#6bd5ff]"
                      >
                        {t}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Personalizing */}
          <section>
            <h3 className={sectionLabel}>{t('connections.personalizing', 'PERSONALIZING')}</h3>
            <div className={cn(sectionCard, 'flex flex-col gap-3')}>
              <div>
                <label className={fieldLabel}>COLOR SCHEME</label>
                <div className="flex gap-2 mt-1">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      className={cn('w-5 h-5 rounded-full transition-transform', form.colorScheme === color && 'ring-2 ring-[var(--on-surface)] scale-110')}
                      style={{ backgroundColor: color }}
                      onClick={() => set('colorScheme', color)}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={fieldLabel} htmlFor="conn-fontsize">FONT SIZE</label>
                  <Input id="conn-fontsize" type="number" min={8} max={32} value={form.fontSize} onChange={(e) => set('fontSize', Number(e.target.value))} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="conn-font">FONT</label>
                  <Input id="conn-font" value={form.fontFamily} onChange={(e) => set('fontFamily', e.target.value)} />
                </div>
              </div>
              <div className="rounded-[var(--radius)] bg-[var(--surface-container-lowest)] p-2 font-[family-name:var(--font-mono)] text-xs text-[var(--success)] leading-relaxed">
                <span className="text-[var(--on-surface-variant)]">user@bifrost</span>:~$ tail -f /var/log/sys
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button variant="spectral" onClick={handleSave} disabled={saving || !form.name.trim()}>
          {saving ? 'Saving...' : connectionId ? t('actions.save', 'Save') : t('connections.save', 'Save Connection')}
        </Button>
      </div>
    </div>
  )
}
