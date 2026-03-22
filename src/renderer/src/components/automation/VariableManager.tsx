import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Eye, EyeOff, Pencil, Check, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'

export interface Variable {
  id: string
  name: string
  value: string
  isPassword: boolean
}

interface VariableManagerProps {
  variables: Variable[]
  onChange: (variables: Variable[]) => void
}

let varCounter = 0
function newVarId(): string { return `var-${++varCounter}-${Date.now()}` }

const headerCell = 'px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] text-left'
const bodyCell = 'px-4 py-2.5 text-sm'

export function VariableManager({ variables, onChange }: VariableManagerProps): JSX.Element {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editIsPassword, setEditIsPassword] = useState(false)
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())

  const addVariable = useCallback(() => {
    const id = newVarId()
    onChange([...variables, { id, name: '', value: '', isPassword: false }])
    setEditingId(id)
    setEditName('')
    setEditValue('')
    setEditIsPassword(false)
  }, [variables, onChange])

  const deleteVariable = useCallback((id: string) => {
    onChange(variables.filter((v) => v.id !== id))
    if (editingId === id) setEditingId(null)
  }, [variables, onChange, editingId])

  const startEdit = useCallback((v: Variable) => {
    setEditingId(v.id)
    setEditName(v.name)
    setEditValue(v.value)
    setEditIsPassword(v.isPassword)
  }, [])

  const confirmEdit = useCallback(() => {
    if (!editingId || !editName.trim()) return
    onChange(variables.map((v) =>
      v.id === editingId ? { ...v, name: editName, value: editValue, isPassword: editIsPassword } : v
    ))
    setEditingId(null)
  }, [editingId, editName, editValue, editIsPassword, variables, onChange])

  const cancelEdit = useCallback(() => {
    if (editingId) {
      const v = variables.find((x) => x.id === editingId)
      if (v && !v.name && !v.value) onChange(variables.filter((x) => x.id !== editingId))
    }
    setEditingId(null)
  }, [editingId, variables, onChange])

  const toggleVisible = useCallback((id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--on-surface)]">{t('variables.title', 'Global Variables')}</h3>
        <Button variant="spectral" size="sm" onClick={addVariable}>
          <Plus className="h-3 w-3" /> {t('variables.add', 'ADD VARIABLE')}
        </Button>
      </div>

      <div className="rounded-[var(--radius)] overflow-hidden" role="grid" aria-label={t('variables.title', 'Global Variables')}>
        {/* Header */}
        <div className="surface-2 flex" role="row">
          <div className={cn(headerCell, 'flex-1')} role="columnheader">{t('variables.name', 'NAME')}</div>
          <div className={cn(headerCell, 'flex-1')} role="columnheader">{t('variables.value', 'VALUE')}</div>
          <div className={cn(headerCell, 'w-24 text-center')} role="columnheader">{t('variables.password', 'SECRET')}</div>
          <div className={cn(headerCell, 'w-24 text-center')} role="columnheader">{t('variables.actions', 'ACTIONS')}</div>
        </div>

        {/* Body */}
        {variables.length === 0 ? (
          <div className="text-center text-xs text-[var(--on-surface-variant)] py-8 surface-1">
            {t('variables.empty', 'No variables defined.')}
          </div>
        ) : variables.map((v, idx) => {
          const isEditing = editingId === v.id
          const isVisible = visibleIds.has(v.id)

          return (
            <div
              key={v.id} role="row"
              className={cn(
                'flex items-center transition-colors',
                idx % 2 === 0 ? 'bg-[var(--surface-container-low)]' : 'bg-[var(--surface)]',
                'hover:bg-[var(--surface-container-high)]/50'
              )}
            >
              <div className={cn(bodyCell, 'flex-1')}>
                {isEditing ? (
                  <Input
                    value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-xs" placeholder="VARIABLE_NAME" autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit() }}
                    aria-label="Variable name"
                  />
                ) : (
                  <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--on-surface)]">{v.name}</span>
                )}
              </div>

              <div className={cn(bodyCell, 'flex-1')}>
                {isEditing ? (
                  <Input
                    value={editValue} onChange={(e) => setEditValue(e.target.value)}
                    type={editIsPassword ? 'password' : 'text'} className="h-7 text-xs"
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit() }}
                    aria-label="Variable value"
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--on-surface-variant)]">
                      {v.isPassword && !isVisible ? '********' : v.value}
                    </span>
                    {v.isPassword && (
                      <button type="button" onClick={() => toggleVisible(v.id)} className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]" aria-label={isVisible ? 'Hide value' : 'Show value'}>
                        {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className={cn(bodyCell, 'w-24 flex justify-center')}>
                {isEditing ? (
                  <Switch checked={editIsPassword} onCheckedChange={setEditIsPassword} aria-label="Mark as secret" />
                ) : (
                  <span className={cn('text-[10px] font-semibold uppercase', v.isPassword ? 'text-[var(--warning)]' : 'text-[var(--on-surface-variant)]')}>
                    {v.isPassword ? 'YES' : 'NO'}
                  </span>
                )}
              </div>

              <div className={cn(bodyCell, 'w-24 flex items-center justify-center gap-1.5')}>
                {isEditing ? (
                  <>
                    <button type="button" onClick={confirmEdit} className="text-[var(--success)] hover:text-[var(--success)]/80" aria-label="Confirm"><Check className="h-4 w-4" /></button>
                    <button type="button" onClick={cancelEdit} className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]" aria-label="Cancel"><X className="h-4 w-4" /></button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => startEdit(v)} className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => deleteVariable(v.id)} className="text-[var(--error)] hover:text-[var(--error)]/80" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
