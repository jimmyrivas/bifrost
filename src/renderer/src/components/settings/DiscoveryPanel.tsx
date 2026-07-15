import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ServerCog } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useConnectionsStore } from '@renderer/stores/connections.store'
import { showToast } from '@renderer/lib/protocol-dispatch'
import { discoveredHostToConnection } from '@renderer/lib/discovery-import'

type DiscoveredHost = Awaited<ReturnType<typeof window.bifrost.discovery.aws>>[number]
type ProviderId = 'aws' | 'gcp' | 'azure' | 'docker' | 'podman' | 'kubernetes'

// `discovery:available` keys are CLI binary names, not provider ids.
const PROVIDERS: Array<{ id: ProviderId; label: string; cli: string }> = [
  { id: 'aws', label: 'AWS EC2', cli: 'aws' },
  { id: 'gcp', label: 'GCP', cli: 'gcloud' },
  { id: 'azure', label: 'Azure', cli: 'az' },
  { id: 'docker', label: 'Docker', cli: 'docker' },
  { id: 'podman', label: 'Podman', cli: 'podman' },
  { id: 'kubernetes', label: 'Kubernetes', cli: 'kubectl' }
]

const sectionCard = 'rounded-[var(--radius)] bg-[var(--surface-container-high)] p-4'
const rowKey = (h: DiscoveredHost): string => `${h.type}|${h.host}|${h.name}`

export function DiscoveryPanel(): JSX.Element {
  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const [scanning, setScanning] = useState<ProviderId | null>(null)
  const [hosts, setHosts] = useState<DiscoveredHost[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    window.bifrost.discovery.available().then(setAvailable).catch(() => setAvailable({}))
  }, [])

  const scan = useCallback(async (id: ProviderId) => {
    setScanning(id)
    try {
      const found = await window.bifrost.discovery[id]()
      // Replace any previous results for this provider, keep the others.
      setHosts((prev) => [...prev.filter((h) => h.type !== id), ...found])
      setSelected((prev) => {
        const next = new Set(prev)
        found.forEach((h) => next.add(rowKey(h)))
        return next
      })
      if (found.length === 0) {
        showToast({ variant: 'info', message: `No running ${id} instances found` })
      }
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setScanning(null)
    }
  }, [])

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === hosts.length ? new Set() : new Set(hosts.map(rowKey))))
  }, [hosts])

  const importSelected = useCallback(async () => {
    const chosen = hosts.filter((h) => selected.has(rowKey(h)))
    if (chosen.length === 0) return
    setImporting(true)
    try {
      for (const h of chosen) {
        await window.bifrost.connections.create(discoveredHostToConnection(h))
      }
      const s = useConnectionsStore.getState()
      await Promise.all([s.fetchConnections(), s.fetchGroups()])
      setHosts((prev) => prev.filter((h) => !selected.has(rowKey(h))))
      setSelected(new Set())
      showToast({ variant: 'success', message: `Imported ${chosen.length} host${chosen.length === 1 ? '' : 's'}` })
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setImporting(false)
    }
  }, [hosts, selected])

  const allChecked = hosts.length > 0 && selected.size === hosts.length

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <h3 className="text-sm font-semibold text-[var(--on-surface)]">Discovery</h3>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Scan cloud providers and container runtimes for running instances, then import them as SSH
        connections. Each provider uses its local CLI — greyed-out providers are missing the required tool.
      </p>

      {/* Provider grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {PROVIDERS.map(({ id, label, cli }) => {
          const ok = available[cli] === true
          return (
            <div key={id} className={sectionCard}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--on-surface)]">{label}</span>
                <span
                  className={ok ? 'text-[10px] text-[#6bff6b]' : 'text-[10px] text-[var(--on-surface-variant)]'}
                >
                  {ok ? 'ready' : `${cli} not found`}
                </span>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => scan(id)}
                disabled={!ok || scanning !== null}
              >
                {scanning === id ? (
                  <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Scanning…</>
                ) : (
                  <><ServerCog className="h-4 w-4 mr-1" /> Scan</>
                )}
              </Button>
            </div>
          )
        })}
      </div>

      {/* Results */}
      {hosts.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-[var(--radius)] bg-[var(--surface-container-highest)]">
            <table className="w-full text-xs [font-family:var(--font-mono)]">
              <thead>
                <tr className="text-[var(--on-surface-variant)] text-left">
                  <th className="p-2 w-8">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
                  </th>
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Host</th>
                  <th className="p-2 font-medium">Port</th>
                  <th className="p-2 font-medium">User</th>
                  <th className="p-2 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((h) => {
                  const key = rowKey(h)
                  return (
                    <tr key={key} className="text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/40">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          onChange={() => toggle(key)}
                          aria-label={`Select ${h.name}`}
                        />
                      </td>
                      <td className="p-2 truncate max-w-[14rem]">{h.name || '—'}</td>
                      <td className="p-2 truncate max-w-[12rem]">{h.host}</td>
                      <td className="p-2">{h.port || 22}</td>
                      <td className="p-2">{h.user || '—'}</td>
                      <td className="p-2">{h.type}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div>
            <Button onClick={importSelected} disabled={importing || selected.size === 0}>
              Import {selected.size} as connection{selected.size === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
