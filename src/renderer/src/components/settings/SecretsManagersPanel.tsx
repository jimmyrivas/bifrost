import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, KeyRound } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

interface PmStatus {
  onePassword?: { available: boolean; signedIn: boolean }
  bitwarden?: { available: boolean; unlocked: boolean }
  keepassxc?: { available: boolean }
  vault?: { available: boolean }
  awsSM?: { available: boolean }
  azureKV?: { available: boolean }
}

const MANAGERS: Array<{ key: keyof PmStatus; label: string; cli: string; note?: string }> = [
  { key: 'onePassword', label: '1Password', cli: 'op' },
  { key: 'bitwarden', label: 'Bitwarden', cli: 'bw' },
  { key: 'keepassxc', label: 'KeePassXC', cli: 'keepassxc-cli' },
  { key: 'vault', label: 'HashiCorp Vault', cli: 'vault' },
  { key: 'awsSM', label: 'AWS Secrets Manager', cli: 'aws' },
  { key: 'azureKV', label: 'Azure Key Vault', cli: 'az' }
]

/**
 * Read-only detection panel for external secret managers (#78/#79/#80). Shows
 * which provider CLIs are installed and whether they are signed in/unlocked.
 * The actual usage today is the per-connection 1Password reference field
 * (`op://…`) in the connection editor.
 */
export function SecretsManagersPanel(): JSX.Element {
  const [status, setStatus] = useState<PmStatus>({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setStatus((await window.bifrost.passwordManagers.detect()) as PmStatus)
    } catch {
      setStatus({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const stateOf = (m: keyof PmStatus): { ok: boolean; text: string } => {
    const s = status[m] as Record<string, boolean> | undefined
    if (!s?.available) return { ok: false, text: 'not installed' }
    if (m === 'onePassword') return { ok: true, text: s.signedIn ? 'signed in' : 'installed (sign in)' }
    if (m === 'bitwarden') return { ok: true, text: s.unlocked ? 'unlocked' : 'installed (unlock)' }
    return { ok: true, text: 'installed' }
  }

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--on-surface)] flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Secret managers
        </h3>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Refresh
        </Button>
      </div>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Bifrost detects these providers via their local CLIs. Today you can reference a 1Password secret
        per connection (the <code>op://…</code> field under Password auth); the others are detected here and
        available to the backend.
      </p>
      <div className="rounded-[var(--radius)] bg-[var(--surface-container-high)] divide-y divide-[var(--surface-container-highest)]">
        {MANAGERS.map((m) => {
          const st = stateOf(m.key)
          return (
            <div key={m.key} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="text-sm text-[var(--on-surface)]">{m.label}</div>
                <div className="text-[10px] text-[var(--on-surface-variant)] font-[family-name:var(--font-mono)]">{m.cli}</div>
              </div>
              <span className={st.ok ? 'text-[11px] text-[#6bff6b]' : 'text-[11px] text-[var(--on-surface-variant)]'}>
                {st.text}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
