import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Play, Square, Cable, RefreshCw, StopCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'
import { JumpHostEditor, type JumpChain } from '@renderer/components/connections/JumpHostEditor'
import { useConnectionsStore } from '@renderer/stores/connections.store'

interface Tunnel {
  id: string
  name: string
  host: string
  port: number
  username: string | null
  authType: string | null
  privateKeyPath: string | null
  forwards: string
  autoStart: boolean
  jumpServerConfig?: string | null
}

interface TunnelForward {
  type: 'local' | 'remote' | 'dynamic'
  localPort: number
  remoteHost?: string
  remotePort?: number
}

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
  const [activeMap, setActiveMap] = useState<Map<string, number>>(new Map()) // tunnelId → uptime
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState(22)
  const [username, setUsername] = useState('')
  const [authType, setAuthType] = useState<'userpass' | 'key' | 'key_pass'>('key')
  const [keyPath, setKeyPath] = useState('')
  const [autoStart, setAutoStart] = useState(false)
  const [forwards, setForwards] = useState<TunnelForward[]>([])
  const [jumpChain, setJumpChain] = useState<JumpChain>([])
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const allConnections = useConnectionsStore((s) => s.connections)
  const connectionsList = allConnections.map((c) => ({
    id: c.id,
    name: c.name,
    host: c.host,
    username: c.username,
    method: c.method
  }))

  const loadTunnels = useCallback(async () => {
    if (!window.bifrost?.tunnels) return
    const list = await window.bifrost.tunnels.list()
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
    setHost(t.host)
    setPort(t.port ?? 22)
    setUsername(t.username ?? '')
    setAuthType((t.authType as 'userpass' | 'key' | 'key_pass') ?? 'key')
    setKeyPath(t.privateKeyPath ?? '')
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
    setHost('')
    setPort(22)
    setUsername('')
    setAuthType('key')
    setKeyPath('')
    setAutoStart(false)
    setForwards([])
    setJumpChain([])
    setStatusMsg(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!window.bifrost?.tunnels || !name.trim() || !host.trim()) return
    setSaving(true)
    try {
      const data = {
        name, host, port, username: username || undefined,
        authType, privateKeyPath: keyPath || undefined,
        forwards: JSON.stringify(forwards),
        autoStart,
        jumpServerConfig: jumpChain.length > 0 ? JSON.stringify({ chain: jumpChain }) : null
      }
      if (selectedId) {
        await window.bifrost.tunnels.update(selectedId, data)
      } else {
        const id = await window.bifrost.tunnels.create(data as any)
        setSelectedId(id)
      }
      await loadTunnels()
      setStatusMsg('Saved')
      setTimeout(() => setStatusMsg(null), 2000)
    } finally { setSaving(false) }
  }, [selectedId, name, host, port, username, authType, keyPath, autoStart, forwards, jumpChain, loadTunnels])

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
                    {t.username ? `${t.username}@` : ''}{t.host}:{t.port} ({fwdCount} fwd)
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
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div>
              <label className={fieldLabel}>TUNNEL NAME</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production DB Tunnel" />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <label className={fieldLabel}>HOST</label>
                <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="db-prod.internal" />
              </div>
              <div className="w-20">
                <label className={fieldLabel}>PORT</label>
                <Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div>
              <label className={fieldLabel}>USERNAME</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="deploy" />
            </div>
            <div>
              <label className={fieldLabel}>AUTH TYPE</label>
              <select className={selectClass} value={authType} onChange={(e) => setAuthType(e.target.value as any)}>
                <option value="key">Key File</option>
                <option value="userpass">Password</option>
                <option value="key_pass">Key + Passphrase</option>
              </select>
            </div>
            <div>
              <label className={fieldLabel}>KEY FILE</label>
              <div className="flex gap-1">
                <Input value={keyPath} onChange={(e) => setKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" className="flex-1" />
                <Button variant="outline" size="sm" onClick={handleBrowseKey}>...</Button>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 shrink-0 cursor-pointer">
            <Switch checked={autoStart} onCheckedChange={setAutoStart} />
            <span className="text-xs text-[var(--on-surface-variant)]">Start automatically when Bifrost opens</span>
          </label>

          {/* Jump host (ProxyJump) */}
          <div>
            <span className={sectionLabel}>JUMP HOST</span>
            <JumpHostEditor
              value={jumpChain}
              onChange={setJumpChain}
              connections={connectionsList}
            />
          </div>

          {/* Forwards table */}
          <div className="flex-1 min-h-0 overflow-y-auto">
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
              <Button variant="spectral" size="sm" onClick={() => selectedId ? handleStart(selectedId) : handleSave()} disabled={!name.trim() || !host.trim()}>
                {selectedId ? <><Play className="h-3 w-3" /> START</> : <><Plus className="h-3 w-3" /> SAVE</>}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !name.trim() || !host.trim()}>
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
