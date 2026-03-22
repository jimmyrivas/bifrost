import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Eye, EyeOff, Pencil, Check, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
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
function newVarId(): string {
  return `var-${++varCounter}-${Date.now()}`
}

const checkClass = 'h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-zinc-400'
const cellClass = 'px-3 py-2 text-sm text-zinc-300'
const headerClass = 'px-3 py-2 text-xs font-medium text-zinc-400 text-left'

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
      if (v && !v.name && !v.value) {
        onChange(variables.filter((x) => x.id !== editingId))
      }
    }
    setEditingId(null)
  }, [editingId, variables, onChange])

  const toggleVisible = useCallback((id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">{t('variables.title', 'Global Variables')}</h3>
        <Button variant="outline" size="sm" onClick={addVariable}>
          <Plus className="h-3 w-3" /> {t('variables.add', 'Add Variable')}
        </Button>
      </div>

      <div className="border border-zinc-700 rounded-md overflow-hidden">
        <table className="w-full" role="grid" aria-label={t('variables.title', 'Global Variables')}>
          <thead className="bg-zinc-800/50">
            <tr>
              <th className={headerClass}>{t('variables.name', 'Name')}</th>
              <th className={headerClass}>{t('variables.value', 'Value')}</th>
              <th className={cn(headerClass, 'w-24 text-center')}>{t('variables.password', 'Password')}</th>
              <th className={cn(headerClass, 'w-24 text-center')}>{t('variables.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {variables.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-xs text-zinc-500 py-6">
                  {t('variables.empty', 'No variables defined.')}
                </td>
              </tr>
            )}
            {variables.map((v) => {
              const isEditing = editingId === v.id
              const isVisible = visibleIds.has(v.id)

              return (
                <tr key={v.id} className="border-t border-zinc-700/50 hover:bg-zinc-800/30">
                  <td className={cellClass}>
                    {isEditing ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-xs"
                        placeholder={t('variables.namePlaceholder', 'VARIABLE_NAME')}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit() }}
                        aria-label={t('variables.name', 'Name')}
                      />
                    ) : (
                      <span className="font-mono text-xs">{v.name}</span>
                    )}
                  </td>
                  <td className={cellClass}>
                    {isEditing ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        type={editIsPassword ? 'password' : 'text'}
                        className="h-7 text-xs"
                        onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit() }}
                        aria-label={t('variables.value', 'Value')}
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">
                          {v.isPassword && !isVisible ? '********' : v.value}
                        </span>
                        {v.isPassword && (
                          <button type="button" onClick={() => toggleVisible(v.id)} className="text-zinc-400 hover:text-zinc-200" aria-label={isVisible ? 'Hide value' : 'Show value'}>
                            {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={cn(cellClass, 'text-center')}>
                    {isEditing ? (
                      <input
                        type="checkbox"
                        className={checkClass}
                        checked={editIsPassword}
                        onChange={(e) => setEditIsPassword(e.target.checked)}
                        aria-label={t('variables.togglePassword', 'Mark as password')}
                      />
                    ) : (
                      <span className="text-xs">{v.isPassword ? t('variables.yes', 'Yes') : t('variables.no', 'No')}</span>
                    )}
                  </td>
                  <td className={cn(cellClass, 'text-center')}>
                    <div className="flex items-center justify-center gap-1">
                      {isEditing ? (
                        <>
                          <button type="button" onClick={confirmEdit} className="text-green-400 hover:text-green-300" aria-label={t('common.confirm', 'Confirm')}>
                            <Check className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={cancelEdit} className="text-zinc-400 hover:text-zinc-200" aria-label={t('common.cancel', 'Cancel')}>
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(v)} className="text-zinc-400 hover:text-zinc-200" aria-label={t('common.edit', 'Edit')}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => deleteVariable(v.id)} className="text-red-400 hover:text-red-300" aria-label={t('common.delete', 'Delete')}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
