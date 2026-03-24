import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'

const SSH_OPTIONS: Array<{ key: string; description: string; defaultValue: string }> = [
  { key: 'StrictHostKeyChecking', description: 'Verify host key', defaultValue: 'ask' },
  { key: 'ServerAliveInterval', description: 'Keep-alive interval (seconds)', defaultValue: '60' },
  { key: 'ServerAliveCountMax', description: 'Max keep-alive misses', defaultValue: '3' },
  { key: 'Compression', description: 'Enable compression', defaultValue: 'yes' },
  { key: 'TCPKeepAlive', description: 'TCP keep-alive', defaultValue: 'yes' },
  { key: 'ForwardAgent', description: 'Forward SSH agent', defaultValue: 'no' },
  { key: 'ForwardX11', description: 'Forward X11', defaultValue: 'no' },
  { key: 'ConnectTimeout', description: 'Connection timeout (seconds)', defaultValue: '30' },
  { key: 'ConnectionAttempts', description: 'Connection attempts', defaultValue: '1' },
  { key: 'LogLevel', description: 'Logging verbosity', defaultValue: 'INFO' },
  { key: 'PreferredAuthentications', description: 'Auth method order', defaultValue: 'publickey,password' },
  { key: 'PubkeyAuthentication', description: 'Public key auth', defaultValue: 'yes' },
  { key: 'PasswordAuthentication', description: 'Password auth', defaultValue: 'yes' },
  { key: 'KbdInteractiveAuthentication', description: 'Keyboard-interactive auth', defaultValue: 'yes' },
  { key: 'IdentitiesOnly', description: 'Use only configured keys', defaultValue: 'no' },
  { key: 'BatchMode', description: 'Disable prompts', defaultValue: 'no' },
  { key: 'Ciphers', description: 'Allowed ciphers', defaultValue: 'aes256-ctr,aes256-gcm@openssh.com' },
  { key: 'MACs', description: 'Message auth codes', defaultValue: 'hmac-sha2-256,hmac-sha2-512' },
  { key: 'KexAlgorithms', description: 'Key exchange algorithms', defaultValue: '' },
  { key: 'HostKeyAlgorithms', description: 'Host key algorithms', defaultValue: '' },
  { key: 'RekeyLimit', description: 'Re-key limit', defaultValue: 'default none' },
  { key: 'ProxyCommand', description: 'Proxy command', defaultValue: '' },
  { key: 'ProxyJump', description: 'Jump host', defaultValue: '' },
  { key: 'LocalForward', description: 'Local port forward', defaultValue: '' },
  { key: 'RemoteForward', description: 'Remote port forward', defaultValue: '' },
  { key: 'DynamicForward', description: 'SOCKS proxy forward', defaultValue: '' },
  { key: 'SendEnv', description: 'Environment variables to send', defaultValue: '' },
  { key: 'SetEnv', description: 'Set remote env variables', defaultValue: '' },
  { key: 'RequestTTY', description: 'Request TTY', defaultValue: 'auto' },
  { key: 'RemoteCommand', description: 'Remote command', defaultValue: '' },
  { key: 'UserKnownHostsFile', description: 'Known hosts file', defaultValue: '~/.ssh/known_hosts' },
  { key: 'GlobalKnownHostsFile', description: 'Global known hosts', defaultValue: '/etc/ssh/ssh_known_hosts' }
]

interface SshOptionsPanelProps {
  options: Record<string, string>
  onChange: (options: Record<string, string>) => void
}

export function SshOptionsPanel({ options, onChange }: SshOptionsPanelProps): JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const [search, setSearch] = useState('')

  const handleSet = useCallback(
    (key: string, value: string) => {
      const next = { ...options }
      if (value) {
        next[key] = value
      } else {
        delete next[key]
      }
      onChange(next)
    },
    [options, onChange]
  )

  const handleRemove = useCallback(
    (key: string) => {
      const next = { ...options }
      delete next[key]
      onChange(next)
    },
    [options, onChange]
  )

  const activeKeys = Object.keys(options)
  const lowerSearch = search.toLowerCase()
  const filteredOptions = SSH_OPTIONS.filter(
    (o) =>
      o.key.toLowerCase().includes(lowerSearch) ||
      o.description.toLowerCase().includes(lowerSearch)
  )

  const reuseConnection = options['__reuseConnection'] === 'true'
  const handleReuseToggle = useCallback((checked: boolean) => {
    const next = { ...options }
    if (checked) {
      next['__reuseConnection'] = 'true'
    } else {
      delete next['__reuseConnection']
    }
    onChange(next)
  }, [options, onChange])

  return (
    <div className="flex flex-col gap-3">
      {/* Session multiplexing toggle */}
      <label className="flex items-center justify-between cursor-pointer p-2 rounded-[var(--radius)] bg-[var(--surface-container-high)]">
        <div>
          <span className="text-xs text-[var(--on-surface)]">Reuse SSH Connection</span>
          <span className="text-[9px] text-[var(--on-surface-variant)] block">Share one SSH session across multiple terminals to the same host</span>
        </div>
        <Switch checked={reuseConnection} onCheckedChange={handleReuseToggle} />
      </label>

      <button
        className="flex items-center gap-2 text-left"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
          Advanced SSH Options
        </span>
        {activeKeys.length > 0 && (
          <span className="text-[9px] text-[#6bd5ff]">{activeKeys.length} set</span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2">
          {/* Active options */}
          {activeKeys.length > 0 && (
            <div className="flex flex-col gap-1.5 p-2 rounded-[var(--radius)] bg-[var(--surface-container-high)]">
              {activeKeys.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--on-surface)] w-36 shrink-0 truncate">
                    {key}
                  </span>
                  <Input
                    value={options[key]}
                    onChange={(e) => handleSet(key, e.target.value)}
                    className="h-6 text-[10px] flex-1"
                  />
                  <button
                    onClick={() => handleRemove(key)}
                    className="p-0.5 text-[var(--on-surface-variant)] hover:text-[var(--error)]"
                    aria-label={`Remove ${key}`}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add options */}
          <div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SSH options..."
              className={cn(
                'w-full bg-[var(--surface-container-highest)] rounded-[var(--radius)] px-2 py-1.5',
                'text-[10px] text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/50',
                'outline-none ghost-border mb-1.5'
              )}
            />
            <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
              {filteredOptions
                .filter((o) => !activeKeys.includes(o.key))
                .map((option) => (
                  <button
                    key={option.key}
                    onClick={() => handleSet(option.key, option.defaultValue)}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded-[var(--radius)] text-left',
                      'hover:bg-[var(--surface-container-highest)]/50 transition-colors'
                    )}
                  >
                    <Plus size={10} className="text-[var(--on-surface-variant)] shrink-0" />
                    <span className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--on-surface)]">
                      {option.key}
                    </span>
                    <span className="text-[9px] text-[var(--on-surface-variant)] truncate">
                      {option.description}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
