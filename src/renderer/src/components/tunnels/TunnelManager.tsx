import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Trash2, Play, Square, StopCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'
import { JumpHostEditor, type JumpChain } from '@renderer/components/connections/JumpHostEditor'
import { useConnectionsStore } from '@renderer/stores/connections.store'

// Shape returned by `tunnels:list`. Matches the DB row, not the IPC write
// type — it's a bit looser than `TunnelData` so the preload's
// `Promise<TunnelData[]>` signature still lines up via structural typing.
interface Tunnel {
  id: string
  name: string
  connectionId?: string | null
  host?: string | null
  port?: number | null
  username?: string | null
  authType?: string | null
  privateKeyPath?: string | null
  forwards: string
  autoStart?: boolean
  jumpServerConfig?: string | null
  encryptedPassword?: unknown // Buffer over IPC; only checked for presence
  encryptedPassphrase?: unknown
}

interface TunnelForward {
  type: 'local' | 'remote' | 'dynamic'
  localPort: number
  remoteHost?: string
  remotePort?: number
}

type SourceMode = 'connection' | 'inline'

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] mb-2'
const fieldLabel = 'text-xs text-[var(--on-surface-variant)] mb-1 block'
const selectClass = cn(
  'flex h-9 w-full rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-3 py-1',
  'text-sm text-[var(--on-surface)] ghost-border focus-visible:outline-none'
)

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function TunnelManager(): JSX.Element {
  const [tunnels, setTunnels] = useState<Tunnel[]>([])
  const [activeMap, setActiveMap] = useState<Map<string, number>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [sourceMode, setSourceMode] = useState<SourceMode>('connection')
  const [connectionId, setConnectionId] = useState<string>('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState(22)
  const [username, setUsername] = useState('')
  const [authType, setAuthType] = useState<'userpass' | 'key' | 'key_pass'>('key')
  const [keyPath, setKeyPath] = useState('')
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [hasStoredPassword, setHasStoredPassword] = useState(false)
  const [hasStoredPassphrase, setHasStoredPassphrase] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const [forwards, setForwards] = useState<TunnelForward[]>([])
  const [jumpChain, setJumpChain] = useState<JumpChain>([])
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const allConnections = useConnectionsStore((s) => s.connections)
  const sshConnections = useMemo(
    () => allConnections.filter((c) => c.method === 'ssh' || c.method === 'mosh'),
    [allConnections]
  )
  const connectionsList = allConnections.map((c) => ({
    id: c.id,
    name: c.name,
    host: c.host,
    username: c.username,
    method: c.method
  }))

  const loadTunnels = useCallback(async () => {
    if (!window.bifrost?.tunnels) return
    const list = (await window.bifrost.tunnels.list()) as unknown as Tunnel[]
    setTunnels(list)
  }, [])

  const refreshStatus = useCallback(async () => {
    if (!window.bifrost?.tunnels) return
    const active = await window.bifrost.tunnels.listActive()
    const map = new Map<string, number>()
    for (const a of active) map.set(a.tunnelId, a.uptime)
    setActiveMap(map)
  }, [])

  useEffect(() => {
    loadTunnels()
    refreshStatus()
    const interval = setInterval(refreshStatus, 5000)
    return () => clearInterval(interval)
  }, [loadTunnels, refreshStatus])

  const selectTunnel = useCallback((t: Tunnel) => {
    setSelectedId(t.id)
    setName(t.name)
    if (t.connectionId) {
      setSourceMode('connection')
      setConnectionId(t.connectionId)
    } else {
      setSourceMode('inline')
      setConnectionId('')
    }
    setHost(t.host ?? '')
    setPort(t.port ?? 22)
    setUsername(t.username ?? '')
    setAuthType((t.authType as 'userpass' | 'key' | 'key_pass') ?? 'key')
    setKeyPath(t.privateKeyPath ?? '')
    setPassword('')
    setPassphrase('')
    setHasStoredPassword(!!t.encryptedPassword)
    setHasStoredPassphrase(!!t.encryptedPassphrase)
    setAutoStart(t.autoStart ?? false)
    try { setForwards(JSON.parse(t.forwards || '[]')) } catch { setForwards([]) }
    try {
      const cfg = t.jumpServerConfig ? JSON.parse(t.jumpServerConfig) : null
      setJumpChain(Array.isArray(cfg?.chain) ? cfg.chain : [])
    } catch { setJumpChain([]) }
    setStatusMsg(null)
  }, [])

  const handleNew = useCallback(() => {
    setSelectedId(null)
    setName('')
    setSourceMode(sshConnections.length > 0 ? 'connection' : 'inline')
    setConnectionId(sshConnections[0]?.id ?? '')
    setHost('')
    setPort(22)
    setUsername('')
    setAuthType('key')
    setKeyPath('')
    setPassword('')
    setPassphrase('')
    setHasStoredPassword(false)
    setHasStoredPassphrase(false)
    setAutoStart(false)
    setForwards([])
    setJumpChain([])
    setStatusMsg(null)
  }, [sshConnections])

  const handleSave = useCallback(async () => {
    if (!window.bifrost?.tunnels || !name.trim()) return
    if (sourceMode === 'inline' && !host.trim()) return
    if (sourceMode === 'connection' && !connectionId) return
    setSaving(true)
    try {
      const base = {
        name,
        forwards: JSON.stringify(forwards),
        autoStart,
        jumpServerConfig: jumpChain.length > 0 ? JSON.stringify({ chain: jumpChain }) : null
      }
      const data =
        sourceMode === 'connection'
          ? { ...base, connectionId, host: null, username: undefined, authType: undefined, privateKeyPath: undefined, password: undefined, passphrase: undefined }
          : {
              ...base,
              connectionId: null,
              host,
              port,
              username: username || undefined,
              authType,
              privateKeyPath: keyPath || undefined,
              // Empty string = "no change" on update; only send when user typed.
              password: password.length > 0 ? password : undefined,
              passphrase: passphrase.length > 0 ? passphrase : undefined
            }
      if (selectedId) {
        await window.bifrost.tunnels.update(selectedId, data as never)
      } else {
        const id = await window.bifrost.tunnels.create(data as never)
        setSelectedId(id)
      }
      // Clear plaintext from memory after successful save.
      setPassword('')
      setPassphrase('')
      await loadTunnels()
      setStatusMsg('Saved')
      setTimeout(() => setStatusMsg(null), 2000)
    } finally { setSaving(false) }
  }, [selectedId, name, sourceMode, connectionId, host, port, username, authType, keyPath, password, passphrase, autoStart, forwards, jumpChain, loadTunnels])

  const handleDelete = useCallback(async () => {
    if (!window.bifrost?.tunnels || !selectedId) return
    await window.bifrost.tunnels.delete(selectedId)
    handleNew()
    await loadTunnels()
  }, [selectedId, loadTunnels, handleNew])

  const handleStart = useCallback(async (id: string) => {
    if (!window.bifrost?.tunnels) return
    setStatusMsg('Starting...')
    const result = await window.bifrost.tunnels.start(id)
    setStatusMsg(result.message)
    await refreshStatus()
    setTimeout(() => setStatusMsg(null), 5000)
  }, [refreshStatus])

  const handleStop = useCallback(async (id: string) => {
    if (!window.bifrost?.tunnels) return
    await window.bifrost.tunnels.stop(id)
    setStatusMsg('Stopped')
    await refreshStatus()
    setTimeout(() => setStatusMsg(null), 2000)
  }, [refreshStatus])

  const handleStopAll = useCallback(async () => {
    if (!window.bifrost?.tunnels) return
    const result = await window.bifrost.tunnels.stopAll()
    setStatusMsg(result.message)
    await refreshStatus()
    setTimeout(() => setStatusMsg(null), 3000)
  }, [refreshStatus])

  const addForward = useCallback(() => {
    setForwards([...forwards, { type: 'local', localPort: 0, remoteHost: 'localhost', remotePort: 0 }])
  }, [forwards])

  const updateForward = useCallback((idx: number, update: Partial<TunnelForward>) => {
    const next = [...forwards]
    next[idx] = { ...next[idx], ...update }
    setForwards(next)
  }, [forwards])

  const removeForward = useCallback((idx: number) => {
    setForwards(forwards.filter((_, i) => i !== idx))
  }, [forwards])

  const handleBrowseKey = useCallback(async () => {
    const paths = await window.bifrost?.window?.showOpenDialog?.()
    if (paths && paths.length > 0) setKeyPath(paths[0])
  }, [])

  // Display label for the list (resolves connection ref to its host).
  const tunnelDisplay = useCallback((t: Tunnel): string => {
    if (t.connectionId) {
      const c = allConnections.find((x) => x.id === t.connectionId)
      if (c) return `${c.username ? `${c.username}@` : ''}${c.host ?? c.name}`
      return '(connection deleted)'
    }
    return `${t.username ? `${t.username}@` : ''}${t.host ?? ''}:${t.port ?? 22}`
  }, [allConnections])

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-[var(--on-surface)]">SSH Tunnels</h2>
          <p className={sectionLabel}>INDEPENDENT PORT FORWARDING</p>
        </div>
        <div className="flex gap-2">
          {activeMap.size > 0 && (
            <Button variant="ghost" size="sm" onClick={handleStopAll} className="text-[var(--error)]">
              <StopCircle className="h-3 w-3" /> STOP ALL ({activeMap.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleNew}>
            <Plus className="h-3 w-3" /> NEW
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Tunnel list */}
        <div className="w-56 shrink-0 surface-2 rounded-[var(--radius)] p-2 overflow-y-auto flex flex-col gap-0.5">
          <p className={cn(sectionLabel, 'px-2')}>TUNNELS</p>
          {tunnels.length === 0 ? (
            <p className="text-xs text-[var(--on-surface-variant)] px-2 py-4 text-center">No tunnels configured</p>
          ) : tunnels.map((t) => {
            const isActive = activeMap.has(t.id)
            const uptime = activeMap.get(t.id)
            let fwdCount = 0
            try { fwdCount = JSON.parse(t.forwards || '[]').length } catch { /* ok */ }
            return (
              <button
                key={t.id}
                onClick={() => selectTunnel(t)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 text-left rounded-[var(--radius)] transition-colors text-xs',
                  selectedId === t.id
                    ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/50'
                )}
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', isActive ? 'bg-[#22c55e]' : 'bg-[#c7c4d7]/20')} />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate font-semibold">{t.name}</span>
                  <span className="truncate text-[9px] text-[var(--on-surface-variant)]">
                    {tunnelDisplay(t)} ({fwdCount} fwd)
                  </span>
                  {isActive && uptime !== undefined && (
                    <span className="text-[8px] text-[#22c55e]">up {formatUptime(uptime)}</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); isActive ? handleStop(t.id) : handleStart(t.id) }}
                  className={cn('p-1 rounded-[var(--radius)] shrink-0', isActive ? 'text-[var(--error)] hover:bg-[var(--error)]/10' : 'text-[#22c55e] hover:bg-[#22c55e]/10')}
                  title={isActive ? 'Stop' : 'Start'}
                >
                  {isActive ? <Square size={12} /> : <Play size={12} />}
                </button>
              </button>
            )
          })}
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto pr-1">
          <div className="shrink-0">
            <label className={fieldLabel}>TUNNEL NAME</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production DB Tunnel" />
          </div>

          {/* Source toggle: saved connection or inline credentials */}
          <div className="shrink-0">
            <span className={sectionLabel}>SOURCE</span>
            <div className="grid grid-cols-2 gap-1">
              {(['connection', 'inline'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSourceMode(m)}
                  className={cn(
                    'h-8 rounded-[var(--radius)] text-[10px] font-semibold uppercase tracking-wider transition-colors',
                    sourceMode === m
                      ? 'bg-[#6bd5ff] text-[#0a0a0c]'
                      : 'bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                  )}
                >
                  {m === 'connection' ? 'Saved connection' : 'Inline'}
                </button>
              ))}
            </div>
          </div>

          {sourceMode === 'connection' ? (
            <div className="shrink-0">
              <label className={fieldLabel}>CONNECTION</label>
              {sshConnections.length === 0 ? (
                <p className="text-[10px] text-[var(--on-surface-variant)] py-2">
                  No saved SSH connections. Create one first or switch to <strong className="text-[var(--on-surface)]">Inline</strong>.
                </p>
              ) : (
                <select
                  className={selectClass}
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                >
                  <option value="">Select a connection…</option>
                  {sshConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.host ? `— ${c.username ?? ''}@${c.host}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[9px] text-[var(--on-surface-variant)] mt-1.5">
                Host, port, user, and credentials are read from the saved connection at start time.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto] gap-2 shrink-0">
                <div>
                  <label className={fieldLabel}>HOST</label>
                  <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="db-prod.internal" />
                </div>
                <div className="w-20">
                  <label className={fieldLabel}>PORT</label>
                  <Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div>
                  <label className={fieldLabel}>USERNAME</label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="deploy" />
                </div>
                <div>
                  <label className={fieldLabel}>AUTH TYPE</label>
                  <select className={selectClass} value={authType} onChange={(e) => setAuthType(e.target.value as never)}>
                    <option value="key">Key File</option>
                    <option value="userpass">Password</option>
                    <option value="key_pass">Key + Passphrase</option>
                  </select>
                </div>
              </div>

              {(authType === 'key' || authType === 'key_pass') && (
                <div className="shrink-0">
                  <label className={fieldLabel}>KEY FILE</label>
                  <div className="flex gap-1">
                    <Input value={keyPath} onChange={(e) => setKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" className="flex-1" />
                    <Button variant="outline" size="sm" onClick={handleBrowseKey}>...</Button>
                  </div>
                </div>
              )}

              {authType === 'userpass' && (
                <div className="shrink-0">
                  <label className={fieldLabel}>PASSWORD</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={hasStoredPassword ? '(saved — leave blank to keep)' : ''}
                  />
                  <p className="text-[9px] text-[var(--on-surface-variant)] mt-1">
                    Encrypted with the system keychain when saved.
                  </p>
                </div>
              )}

              {authType === 'key_pass' && (
                <div className="shrink-0">
                  <label className={fieldLabel}>PASSPHRASE</label>
                  <Input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={hasStoredPassphrase ? '(saved — leave blank to keep)' : ''}
                  />
                </div>
              )}
            </>
          )}

          <label className="flex items-center gap-2 shrink-0 cursor-pointer">
            <Switch checked={autoStart} onCheckedChange={setAutoStart} />
            <span className="text-xs text-[var(--on-surface-variant)]">Start automatically when Bifrost opens</span>
          </label>

          {/* Jump host (ProxyJump) — only meaningful for inline; saved
              connections inherit their own jump chain. */}
          {sourceMode === 'inline' && (
            <div>
              <span className={sectionLabel}>JUMP HOST</span>
              <JumpHostEditor
                value={jumpChain}
                onChange={setJumpChain}
                connections={connectionsList}
              />
            </div>
          )}

          {/* Forwards table */}
          <div className="flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className={sectionLabel}>PORT FORWARDS</span>
              <button onClick={addForward} className="text-[9px] text-[#6bd5ff] hover:underline">+ Add Forward</button>
            </div>

            {forwards.length === 0 ? (
              <div className="rounded-[var(--radius)] bg-[var(--surface-container-low)] p-4 text-xs text-[var(--on-surface-variant)] text-center">
                No forwards configured. Click &quot;+ Add Forward&quot; to create one.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {forwards.map((fwd, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-[var(--radius)] bg-[var(--surface-container-low)]">
                    <select
                      className="h-7 rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-2 text-[10px] text-[var(--on-surface)] ghost-border w-20 shrink-0"
                      value={fwd.type}
                      onChange={(e) => updateForward(idx, { type: e.target.value as TunnelForward['type'] })}
                    >
                      <option value="local">Local</option>
                      <option value="remote">Remote</option>
                      <option value="dynamic">Dynamic</option>
                    </select>
                    <div className="flex-1 grid grid-cols-3 gap-1.5">
                      <Input
                        type="number"
                        value={fwd.localPort || ''}
                        onChange={(e) => updateForward(idx, { localPort: Number(e.target.value) })}
                        placeholder="Local port"
                        className="h-7 text-[10px]"
                      />
                      {fwd.type !== 'dynamic' && (
                        <>
                          <Input
                            value={fwd.remoteHost || ''}
                            onChange={(e) => updateForward(idx, { remoteHost: e.target.value })}
                            placeholder="Remote host"
                            className="h-7 text-[10px]"
                          />
                          <Input
                            type="number"
                            value={fwd.remotePort || ''}
                            onChange={(e) => updateForward(idx, { remotePort: Number(e.target.value) })}
                            placeholder="Remote port"
                            className="h-7 text-[10px]"
                          />
                        </>
                      )}
                    </div>
                    <button onClick={() => removeForward(idx)} className="text-[var(--on-surface-variant)] hover:text-[var(--error)] p-0.5 shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions + Status */}
          <div className="flex items-center gap-2 shrink-0">
            {selectedId && activeMap.has(selectedId) ? (
              <Button variant="ghost" size="sm" onClick={() => handleStop(selectedId!)} className="text-[var(--error)]">
                <Square className="h-3 w-3" /> STOP
              </Button>
            ) : (
              <Button
                variant="spectral"
                size="sm"
                onClick={() => selectedId ? handleStart(selectedId) : handleSave()}
                disabled={!name.trim() || (sourceMode === 'inline' ? !host.trim() : !connectionId)}
              >
                {selectedId ? <><Play className="h-3 w-3" /> START</> : <><Plus className="h-3 w-3" /> SAVE</>}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving || !name.trim() || (sourceMode === 'inline' ? !host.trim() : !connectionId)}
            >
              {saving ? 'SAVING...' : 'SAVE'}
            </Button>
            {selectedId && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="ml-auto text-[var(--error)]">
                <Trash2 className="h-3 w-3" /> DELETE
              </Button>
            )}
            {statusMsg && (
              <span className="text-[10px] text-[var(--on-surface-variant)] ml-2">{statusMsg}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
