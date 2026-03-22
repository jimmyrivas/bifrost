import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { cn } from '@renderer/lib/utils'

export interface Macro {
  id: string
  name: string
  command: string
  type: 'remote' | 'local'
  confirmBeforeExec: boolean
}

type MacroScope = 'global' | 'connection'

interface MacroEditorProps {
  globalMacros: Macro[]
  connectionMacros: Macro[]
  onGlobalChange: (macros: Macro[]) => void
  onConnectionChange: (macros: Macro[]) => void
}

let macroCounter = 0
function newMacroId(): string {
  return `macro-${++macroCounter}-${Date.now()}`
}

const switchClass = 'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors'
const tabClass = 'px-4 py-2 text-sm font-medium transition-colors rounded-t-md'

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }): JSX.Element {
  return (
    <button
      role="switch"
      type="button"
      aria-checked={checked}
      aria-label={label}
      className={cn(switchClass, checked ? 'bg-zinc-400' : 'bg-zinc-700')}
      onClick={() => onChange(!checked)}
    >
      <span className={cn('pointer-events-none block h-4 w-4 rounded-full bg-zinc-100 shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0')} />
    </button>
  )
}

function MacroList({ macros, onChange }: { macros: Macro[]; onChange: (m: Macro[]) => void }): JSX.Element {
  const { t } = useTranslation()

  const addMacro = (): void => {
    onChange([...macros, { id: newMacroId(), name: '', command: '', type: 'remote', confirmBeforeExec: false }])
  }

  const removeMacro = (id: string): void => {
    onChange(macros.filter((m) => m.id !== id))
  }

  const update = <K extends keyof Macro>(id: string, key: K, value: Macro[K]): void => {
    onChange(macros.map((m) => m.id === id ? { ...m, [key]: value } : m))
  }

  const move = (index: number, dir: -1 | 1): void => {
    const target = index + dir
    if (target < 0 || target >= macros.length) return
    const next = [...macros]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {macros.length === 0 && (
        <p className="text-xs text-zinc-500 text-center py-4">{t('macros.empty', 'No macros defined.')}</p>
      )}

      {macros.map((macro, idx) => (
        <div key={macro.id} className="flex gap-2 items-center p-3 bg-zinc-800/50 rounded-md border border-zinc-700/50">
          <div className="flex flex-col gap-0.5">
            <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="text-zinc-400 hover:text-zinc-200 disabled:opacity-30" aria-label={t('macros.moveUp', 'Move up')}>
              <ChevronUp className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => move(idx, 1)} disabled={idx === macros.length - 1} className="text-zinc-400 hover:text-zinc-200 disabled:opacity-30" aria-label={t('macros.moveDown', 'Move down')}>
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          <div className="flex-1 grid grid-cols-4 gap-2 items-center">
            <div>
              <Input value={macro.name} onChange={(e) => update(macro.id, 'name', e.target.value)} placeholder={t('macros.name', 'Name')} className="h-8 text-xs" aria-label={t('macros.name', 'Name')} />
            </div>
            <div className="col-span-2">
              <Input value={macro.command} onChange={(e) => update(macro.id, 'command', e.target.value)} placeholder={t('macros.command', 'Command')} className="h-8 text-xs font-mono" aria-label={t('macros.command', 'Command')} />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => update(macro.id, 'type', macro.type === 'remote' ? 'local' : 'remote')}
                className={cn('text-xs px-2 py-1 rounded border', macro.type === 'remote' ? 'border-blue-600 text-blue-400 bg-blue-950/30' : 'border-green-600 text-green-400 bg-green-950/30')}
                aria-label={t('macros.toggleType', 'Toggle type')}
              >
                {macro.type === 'remote' ? t('macros.remote', 'Remote') : t('macros.local', 'Local')}
              </button>
              <Toggle
                checked={macro.confirmBeforeExec}
                onChange={(v) => update(macro.id, 'confirmBeforeExec', v)}
                label={t('macros.confirm', 'Confirm before exec')}
              />
              <span className="text-xs text-zinc-500">{t('macros.confirm', 'Confirm')}</span>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={() => removeMacro(macro.id)} className="shrink-0 text-red-400 hover:text-red-300 h-8 w-8" aria-label={t('macros.delete', 'Delete macro')}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addMacro} className="self-start">
        <Plus className="h-3 w-3" /> {t('macros.add', 'Add Macro')}
      </Button>
    </div>
  )
}

export function MacroEditor({ globalMacros, connectionMacros, onGlobalChange, onConnectionChange }: MacroEditorProps): JSX.Element {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<MacroScope>('global')

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-100">{t('macros.title', 'Macros')}</h3>

      <div className="flex border-b border-zinc-700" role="tablist" aria-label={t('macros.scope', 'Macro scope')}>
        <button
          role="tab"
          aria-selected={activeTab === 'global'}
          className={cn(tabClass, activeTab === 'global' ? 'text-zinc-100 border-b-2 border-zinc-400' : 'text-zinc-400 hover:text-zinc-300')}
          onClick={() => setActiveTab('global')}
        >
          {t('macros.global', 'Global')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'connection'}
          className={cn(tabClass, activeTab === 'connection' ? 'text-zinc-100 border-b-2 border-zinc-400' : 'text-zinc-400 hover:text-zinc-300')}
          onClick={() => setActiveTab('connection')}
        >
          {t('macros.perConnection', 'Per-Connection')}
        </button>
      </div>

      <div role="tabpanel" aria-label={activeTab === 'global' ? t('macros.global', 'Global') : t('macros.perConnection', 'Per-Connection')}>
        {activeTab === 'global' ? (
          <MacroList macros={globalMacros} onChange={onGlobalChange} />
        ) : (
          <MacroList macros={connectionMacros} onChange={onConnectionChange} />
        )}
      </div>
    </div>
  )
}
