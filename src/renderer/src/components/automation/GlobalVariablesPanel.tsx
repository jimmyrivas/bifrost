import { useState, useEffect, useCallback, useRef } from 'react'
import { VariableManager, type Variable } from './VariableManager'
import { showToast } from '@renderer/lib/protocol-dispatch'

/**
 * Stateful container over the presentational {@link VariableManager}. Loads the
 * global variables from the DB on mount and persists edits through the
 * `variables:*` IPC — the editor stays a pure controlled component.
 *
 * `onChange` hands back the full next list; we diff it against the last known
 * state to issue the minimal set of `setGlobal` (upsert) / `deleteGlobal` calls.
 * Rows with a blank name are placeholders (just added, not filled in) and are
 * not persisted until named.
 */
export function GlobalVariablesPanel(): JSX.Element {
  const [variables, setVariables] = useState<Variable[]>([])
  const prev = useRef<Variable[]>([])

  const load = useCallback(async () => {
    try {
      const rows = await window.bifrost.variables.listGlobal()
      const vars = rows.map((r) => ({ id: r.id, name: r.name, value: r.value, isPassword: !!r.isPassword }))
      setVariables(vars)
      prev.current = vars
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleChange = useCallback(
    async (next: Variable[]) => {
      setVariables(next) // optimistic
      try {
        const before = prev.current
        const nextIds = new Set(next.map((v) => v.id))
        for (const p of before) {
          if (!nextIds.has(p.id)) await window.bifrost.variables.deleteGlobal(p.id)
        }
        for (const v of next) {
          if (!v.name.trim()) continue // skip unnamed placeholder rows
          const b = before.find((p) => p.id === v.id)
          if (!b || b.name !== v.name || b.value !== v.value || b.isPassword !== v.isPassword) {
            await window.bifrost.variables.setGlobal(v.id, v.name, v.value, v.isPassword)
          }
        }
        prev.current = next
      } catch (err) {
        showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
        await load() // resync from DB on failure (e.g. duplicate name)
      }
    },
    [load]
  )

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[var(--on-surface-variant)] px-4 pt-4">
        These are <strong>global</strong> variables — not tied to a terminal or connection. Reference one
        anywhere the app expands variables (remote commands, macros, tab titles) as{' '}
        <code className="font-[family-name:var(--font-mono)]">&lt;GV:name&gt;</code>. Typing{' '}
        <code className="font-[family-name:var(--font-mono)]">&lt;GV:name&gt;</code> directly into a terminal
        is <em>not</em> expanded — the terminal sends your keystrokes as-is.
      </p>
      <VariableManager variables={variables} onChange={handleChange} />
    </div>
  )
}
