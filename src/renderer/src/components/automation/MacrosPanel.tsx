import { useState, useEffect, useCallback, useRef } from 'react'
import { MacroEditor, type Macro } from './MacroEditor'
import { useConnectionsStore } from '@renderer/stores/connections.store'
import { showToast } from '@renderer/lib/protocol-dispatch'

type MacroRow = Awaited<ReturnType<typeof window.bifrost.macros.list>>[number]
type MacroInput = Parameters<typeof window.bifrost.macros.save>[1][number]
type ConnRow = Awaited<ReturnType<typeof window.bifrost.connections.list>>[number]

const toMacro = (r: MacroRow): Macro => ({
  id: r.id,
  name: r.name,
  command: r.command,
  type: r.type,
  confirmBeforeExec: !!r.confirmBeforeExec
})
const toInput = (m: Macro): MacroInput => ({
  name: m.name,
  command: m.command,
  type: m.type,
  confirmBeforeExec: m.confirmBeforeExec
})

/**
 * Stateful container over the presentational {@link MacroEditor}. Loads global
 * macros and — for an explicitly picked connection — that connection's macros,
 * persisting via `macros:save`. The connection is chosen from a dropdown here
 * (not the sidebar selection) so the "Per-Connection" tab always has a clear,
 * controllable target. Saves are debounced (the editor fires onChange per
 * keystroke) and do NOT reload mid-edit so inputs keep focus.
 */
export function MacrosPanel(): JSX.Element {
  const selectedConnectionId = useConnectionsStore((s) => s.selectedConnectionId)
  const [connections, setConnections] = useState<Array<{ id: string; name: string }>>([])
  const [connId, setConnId] = useState<string>('')
  const [globalMacros, setGlobalMacros] = useState<Macro[]>([])
  const [connMacros, setConnMacros] = useState<Macro[]>([])
  const timers = useRef<{ global?: ReturnType<typeof setTimeout>; conn?: ReturnType<typeof setTimeout> }>({})

  // Connection list for the picker; default to the sidebar-selected one or the first.
  useEffect(() => {
    window.bifrost.connections
      .list()
      .then((rows: ConnRow[]) => {
        const list = rows.map((r) => ({ id: r.id, name: r.name }))
        setConnections(list)
        setConnId((cur) => cur || selectedConnectionId || list[0]?.id || '')
      })
      .catch(() => {})
  }, [selectedConnectionId])

  useEffect(() => {
    window.bifrost.macros.list().then((rows) => setGlobalMacros(rows.map(toMacro))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!connId) {
      setConnMacros([])
      return
    }
    window.bifrost.macros.list(connId).then((rows) => setConnMacros(rows.map(toMacro))).catch(() => {})
  }, [connId])

  const scheduleSave = useCallback(
    (which: 'global' | 'conn', connectionId: string | null, macros: Macro[]) => {
      clearTimeout(timers.current[which])
      timers.current[which] = setTimeout(() => {
        window.bifrost.macros
          .save(connectionId, macros.filter((m) => m.name.trim()).map(toInput))
          .catch((err) => showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) }))
      }, 500)
    },
    []
  )

  useEffect(() => () => { clearTimeout(timers.current.global); clearTimeout(timers.current.conn) }, [])

  const onGlobalChange = useCallback((next: Macro[]) => {
    setGlobalMacros(next)
    scheduleSave('global', null, next)
  }, [scheduleSave])

  const onConnectionChange = useCallback((next: Macro[]) => {
    setConnMacros(next)
    if (!connId) {
      showToast({ variant: 'info', message: 'Pick a connection first' })
      return
    }
    scheduleSave('conn', connId, next)
  }, [connId, scheduleSave])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-4 pt-2">
        <span className="text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
          Per-connection macros for
        </span>
        <select
          className="h-7 rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-2 text-xs text-[var(--on-surface)] ghost-border"
          value={connId}
          onChange={(e) => setConnId(e.target.value)}
          aria-label="Connection for per-connection macros"
        >
          {connections.length === 0 && <option value="">No connections</option>}
          {connections.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <MacroEditor
        globalMacros={globalMacros}
        connectionMacros={connMacros}
        onGlobalChange={onGlobalChange}
        onConnectionChange={onConnectionChange}
      />
    </div>
  )
}
