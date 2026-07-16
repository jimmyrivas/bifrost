import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Eye, EyeOff, Tag, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'
import { showToast } from '@renderer/lib/protocol-dispatch'
import { useConnectionsStore } from '@renderer/stores/connections.store'
import { SshOptionsPanel } from './SshOptionsPanel'
import {
  MultiplexerPanel,
  defaultMultiplexer,
  type MultiplexerConfig
} from './MultiplexerPanel'
import { JumpHostEditor, type JumpChain } from './JumpHostEditor'
import { ConnectionStats } from './ConnectionStats'
import { COLOR_SCHEMES } from '@renderer/lib/color-schemes'

type Method = 'ssh' | 'mosh' | 'rdp' | 'vnc' | 'telnet' | 'local' | 'ftp' | 'custom'
type AuthType = 'userpass' | 'key' | 'key_pass' | 'fido2' | 'manual'
type FormTab = 'general' | 'advanced' | 'routing' | 'session' | 'hooks' | 'terminal' | 'expect'

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
  passwordRef: string
  tags: string
  sshOptions: Record<string, string>
  multiplexer: MultiplexerConfig
  jumpChain: JumpChain
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
  passwordRef: '',
  tags: '',
  sshOptions: {},
  multiplexer: { ...defaultMultiplexer },
  jumpChain: [],
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
const METHODS_WITH_ROUTING: Method[] = ['ssh', 'mosh']

function getFormTabs(method: Method): Array<{ id: FormTab; label: string }> {
  const tabs: Array<{ id: FormTab; label: string }> = [
    { id: 'general', label: 'GENERAL' },
  ]
  if (method === 'ssh' || method === 'mosh') {
    tabs.push({ id: 'advanced', label: 'ADVANCED SSH' })
  }
  if (METHODS_WITH_ROUTING.includes(method)) {
    tabs.push({ id: 'routing', label: 'ROUTING' })
  }
  if (METHODS_WITH_MULTIPLEXER.includes(method)) {
    tabs.push({ id: 'session', label: 'SESSION' })
  }
  if (METHODS_WITH_HOOKS.includes(method)) {
    tabs.push({ id: 'hooks', label: 'HOOKS' })
  }
  if (method === 'ssh') {
    tabs.push({ id: 'expect', label: 'EXPECT' })
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

interface ExpectRuleForm {
  pattern: string
  sendText: string
  timeoutSec: number
  sendReturn: boolean
  hideFromLog: boolean
}

export function ConnectionForm({ connectionId, initialData, onClose }: ConnectionFormProps): JSX.Element {
  const { t } = useTranslation()
  const createConnection = useConnectionsStore((s) => s.createConnection)
  const updateConnection = useConnectionsStore((s) => s.updateConnection)
  const allConnections = useConnectionsStore((s) => s.connections)
  const connectionsList = allConnections.map((c) => ({
    id: c.id,
    name: c.name,
    host: c.host,
    username: c.username,
    method: c.method
  }))

  const [form, setForm] = useState<FormState>({ ...defaultForm, ...initialData })
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [activeTab, setActiveTab] = useState<FormTab>('general')
  const [execCmds, setExecCmds] = useState<ExecCommand[]>([])
  const [expectRules, setExpectRules] = useState<ExpectRuleForm[]>([])
  const [expectReveal, setExpectReveal] = useState<Set<number>>(new Set())
  const [hasVaultKey, setHasVaultKey] = useState(false)
  // What the vault actually held when the form loaded. Guards the
  // clear-on-empty save path: never clear before the async prefill resolved
  // (or when decryption failed), or a quick Save would wipe the stored value.
  const loadedCreds = useRef({ password: '', passphrase: '' })
  // The connection's sshConfig JSON as loaded, so a Save preserves keys the form
  // does not manage (e.g. the vault-stored encryptedKeyContent from #27).
  const preservedSshConfig = useRef<Record<string, unknown>>({})
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
          customCommand: (() => {
            try {
              const cfg = conn.sshConfig ? JSON.parse(conn.sshConfig) : {}
              return typeof cfg.customCommand === 'string' ? cfg.customCommand : ''
            } catch { return '' }
          })(),
          ...(() => {
            try {
              const cfg = conn.sshConfig ? JSON.parse(conn.sshConfig) : {}
              const rdp = cfg.rdp
              if (!rdp || typeof rdp !== 'object') return {}
              return {
                rdpClipboard: rdp.clipboard !== false,
                rdpDriveRedirect: !!rdp.driveRedirect,
                rdpPrinterRedirect: !!rdp.printerRedirect,
                rdpAudioPlayback: !!rdp.audioPlayback,
                rdpColorDepth: ([15, 16, 24, 32].includes(rdp.colorDepth) ? rdp.colorDepth : 24) as 15 | 16 | 24 | 32,
                rdpFullscreen: !!rdp.fullscreen,
                rdpResolution: typeof rdp.resolution === 'string' ? rdp.resolution : '1280x800'
              }
            } catch { return {} }
          })(),
          multiplexer: (() => {
            try {
              const cfg = conn.sshConfig ? JSON.parse(conn.sshConfig) : {}
              return { ...defaultMultiplexer, ...(cfg.multiplexer ?? {}) }
            } catch { return { ...defaultMultiplexer } }
          })(),
          jumpChain: (() => {
            try {
              const cfg = conn.jumpServerConfig ? JSON.parse(conn.jumpServerConfig) : null
              if (Array.isArray(cfg?.chain) && cfg.chain.length > 0) return cfg.chain
              // One-shot migration of legacy `sshConfig.options.ProxyJump`
              // (dead code in older versions). Translates `user@host:port,…`
              // into inline agent-auth hops. The user can refine in the UI.
              const sshCfg = conn.sshConfig ? JSON.parse(conn.sshConfig) : null
              const proxy = sshCfg?.options?.ProxyJump
              if (typeof proxy === 'string' && proxy.trim()) {
                return proxy.split(',').map((part: string) => {
                  const trimmed = part.trim()
                  const at = trimmed.lastIndexOf('@')
                  if (at <= 0) return null
                  const username = trimmed.slice(0, at)
                  const rest = trimmed.slice(at + 1)
                  const colon = rest.lastIndexOf(':')
                  const host = colon > 0 ? rest.slice(0, colon) : rest
                  const port = colon > 0 ? parseInt(rest.slice(colon + 1), 10) : undefined
                  return host ? { inline: { host, port, username, authType: 'agent' as const } } : null
                }).filter(Boolean)
              }
              return []
            } catch { return [] }
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
      // Prefill stored credentials so the field shows masked dots and the
      // eye toggle can reveal them (they never left the local vault).
      window.bifrost?.credentials?.getPassword?.(connectionId).then((pw) => {
        if (pw) {
          loadedCreds.current.password = pw
          setForm((prev) => ({ ...prev, password: pw }))
        }
      }).catch(() => {})
      window.bifrost?.credentials?.getPassphrase?.(connectionId).then((pp) => {
        if (pp) {
          loadedCreds.current.passphrase = pp
          setForm((prev) => ({ ...prev, passphrase: pp }))
        }
      }).catch(() => {})
      // Load exec commands
      window.bifrost?.execCommands?.list(connectionId).then((cmds) => {
        if (cmds) setExecCmds(cmds.map((c) => ({ phase: c.phase as 'pre' | 'post', command: c.command, ask: c.ask, isDefault: c.isDefault, sortOrder: c.sortOrder })))
      }).catch(() => {})
      // Stash the raw sshConfig so a later Save preserves keys the form does not
      // manage (e.g. encryptedKeyContent). Also seed the password-reference field.
      try {
        preservedSshConfig.current = conn.sshConfig ? JSON.parse(conn.sshConfig) : {}
      } catch { preservedSshConfig.current = {} }
      const pref = preservedSshConfig.current.passwordRef
      if (typeof pref === 'string') set('passwordRef', pref)
      // Does a vault copy of the key already exist for this connection?
      window.bifrost?.credentials?.getKeyFile(connectionId).then((k) => setHasVaultKey(!!k)).catch(() => {})
      // Load expect rules
      window.bifrost?.expect?.listRules(connectionId).then((rows) => {
        if (rows) setExpectRules(rows.map((r) => ({
          pattern: r.pattern,
          sendText: r.sendText,
          timeoutSec: Math.round((r.timeoutMs ?? 10000) / 1000),
          sendReturn: r.sendReturn ?? true,
          hideFromLog: r.hideFromLog ?? false
        })))
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
      // Start from the loaded sshConfig so keys the form doesn't manage
      // (e.g. the vault-stored encryptedKeyContent, #27) survive a Save. Managed
      // keys are set below, or deleted when their field is empty.
      const sshConfigObj: Record<string, unknown> = { ...preservedSshConfig.current }
      const setOrDelete = (key: string, value: unknown, keep: boolean): void => {
        if (keep) sshConfigObj[key] = value
        else delete sshConfigObj[key]
      }
      setOrDelete('tags', form.tags.trim(), !!form.tags.trim())
      setOrDelete('totpSecret', form.totpSecret.trim(), !!form.totpSecret.trim())
      setOrDelete('options', form.sshOptions, Object.keys(form.sshOptions).length > 0)
      setOrDelete('multiplexer', form.multiplexer, form.multiplexer.preferred !== 'none')
      setOrDelete('passwordRef', form.passwordRef.trim(), !!form.passwordRef.trim())
      // Custom-command / RDP methods persist their settings in the same JSON blob.
      setOrDelete('customCommand', form.customCommand.trim(), form.method === 'custom' && !!form.customCommand.trim())
      setOrDelete(
        'rdp',
        {
          clipboard: form.rdpClipboard,
          driveRedirect: form.rdpDriveRedirect,
          printerRedirect: form.rdpPrinterRedirect,
          audioPlayback: form.rdpAudioPlayback,
          colorDepth: form.rdpColorDepth,
          fullscreen: form.rdpFullscreen,
          resolution: form.rdpResolution
        },
        form.method === 'rdp'
      )
      const sshConfig = Object.keys(sshConfigObj).length > 0 ? JSON.stringify(sshConfigObj) : undefined

      const jumpServerConfig =
        form.jumpChain.length > 0 ? JSON.stringify({ chain: form.jumpChain }) : null

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
        terminalConfig,
        jumpServerConfig
      }
      let savedId = connectionId
      if (connectionId) {
        await updateConnection(connectionId, data)
      } else {
        savedId = await createConnection(data)
      }
      if (savedId && form.password) {
        await window.bifrost.credentials.setPassword(savedId, form.password)
      } else if (savedId && connectionId && loadedCreds.current.password) {
        // The user emptied a field we know held a stored password: remove it
        // rather than silently keeping the old one.
        await window.bifrost.credentials.clearPassword(savedId)
      }
      if (savedId && form.passphrase) {
        await window.bifrost.credentials.setPassphrase(savedId, form.passphrase)
      } else if (savedId && connectionId && loadedCreds.current.passphrase) {
        await window.bifrost.credentials.clearPassphrase?.(savedId)
      }
      // Save exec commands (hooks). Always sync — execCommands.save deletes and
      // re-inserts, so an empty list must be persisted too, otherwise removing
      // every hook in the editor would leave the old rows in the DB.
      if (savedId) {
        await window.bifrost.execCommands.save(savedId, execCmds)
      }
      // Save expect rules (SSH only) — delete + reinsert, so an empty list clears them.
      if (savedId && form.method === 'ssh') {
        await window.bifrost.expect.saveRules(
          savedId,
          expectRules
            .filter((r) => r.pattern.trim())
            .map((r, i) => ({
              pattern: r.pattern,
              sendText: r.sendText,
              sendReturn: r.sendReturn,
              hideFromLog: r.hideFromLog,
              timeoutMs: Math.max(1, r.timeoutSec) * 1000,
              sortOrder: i
            }))
        )
      }
      // File-secret fallback (#27): while the key file exists, keep an encrypted
      // copy in the vault so the connection still authenticates if the file later
      // moves. Best-effort — silently no-ops if the file is absent. Only refreshes
      // an existing copy or captures a new one; never removes (that's explicit).
      if (savedId && (form.authType === 'key' || form.authType === 'key_pass') && form.privateKeyPath) {
        try {
          await window.bifrost.credentials.storeKeyFromPath(savedId, form.privateKeyPath)
        } catch { /* ignore */ }
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
                              <div className="mt-2">
                                <label className={fieldLabel} htmlFor="conn-passref">1PASSWORD REFERENCE (OPTIONAL)</label>
                                <div className="flex gap-2">
                                  <Input id="conn-passref" value={form.passwordRef} onChange={(e) => set('passwordRef', e.target.value)} placeholder="op://vault/item/password" className="flex-1 font-[family-name:var(--font-mono)]" />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!form.passwordRef.trim()}
                                    onClick={async () => {
                                      try {
                                        const secret = await window.bifrost.passwordManagers.opReadSecret(form.passwordRef.trim())
                                        showToast(secret
                                          ? { variant: 'success', message: 'Reference resolved ✓ (1Password signed in)' }
                                          : { variant: 'error', message: 'Empty result — check the reference' })
                                      } catch (err) {
                                        showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
                                      }
                                    }}
                                  >
                                    Test
                                  </Button>
                                </div>
                                <p className="text-[10px] text-[var(--on-surface-variant)] mt-1">
                                  If set, the password is read from 1Password (the <code>op</code> CLI) at connect time and never stored. Leave the password blank to use it.
                                </p>
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
                              {connectionId && (form.authType === 'key' || form.authType === 'key_pass') && (
                                <div className="mt-1.5 text-[10px] text-[var(--on-surface-variant)]">
                                  {hasVaultKey ? (
                                    <span>
                                      ✓ A vault copy of this key is kept — used automatically if the file goes missing.{' '}
                                      <button
                                        type="button"
                                        className="underline hover:text-[var(--on-surface)]"
                                        onClick={async () => {
                                          try {
                                            await window.bifrost.credentials.removeStoredKey(connectionId)
                                            setHasVaultKey(false)
                                            showToast({ variant: 'info', message: 'Vault copy removed' })
                                          } catch (err) {
                                            showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
                                          }
                                        }}
                                      >
                                        Remove copy
                                      </button>
                                    </span>
                                  ) : form.privateKeyPath ? (
                                    <span>A copy is saved to the vault the next time you save or connect while the file exists, so the key keeps working if the file later moves.</span>
                                  ) : null}
                                </div>
                              )}
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
            <SshOptionsPanel
              options={form.sshOptions}
              onChange={(opts) => set('sshOptions', opts)}
            />
          </div>
        )}

        {/* ═══ ROUTING TAB ═══ */}
        {activeTab === 'routing' && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[var(--on-surface-variant)]">
              Route this connection through one or more bastions. Each hop opens an SSH-over-SSH tunnel
              to the next; the target sees the final hop as if it were connecting directly.
            </p>
            <JumpHostEditor
              value={form.jumpChain}
              onChange={(next) => set('jumpChain', next)}
              selfId={connectionId}
              connections={connectionsList}
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

        {/* ═══ EXPECT TAB ═══ */}
        {activeTab === 'expect' && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[var(--on-surface-variant)]">
              Auto-respond to prompts on this SSH session. When output matches the regex, the response is
              sent (variables like &lt;GV:name&gt; are resolved). Rules run automatically while connected.
            </p>
            {expectRules.length > 0 && (
              <div className={cn(sectionCard, 'flex flex-col gap-2 p-3')}>
                {expectRules.map((rule, idx) => {
                  const set = (patch: Partial<ExpectRuleForm>): void => {
                    const next = [...expectRules]
                    next[idx] = { ...rule, ...patch }
                    setExpectRules(next)
                  }
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={rule.pattern}
                        onChange={(e) => set({ pattern: e.target.value })}
                        placeholder="regex, e.g. (?i)password:"
                        className="flex-1 h-7 text-xs font-[family-name:var(--font-mono)]"
                      />
                      <div className="relative w-32 shrink-0">
                        <Input
                          value={rule.sendText}
                          onChange={(e) => set({ sendText: e.target.value })}
                          placeholder="response"
                          type={rule.hideFromLog && !expectReveal.has(idx) ? 'password' : 'text'}
                          className="h-7 text-xs font-[family-name:var(--font-mono)] pr-6"
                        />
                        {rule.hideFromLog && (
                          <button
                            type="button"
                            onClick={() => setExpectReveal((prev) => {
                              const next = new Set(prev)
                              next.has(idx) ? next.delete(idx) : next.add(idx)
                              return next
                            })}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                            title={expectReveal.has(idx) ? 'Hide' : 'Reveal'}
                          >
                            {expectReveal.has(idx) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                      <Input
                        type="number"
                        min={1}
                        value={rule.timeoutSec}
                        onChange={(e) => set({ timeoutSec: Number(e.target.value) })}
                        title="Timeout (seconds)"
                        className="w-14 h-7 text-xs"
                      />
                      <label className="flex items-center gap-1 shrink-0 cursor-pointer" title="Send Enter after the response">
                        <input type="checkbox" checked={rule.sendReturn} onChange={(e) => set({ sendReturn: e.target.checked })} className="w-3 h-3 accent-[#6bd5ff]" />
                        <span className="text-[9px] text-[var(--on-surface-variant)]">↵</span>
                      </label>
                      <label className="flex items-center gap-1 shrink-0 cursor-pointer" title="Secret: mask the response here and hide it from logs">
                        <input type="checkbox" checked={rule.hideFromLog} onChange={(e) => set({ hideFromLog: e.target.checked })} className="w-3 h-3 accent-[#6bd5ff]" />
                        <span className="text-[9px] text-[var(--on-surface-variant)]">🔒</span>
                      </label>
                      <button
                        onClick={() => setExpectRules(expectRules.filter((_, i) => i !== idx))}
                        className="text-[var(--on-surface-variant)] hover:text-[var(--error)] p-0.5 shrink-0"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setExpectRules([...expectRules, { pattern: '', sendText: '', timeoutSec: 10, sendReturn: true, hideFromLog: false }])}
            >
              + Add Rule
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
