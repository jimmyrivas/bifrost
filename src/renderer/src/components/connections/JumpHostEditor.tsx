import { useEffect, useMemo, useState, useCallback } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'

export type HopAuthType = 'userpass' | 'key' | 'key_pass' | 'agent'

export interface JumpHostInline {
  host: string
  port?: number
  username: string
  authType: HopAuthType
  privateKeyPath?: string | null
  /** Plain password kept locally in the editor only.
   *  At save time the parent encrypts (via window.bifrost.credentials)
   *  and serializes to base64 in `encryptedPassword`. */
  password?: string | null
  encryptedPassword?: string | null
  passphrase?: string | null
  encryptedPassphrase?: string | null
}

export interface JumpHostHop {
  connectionId?: string
  inline?: JumpHostInline
  usernameOverride?: string
}

export type JumpChain = JumpHostHop[]

export interface JumpServerConfig {
  chain: JumpChain
}

interface ConnectionRef {
  id: string
  name: string
  host?: string | null
  username?: string | null
  method: string
}

interface Props {
  value: JumpChain
  onChange: (next: JumpChain) => void
  /** ID of the connection being edited — excluded from the dropdown to avoid
   *  trivial self-reference; cycle detection on save catches deeper loops. */
  selfId?: string
  /** SSH-method connections available as references. */
  connections: ConnectionRef[]
}

const emptyInline: JumpHostInline = {
  host: '',
  username: '',
  authType: 'agent'
}

export function JumpHostEditor({ value, onChange, selfId, connections }: Props): JSX.Element {
  const [enabled, setEnabled] = useState(value.length > 0)

  useEffect(() => {
    if (value.length > 0 && !enabled) setEnabled(true)
  }, [value.length, enabled])

  const sshConnections = useMemo(
    () => connections.filter((c) => c.method === 'ssh' || c.method === 'mosh').filter((c) => c.id !== selfId),
    [connections, selfId]
  )

  const updateHop = useCallback(
    (idx: number, hop: JumpHostHop) => {
      const next = [...value]
      next[idx] = hop
      onChange(next)
    },
    [value, onChange]
  )

  const addHop = useCallback(() => {
    onChange([...value, sshConnections[0] ? { connectionId: sshConnections[0].id } : { inline: { ...emptyInline } }])
  }, [value, onChange, sshConnections])

  const removeHop = useCallback(
    (idx: number) => {
      const next = value.slice()
      next.splice(idx, 1)
      onChange(next)
    },
    [value, onChange]
  )

  const moveHop = useCallback(
    (idx: number, delta: number) => {
      const target = idx + delta
      if (target < 0 || target >= value.length) return
      const next = value.slice()
      const [item] = next.splice(idx, 1)
      next.splice(target, 0, item)
      onChange(next)
    },
    [value, onChange]
  )

  const handleEnableToggle = useCallback(
    (checked: boolean) => {
      setEnabled(checked)
      if (!checked) onChange([])
      else if (value.length === 0) {
        onChange([sshConnections[0] ? { connectionId: sshConnections[0].id } : { inline: { ...emptyInline } }])
      }
    },
    [onChange, sshConnections, value.length]
  )

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between cursor-pointer p-2 rounded-[var(--radius)] bg-[var(--surface-container-high)]">
        <div>
          <span className="text-xs text-[var(--on-surface)]">Use jump host</span>
          <span className="text-[9px] text-[var(--on-surface-variant)] block">
            Route this connection through one or more bastions (ProxyJump). Each hop opens an SSH-over-SSH tunnel to the next.
          </span>
        </div>
        <Switch checked={enabled} onCheckedChange={handleEnableToggle} />
      </label>

      {enabled && value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((hop, idx) => (
            <HopCard
              key={idx}
              index={idx}
              hop={hop}
              total={value.length}
              connections={sshConnections}
              onChange={(h) => updateHop(idx, h)}
              onRemove={() => removeHop(idx)}
              onMove={(delta) => moveHop(idx, delta)}
            />
          ))}

          <button
            type="button"
            onClick={addHop}
            className={cn(
              'flex items-center justify-center gap-1.5 h-8 rounded-[var(--radius)] border border-dashed',
              'border-[var(--on-surface-variant)]/30 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]',
              'hover:bg-[var(--surface-container-highest)]/50 text-[10px] font-semibold uppercase tracking-wider'
            )}
          >
            <Plus size={11} />
            Add hop
          </button>

          <p className="text-[9px] text-[var(--on-surface-variant)] flex items-center gap-1.5">
            <AlertTriangle size={10} className="text-[var(--warning,#facc15)]" />
            Hops connect in order: hop 1 → hop 2 → … → target. Loops are blocked at save time.
          </p>
        </div>
      )}
    </div>
  )
}

interface HopCardProps {
  index: number
  total: number
  hop: JumpHostHop
  connections: ConnectionRef[]
  onChange: (h: JumpHostHop) => void
  onRemove: () => void
  onMove: (delta: number) => void
}

function HopCard({ index, total, hop, connections, onChange, onRemove, onMove }: HopCardProps): JSX.Element {
  const mode: 'reference' | 'inline' = hop.inline ? 'inline' : 'reference'

  const setMode = (m: 'reference' | 'inline'): void => {
    if (m === mode) return
    if (m === 'reference') {
      onChange({ connectionId: connections[0]?.id })
    } else {
      onChange({ inline: { ...emptyInline } })
    }
  }

  return (
    <div className="rounded-[var(--radius)] bg-[var(--surface-container-high)] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
          Hop {index + 1} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="p-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] disabled:opacity-30"
            title="Move up"
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="p-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] disabled:opacity-30"
            title="Move down"
          >
            <ChevronDown size={12} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-[var(--on-surface-variant)] hover:text-[var(--error,#f87171)]"
            title="Remove hop"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="grid grid-cols-2 gap-1">
        {(['reference', 'inline'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'h-7 rounded-[var(--radius)] text-[10px] font-semibold uppercase tracking-wider transition-colors',
              mode === m
                ? 'bg-[#6bd5ff] text-[#0a0a0c]'
                : 'bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
            )}
          >
            {m === 'reference' ? 'Saved connection' : 'Inline'}
          </button>
        ))}
      </div>

      {mode === 'reference' ? (
        <ReferenceFields hop={hop} connections={connections} onChange={onChange} />
      ) : (
        <InlineFields hop={hop} onChange={onChange} />
      )}
    </div>
  )
}

interface ReferenceFieldsProps {
  hop: JumpHostHop
  connections: ConnectionRef[]
  onChange: (h: JumpHostHop) => void
}

function ReferenceFields({ hop, connections, onChange }: ReferenceFieldsProps): JSX.Element {
  if (connections.length === 0) {
    return (
      <p className="text-[10px] text-[var(--on-surface-variant)] py-2">
        No saved SSH connections to use as a bastion. Switch to <strong className="text-[var(--on-surface)]">Inline</strong> or save one first.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="text-[10px] text-[var(--on-surface-variant)] mb-1 block">Connection</label>
        <select
          value={hop.connectionId ?? ''}
          onChange={(e) => onChange({ connectionId: e.target.value, usernameOverride: hop.usernameOverride })}
          className="h-8 w-full rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-2 text-xs text-[var(--on-surface)] ghost-border outline-none"
        >
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.host ? `— ${c.username ?? ''}@${c.host}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-[var(--on-surface-variant)] mb-1 block">
          Override username (optional)
        </label>
        <Input
          value={hop.usernameOverride ?? ''}
          onChange={(e) =>
            onChange({
              connectionId: hop.connectionId,
              usernameOverride: e.target.value || undefined
            })
          }
          placeholder="leave blank to use the connection's username"
          className="h-8 text-xs"
        />
      </div>
    </div>
  )
}

interface InlineFieldsProps {
  hop: JumpHostHop
  onChange: (h: JumpHostHop) => void
}

function InlineFields({ hop, onChange }: InlineFieldsProps): JSX.Element {
  const inline = hop.inline ?? emptyInline
  const update = (patch: Partial<JumpHostInline>): void => {
    onChange({ inline: { ...inline, ...patch } })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="text-[10px] text-[var(--on-surface-variant)] mb-1 block">Host</label>
          <Input
            value={inline.host}
            onChange={(e) => update({ host: e.target.value })}
            placeholder="bastion.example.com"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--on-surface-variant)] mb-1 block">Port</label>
          <Input
            type="number"
            value={inline.port ?? 22}
            onChange={(e) => update({ port: parseInt(e.target.value, 10) || 22 })}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-[var(--on-surface-variant)] mb-1 block">Username</label>
        <Input
          value={inline.username}
          onChange={(e) => update({ username: e.target.value })}
          placeholder="root"
          className="h-8 text-xs"
        />
      </div>

      <div>
        <label className="text-[10px] text-[var(--on-surface-variant)] mb-1 block">Auth type</label>
        <div className="grid grid-cols-4 gap-1">
          {(['agent', 'key', 'key_pass', 'userpass'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => update({ authType: a })}
              className={cn(
                'h-7 rounded-[var(--radius)] text-[9px] font-semibold uppercase tracking-wider transition-colors',
                inline.authType === a
                  ? 'bg-[#6bd5ff] text-[#0a0a0c]'
                  : 'bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
              )}
            >
              {a === 'userpass' ? 'password' : a === 'key_pass' ? 'key + pass' : a}
            </button>
          ))}
        </div>
      </div>

      {(inline.authType === 'key' || inline.authType === 'key_pass') && (
        <div>
          <label className="text-[10px] text-[var(--on-surface-variant)] mb-1 block">
            Private key path
          </label>
          <Input
            value={inline.privateKeyPath ?? ''}
            onChange={(e) => update({ privateKeyPath: e.target.value })}
            placeholder="/home/user/.ssh/id_rsa"
            className="h-8 text-xs font-[family-name:var(--font-mono)]"
          />
        </div>
      )}

      {inline.authType === 'userpass' && (
        <div>
          <label className="text-[10px] text-[var(--on-surface-variant)] mb-1 block">Password</label>
          <Input
            type="password"
            value={inline.password ?? ''}
            onChange={(e) => update({ password: e.target.value })}
            placeholder={inline.encryptedPassword ? '(saved — leave blank to keep)' : ''}
            className="h-8 text-xs"
          />
          <p className="text-[9px] text-[var(--on-surface-variant)] mt-1">
            Encrypted with the system keychain when saved.
          </p>
        </div>
      )}

      {inline.authType === 'key_pass' && (
        <div>
          <label className="text-[10px] text-[var(--on-surface-variant)] mb-1 block">Passphrase</label>
          <Input
            type="password"
            value={inline.passphrase ?? ''}
            onChange={(e) => update({ passphrase: e.target.value })}
            placeholder={inline.encryptedPassphrase ? '(saved — leave blank to keep)' : ''}
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  )
}
