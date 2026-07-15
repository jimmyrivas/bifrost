import { useState, useCallback, type ReactNode } from 'react'
import { FileDown, FileUp, Server, Boxes, Cloud } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useConnectionsStore } from '@renderer/stores/connections.store'
import { showToast } from '@renderer/lib/protocol-dispatch'
import { terraformHostToConnection } from '@renderer/lib/discovery-import'

// Row types are derived from the preload surface so we never cross-import
// main-process types into the renderer.
type SshEntry = Awaited<ReturnType<typeof window.bifrost.import.sshConfig>>[number]
type AnsibleHost = Awaited<ReturnType<typeof window.bifrost.import.ansibleInventory>>[number]
type TerraformHost = Awaited<ReturnType<typeof window.bifrost.discovery.terraform>>[number]

const sectionCard = 'rounded-[var(--radius)] bg-[var(--surface-container-high)] p-4 flex flex-col gap-3'
const sectionTitle = 'text-sm font-semibold text-[var(--on-surface)] flex items-center gap-2'
const sectionHint = 'text-xs text-[var(--on-surface-variant)]'

/** Refresh the connections list + groups after any import writes to the DB. */
async function refreshConnections(): Promise<void> {
  const s = useConnectionsStore.getState()
  await Promise.all([s.fetchConnections(), s.fetchGroups()])
}

interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
}

/** Generic preview table with per-row + select-all checkboxes. */
function SelectTable<T>({
  rows,
  columns,
  selected,
  onToggle,
  onToggleAll
}: {
  rows: T[]
  columns: Column<T>[]
  selected: Set<number>
  onToggle: (i: number) => void
  onToggleAll: () => void
}): JSX.Element {
  const allChecked = rows.length > 0 && selected.size === rows.length
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] bg-[var(--surface-container-highest)]">
      <table className="w-full text-xs [font-family:var(--font-mono)]">
        <thead>
          <tr className="text-[var(--on-surface-variant)] text-left">
            <th className="p-2 w-8">
              <input type="checkbox" checked={allChecked} onChange={onToggleAll} aria-label="Select all" />
            </th>
            {columns.map((c) => (
              <th key={c.header} className="p-2 font-medium">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/40">
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => onToggle(i)}
                  aria-label={`Select row ${i + 1}`}
                />
              </td>
              {columns.map((c) => (
                <td key={c.header} className="p-2 truncate max-w-[16rem]">{c.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Small hook: manage a preview list + its selection set together. */
function usePreview<T>(): {
  rows: T[] | null
  selected: Set<number>
  set: (rows: T[]) => void
  clear: () => void
  toggle: (i: number) => void
  toggleAll: () => void
  chosen: () => T[]
} {
  const [rows, setRows] = useState<T[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const set = useCallback((r: T[]) => {
    setRows(r)
    setSelected(new Set(r.map((_, i) => i))) // default: all selected
  }, [])
  const clear = useCallback(() => {
    setRows(null)
    setSelected(new Set())
  }, [])
  const toggle = useCallback((i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }, [])
  const toggleAll = useCallback(() => {
    setSelected((prev) => (rows && prev.size === rows.length ? new Set() : new Set((rows ?? []).map((_, i) => i))))
  }, [rows])
  const chosen = useCallback(() => (rows ?? []).filter((_, i) => selected.has(i)), [rows, selected])
  return { rows, selected, set, clear, toggle, toggleAll, chosen }
}

export function ImportExportPanel(): JSX.Element {
  const ssh = usePreview<SshEntry>()
  const ansible = usePreview<AnsibleHost>()
  const terraform = usePreview<TerraformHost>()
  const [busy, setBusy] = useState<string | null>(null)

  const guard = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }, [])

  // ── SSH config ──────────────────────────────────────────────
  const scanSsh = () => guard('ssh-scan', async () => {
    const entries = await window.bifrost.import.sshConfig()
    if (entries.length === 0) {
      showToast({ variant: 'info', message: 'No hosts found in ~/.ssh/config' })
      return
    }
    ssh.set(entries)
  })
  const applySsh = () => guard('ssh-apply', async () => {
    const chosen = ssh.chosen()
    if (chosen.length === 0) return
    const ids = await window.bifrost.import.sshConfigApply(chosen)
    await refreshConnections()
    ssh.clear()
    showToast({ variant: 'success', message: `Imported ${ids.length} SSH host${ids.length === 1 ? '' : 's'}` })
  })

  // ── Ansible inventory ───────────────────────────────────────
  const chooseAnsible = () => guard('ansible-scan', async () => {
    const hosts = await window.bifrost.import.ansibleInventory()
    if (hosts.length === 0) {
      showToast({ variant: 'info', message: 'No hosts found in the inventory' })
      return
    }
    ansible.set(hosts)
  })
  const applyAnsible = () => guard('ansible-apply', async () => {
    const chosen = ansible.chosen()
    if (chosen.length === 0) return
    const ids = await window.bifrost.import.ansibleInventoryApply(chosen)
    await refreshConnections()
    ansible.clear()
    showToast({ variant: 'success', message: `Imported ${ids.length} host${ids.length === 1 ? '' : 's'}` })
  })

  // ── Terraform state ─────────────────────────────────────────
  const chooseTerraform = () => guard('tf-scan', async () => {
    const paths = await window.bifrost.window.showOpenDialog()
    if (!paths || paths.length === 0) return
    const hosts = await window.bifrost.discovery.terraform(paths[0])
    const withIp = hosts.filter((h) => h.publicIp || h.privateIp)
    if (withIp.length === 0) {
      showToast({ variant: 'info', message: 'No IP-bearing resources found in the state file' })
      return
    }
    terraform.set(withIp)
  })
  const applyTerraform = () => guard('tf-apply', async () => {
    const chosen = terraform.chosen()
    if (chosen.length === 0) return
    let count = 0
    for (const h of chosen) {
      const conn = terraformHostToConnection(h)
      if (!conn) continue
      await window.bifrost.connections.create(conn)
      count++
    }
    await refreshConnections()
    terraform.clear()
    showToast({ variant: 'success', message: `Imported ${count} host${count === 1 ? '' : 's'}` })
  })

  // ── JSON export / import ────────────────────────────────────
  const exportJson = () => guard('export', async () => {
    const path = await window.bifrost.import.exportConnections()
    if (path) showToast({ variant: 'success', message: `Exported to ${path}` })
  })
  const importJson = () => guard('import', async () => {
    const { imported } = await window.bifrost.import.importConnections()
    await refreshConnections()
    showToast({ variant: 'success', message: `Imported ${imported} connection${imported === 1 ? '' : 's'}` })
  })

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <h3 className="text-sm font-semibold text-[var(--on-surface)]">Import / Export</h3>

      {/* SSH config */}
      <div className={sectionCard}>
        <div className={sectionTitle}><Server className="h-4 w-4" /> SSH config</div>
        <p className={sectionHint}>Parse <code>~/.ssh/config</code> and import selected hosts as SSH connections.</p>
        <div>
          <Button variant="secondary" onClick={scanSsh} disabled={busy === 'ssh-scan'}>
            {busy === 'ssh-scan' ? 'Scanning…' : 'Scan ~/.ssh/config'}
          </Button>
        </div>
        {ssh.rows && (
          <>
            <SelectTable
              rows={ssh.rows}
              selected={ssh.selected}
              onToggle={ssh.toggle}
              onToggleAll={ssh.toggleAll}
              columns={[
                { header: 'Host', cell: (r) => r.host },
                { header: 'HostName', cell: (r) => r.hostName ?? '—' },
                { header: 'User', cell: (r) => r.user ?? '—' },
                { header: 'Port', cell: (r) => r.port ?? 22 },
                { header: 'Key', cell: (r) => (r.identityFile ? '🔑' : '—') }
              ]}
            />
            <div className="flex gap-2">
              <Button onClick={applySsh} disabled={busy === 'ssh-apply' || ssh.selected.size === 0}>
                Import {ssh.selected.size} selected
              </Button>
              <Button variant="ghost" onClick={ssh.clear}>Cancel</Button>
            </div>
          </>
        )}
      </div>

      {/* Ansible inventory */}
      <div className={sectionCard}>
        <div className={sectionTitle}><Boxes className="h-4 w-4" /> Ansible inventory</div>
        <p className={sectionHint}>Choose an inventory file (INI or YAML) and import its hosts.</p>
        <div>
          <Button variant="secondary" onClick={chooseAnsible} disabled={busy === 'ansible-scan'}>
            {busy === 'ansible-scan' ? 'Reading…' : 'Choose inventory file…'}
          </Button>
        </div>
        {ansible.rows && (
          <>
            <SelectTable
              rows={ansible.rows}
              selected={ansible.selected}
              onToggle={ansible.toggle}
              onToggleAll={ansible.toggleAll}
              columns={[
                { header: 'Name', cell: (r) => r.name },
                { header: 'Host', cell: (r) => r.host },
                { header: 'User', cell: (r) => r.user ?? '—' },
                { header: 'Port', cell: (r) => r.port ?? 22 },
                { header: 'Group', cell: (r) => r.group }
              ]}
            />
            <div className="flex gap-2">
              <Button onClick={applyAnsible} disabled={busy === 'ansible-apply' || ansible.selected.size === 0}>
                Import {ansible.selected.size} selected
              </Button>
              <Button variant="ghost" onClick={ansible.clear}>Cancel</Button>
            </div>
          </>
        )}
      </div>

      {/* Terraform state */}
      <div className={sectionCard}>
        <div className={sectionTitle}><Cloud className="h-4 w-4" /> Terraform state</div>
        <p className={sectionHint}>Read a <code>.tfstate</code> file and import IP-bearing resources as SSH connections.</p>
        <div>
          <Button variant="secondary" onClick={chooseTerraform} disabled={busy === 'tf-scan'}>
            {busy === 'tf-scan' ? 'Reading…' : 'Choose .tfstate file…'}
          </Button>
        </div>
        {terraform.rows && (
          <>
            <SelectTable
              rows={terraform.rows}
              selected={terraform.selected}
              onToggle={terraform.toggle}
              onToggleAll={terraform.toggleAll}
              columns={[
                { header: 'Name', cell: (r) => r.name },
                { header: 'Type', cell: (r) => r.resourceType },
                { header: 'Public IP', cell: (r) => r.publicIp || '—' },
                { header: 'Private IP', cell: (r) => r.privateIp || '—' },
                { header: 'Provider', cell: (r) => r.provider }
              ]}
            />
            <div className="flex gap-2">
              <Button onClick={applyTerraform} disabled={busy === 'tf-apply' || terraform.selected.size === 0}>
                Import {terraform.selected.size} selected
              </Button>
              <Button variant="ghost" onClick={terraform.clear}>Cancel</Button>
            </div>
          </>
        )}
      </div>

      {/* JSON export / import */}
      <div className={sectionCard}>
        <div className={sectionTitle}><FileDown className="h-4 w-4" /> Backup (JSON)</div>
        <p className={sectionHint}>Export every connection and group to a JSON file, or restore from one.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportJson} disabled={busy === 'export'}>
            <FileDown className="h-4 w-4 mr-1" /> Export all…
          </Button>
          <Button variant="secondary" onClick={importJson} disabled={busy === 'import'}>
            <FileUp className="h-4 w-4 mr-1" /> Import from JSON…
          </Button>
        </div>
      </div>
    </div>
  )
}
