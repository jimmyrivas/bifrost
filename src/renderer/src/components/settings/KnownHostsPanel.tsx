import { useState, useEffect, useCallback } from 'react'
import { Trash2, RefreshCw, Shield } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface HostKeyInfo {
  host: string
  port: number
  fingerprint: string
  algorithm: string
  firstSeen: string
  lastSeen: string
}

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] mb-2'

export function KnownHostsPanel(): JSX.Element {
  const [hosts, setHosts] = useState<HostKeyInfo[]>([])
  const [loading, setLoading] = useState(false)

  const loadHosts = useCallback(async () => {
    if (!window.bifrost?.ssh?.getKnownHosts) return
    setLoading(true)
    try {
      const list = await window.bifrost.ssh.getKnownHosts()
      setHosts(list)
    } catch {
      setHosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadHosts() }, [loadHosts])

  const handleRemove = useCallback(async (host: string, port: number) => {
    const ok = window.confirm(`Remove known host key for ${host}:${port}?`)
    if (!ok) return
    await window.bifrost.ssh.removeKnownHost(host, port)
    await loadHosts()
  }, [loadHosts])

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[var(--on-surface-variant)]" />
          <h3 className="text-sm font-semibold text-[var(--on-surface)]">Known Hosts</h3>
        </div>
        <button
          onClick={loadHosts}
          className="p-1.5 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50"
          aria-label="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs text-[var(--on-surface-variant)]">
        SSH host keys that have been verified and trusted. Remove a host to re-verify on next connection.
      </p>

      {loading ? (
        <div className="text-xs text-[var(--on-surface-variant)] py-4 text-center">Loading...</div>
      ) : hosts.length === 0 ? (
        <div className="text-xs text-[var(--on-surface-variant)] py-4 text-center">No known hosts yet</div>
      ) : (
        <div className="rounded-[var(--radius)] bg-[var(--surface-container-low)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center px-3 py-2 bg-[var(--surface-container-high)]">
            <span className={cn(sectionLabel, 'mb-0 flex-1')}>HOST</span>
            <span className={cn(sectionLabel, 'mb-0 w-24')}>ALGORITHM</span>
            <span className={cn(sectionLabel, 'mb-0 w-24')}>FIRST SEEN</span>
            <span className={cn(sectionLabel, 'mb-0 w-8')} />
          </div>
          {hosts.map((h, idx) => (
            <div
              key={`${h.host}:${h.port}`}
              className={cn(
                'flex items-center px-3 py-2 text-xs',
                idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-container-low)]'
              )}
            >
              <div className="flex-1 min-w-0">
                <span className="text-[var(--on-surface)] font-[family-name:var(--font-mono)] truncate block">
                  {h.host}:{h.port}
                </span>
                <span className="text-[9px] text-[var(--on-surface-variant)] font-[family-name:var(--font-mono)] truncate block">
                  {h.fingerprint}
                </span>
              </div>
              <span className="w-24 text-[var(--on-surface-variant)] font-[family-name:var(--font-mono)] text-[10px]">
                {h.algorithm}
              </span>
              <span className="w-24 text-[var(--on-surface-variant)] text-[10px]">
                {formatDate(h.firstSeen)}
              </span>
              <button
                onClick={() => handleRemove(h.host, h.port)}
                className="w-8 flex justify-center text-[var(--on-surface-variant)] hover:text-[var(--error)] p-1"
                aria-label={`Remove ${h.host}`}
                title="Remove host key"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
