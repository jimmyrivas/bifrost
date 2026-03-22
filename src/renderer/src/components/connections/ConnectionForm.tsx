import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Eye, EyeOff } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'
import { useConnectionsStore } from '@renderer/stores/connections.store'

type Method = 'ssh' | 'rdp' | 'vnc' | 'telnet' | 'local' | 'ftp'
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
}

const defaultForm: FormState = {
  name: '', method: 'ssh', host: '', port: 22, authType: 'userpass',
  username: '', password: '', privateKeyPath: '', passphrase: '',
  launchOnStartup: false, reconnectOnDisconnect: false, runWithSudo: false,
  tabTitle: '', autoSaveLog: false, logPattern: '',
  sendString: '', sendIntervalSeconds: 60, sendIdleOnly: true,
  colorScheme: '#6b6bff', fontSize: 14, fontFamily: 'JetBrains Mono'
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

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
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
        sendIdleOnly: form.sendIdleOnly, groupId: null as string | null
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

  const needsHost = form.method !== 'local'
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
                    </select>
                  </div>
                  {needsHost && (
                    <>
                      <div>
                        <label className={fieldLabel} htmlFor="conn-host">{t('connections.host', 'HOST ADDRESS')}</label>
                        <Input id="conn-host" value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="10.0.0.133" />
                      </div>
                      <div className="w-20">
                        <label className={fieldLabel} htmlFor="conn-port">{t('connections.port', 'PORT')}</label>
                        <Input id="conn-port" type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} />
                      </div>
                    </>
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
                </div>
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
