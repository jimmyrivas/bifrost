import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, X, FolderOpen, Eye, EyeOff } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
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
}

const defaultForm: FormState = {
  name: '', method: 'ssh', host: '', port: 22, authType: 'userpass',
  username: '', password: '', privateKeyPath: '', passphrase: '',
  launchOnStartup: false, reconnectOnDisconnect: false, runWithSudo: false,
  tabTitle: '', autoSaveLog: false, logPattern: '',
  sendString: '', sendIntervalSeconds: 60, sendIdleOnly: true
}

const selectClass = 'flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400'
const checkClass = 'h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-zinc-400'

export function ConnectionForm({ connectionId, initialData, onClose }: ConnectionFormProps): JSX.Element {
  const { t } = useTranslation()
  const createConnection = useConnectionsStore((s) => s.createConnection)
  const updateConnection = useConnectionsStore((s) => s.updateConnection)

  const [form, setForm] = useState<FormState>({ ...defaultForm, ...initialData })
  const [showPassword, setShowPassword] = useState(false)
  const [showPassphrase, setShowPassphrase] = useState(false)
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
      if (connectionId) {
        await updateConnection(connectionId, data)
      } else {
        await createConnection(data)
      }
      if (form.password) {
        await window.bifrost.credentials.setPassword(connectionId ?? '', form.password)
      }
      if (form.passphrase) {
        await window.bifrost.credentials.setPassphrase(connectionId ?? '', form.passphrase)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const needsHost = form.method !== 'local'
  const needsAuth = form.method === 'ssh'

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800 max-h-[80vh] overflow-y-auto">
      <h2 className="text-lg font-semibold text-zinc-100">
        {connectionId ? t('connections.edit', 'Edit Connection') : t('connections.new', 'New Connection')}
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label htmlFor="conn-name">{t('connections.name', 'Name')}</Label>
          <Input id="conn-name" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </div>

        <div>
          <Label htmlFor="conn-method">{t('connections.method', 'Method')}</Label>
          <select id="conn-method" className={selectClass} value={form.method} onChange={(e) => set('method', e.target.value as Method)}>
            <option value="ssh">SSH</option>
            <option value="rdp">RDP</option>
            <option value="vnc">VNC</option>
            <option value="telnet">Telnet</option>
            <option value="local">Local</option>
          </select>
        </div>

        {needsHost && (
          <>
            <div>
              <Label htmlFor="conn-host">{t('connections.host', 'Host')}</Label>
              <Input id="conn-host" value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="192.168.1.1" />
            </div>
            <div>
              <Label htmlFor="conn-port">{t('connections.port', 'Port')}</Label>
              <Input id="conn-port" type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} />
            </div>
          </>
        )}

        {needsAuth && (
          <>
            <div className="col-span-2">
              <Label htmlFor="conn-auth">{t('connections.authType', 'Authentication')}</Label>
              <select id="conn-auth" className={selectClass} value={form.authType} onChange={(e) => set('authType', e.target.value as AuthType)}>
                <option value="userpass">{t('connections.userpass', 'User/Password')}</option>
                <option value="key">{t('connections.key', 'Public Key')}</option>
                <option value="key_pass">{t('connections.keyPass', 'Key + Passphrase')}</option>
                <option value="manual">{t('connections.manual', 'Manual')}</option>
              </select>
            </div>
            <div>
              <Label htmlFor="conn-user">{t('connections.username', 'Username')}</Label>
              <Input id="conn-user" value={form.username} onChange={(e) => set('username', e.target.value)} />
            </div>
            {(form.authType === 'userpass') && (
              <div className="relative">
                <Label htmlFor="conn-pass">{t('connections.password', 'Password')}</Label>
                <div className="relative">
                  <Input id="conn-pass" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} className="pr-9" />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            {(form.authType === 'key' || form.authType === 'key_pass') && (
              <div className="col-span-2">
                <Label htmlFor="conn-keypath">{t('connections.keyPath', 'Private Key Path')}</Label>
                <div className="flex gap-2">
                  <Input id="conn-keypath" value={form.privateKeyPath} onChange={(e) => set('privateKeyPath', e.target.value)} placeholder="~/.ssh/id_rsa" className="flex-1" />
                  <Button variant="outline" size="icon" aria-label={t('connections.browse', 'Browse')}><FolderOpen className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
            {form.authType === 'key_pass' && (
              <div className="col-span-2 relative">
                <Label htmlFor="conn-phrase">{t('connections.passphrase', 'Passphrase')}</Label>
                <div className="relative">
                  <Input id="conn-phrase" type={showPassphrase ? 'text' : 'password'} value={form.passphrase} onChange={(e) => set('passphrase', e.target.value)} className="pr-9" />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200" onClick={() => setShowPassphrase(!showPassphrase)} aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}>
                    {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <fieldset className="border border-zinc-800 rounded-md p-3">
        <legend className="text-sm text-zinc-400 px-1">{t('connections.options', 'Options')}</legend>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {([
            ['launchOnStartup', t('connections.launchOnStartup', 'Launch on startup')],
            ['reconnectOnDisconnect', t('connections.reconnect', 'Reconnect')],
            ['runWithSudo', t('connections.sudo', 'Run with sudo')],
            ['autoSaveLog', t('connections.autoLog', 'Auto-save log')],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-zinc-300 cursor-pointer">
              <input type="checkbox" className={checkClass} checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
              {label}
            </label>
          ))}
          <div className="col-span-2">
            <Label htmlFor="conn-tab-title">{t('connections.tabTitle', 'Tab Title')}</Label>
            <Input id="conn-tab-title" value={form.tabTitle} onChange={(e) => set('tabTitle', e.target.value)} placeholder={t('connections.tabTitlePlaceholder', 'Override tab title')} />
          </div>
          {form.autoSaveLog && (
            <div className="col-span-2">
              <Label htmlFor="conn-log-pattern">{t('connections.logPattern', 'Log Pattern')}</Label>
              <Input id="conn-log-pattern" value={form.logPattern} onChange={(e) => set('logPattern', e.target.value)} placeholder="%Y%m%d_%H%M%S.log" />
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="border border-zinc-800 rounded-md p-3">
        <legend className="text-sm text-zinc-400 px-1">{t('connections.keepAlive', 'Keep-Alive')}</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="conn-send-str">{t('connections.sendString', 'Send String')}</Label>
            <Input id="conn-send-str" value={form.sendString} onChange={(e) => set('sendString', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="conn-interval">{t('connections.interval', 'Interval (s)')}</Label>
            <Input id="conn-interval" type="number" min={1} value={form.sendIntervalSeconds} onChange={(e) => set('sendIntervalSeconds', Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer col-span-2">
            <input type="checkbox" className={checkClass} checked={form.sendIdleOnly} onChange={(e) => set('sendIdleOnly', e.target.checked)} />
            {t('connections.idleOnly', 'Send only when idle')}
          </label>
        </div>
      </fieldset>

      <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          <X className="h-4 w-4" /> {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
          <Save className="h-4 w-4" /> {t('common.save', 'Save')}
        </Button>
      </div>
    </div>
  )
}
