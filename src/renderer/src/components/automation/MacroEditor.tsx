import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
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
function newMacroId(): string { return `macro-${++macroCounter}-${Date.now()}` }

const headerCell = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] text-left'
const bodyCell = 'px-3 py-2.5'

function MacroList({ macros, onChange }: { macros: Macro[]; onChange: (m: Macro[]) => void }): JSX.Element {
  const { t } = useTranslation()

  const addMacro = (): void => {
    onChange([...macros, { id: newMacroId(), name: '', command: '', type: 'remote', confirmBeforeExec: false }])
  }

  const removeMacro = (id: string): void => { onChange(macros.filter((m) => m.id !== id)) }

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
    <div className="flex flex-col gap-3">
      {macros.length === 0 ? (
        <p className="text-xs text-[var(--on-surface-variant)] text-center py-6">{t('macros.empty', 'No macros defined.')}</p>
      ) : (
        <div className="rounded-[var(--radius)] overflow-hidden" role="table" aria-label="Macros">
          <div className="surface-2 flex" role="row">
            <div className={cn(headerCell, 'w-8')} role="columnheader" />
            <div className={cn(headerCell, 'w-40')} role="columnheader">NAME</div>
            <div className={cn(headerCell, 'flex-1')} role="columnheader">COMMAND</div>
            <div className={cn(headerCell, 'w-24 text-center')} role="columnheader">TYPE</div>
            <div className={cn(headerCell, 'w-24 text-center')} role="columnheader">CONFIRM</div>
            <div className={cn(headerCell, 'w-12')} role="columnheader" />
          </div>
          {macros.map((macro, idx) => (
            <div
              key={macro.id} role="row"
              className={cn(
                'flex items-center transition-colors',
                idx % 2 === 0 ? 'bg-[var(--surface-container-low)]' : 'bg-[var(--surface-container-high)]'
              )}
            >
              <div className={cn(bodyCell, 'w-8 flex flex-col items-center gap-0.5')}>
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] disabled:opacity-30" aria-label="Move up">
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => move(idx, 1)} disabled={idx === macros.length - 1} className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] disabled:opacity-30" aria-label="Move down">
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <div className={cn(bodyCell, 'w-40')}>
                <Input value={macro.name} onChange={(e) => update(macro.id, 'name', e.target.value)} placeholder="Name" className="h-7 text-xs" aria-label="Macro name" />
              </div>
              <div className={cn(bodyCell, 'flex-1')}>
                <Input value={macro.command} onChange={(e) => update(macro.id, 'command', e.target.value)} placeholder="Command" className="h-7 text-xs font-[family-name:var(--font-mono)]" aria-label="Command" />
              </div>
              <div className={cn(bodyCell, 'w-24 text-center')}>
                <button
                  type="button"
                  onClick={() => update(macro.id, 'type', macro.type === 'remote' ? 'local' : 'remote')}
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-[var(--radius)] transition-colors',
                    macro.type === 'remote'
                      ? 'bg-[var(--surface-container-highest)] text-[#6bd5ff]'
                      : 'bg-[var(--surface-container-highest)] text-[var(--success)]'
                  )}
                  aria-label="Toggle type"
                >
                  {macro.type === 'remote' ? 'REMOTE' : 'LOCAL'}
                </button>
              </div>
              <div className={cn(bodyCell, 'w-24 flex justify-center')}>
                <Switch checked={macro.confirmBeforeExec} onCheckedChange={(v) => update(macro.id, 'confirmBeforeExec', v)} aria-label="Confirm before exec" />
              </div>
              <div className={cn(bodyCell, 'w-12 flex justify-center')}>
                <button type="button" onClick={() => removeMacro(macro.id)} className="text-[var(--error)] hover:text-[var(--error)]/80" aria-label="Delete macro">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="spectral" size="sm" onClick={addMacro} className="self-start">
        <Plus className="h-3 w-3" /> {t('macros.add', 'ADD MACRO')}
      </Button>
    </div>
  )
}

export function MacroEditor({ globalMacros, connectionMacros, onGlobalChange, onConnectionChange }: MacroEditorProps): JSX.Element {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<MacroScope>('global')

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-[var(--on-surface)]">{t('macros.title', 'Macros')}</h3>

      <div className="flex gap-1" role="tablist" aria-label={t('macros.scope', 'Macro scope')}>
        {(['global', 'connection'] as const).map((tab) => (
          <button
            key={tab} role="tab" aria-selected={activeTab === tab}
            className={cn(
              'px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-[var(--radius)] transition-colors',
              activeTab === tab
                ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/50'
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'global' ? t('macros.global', 'Global') : t('macros.perConnection', 'Per-Connection')}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={activeTab}>
        {activeTab === 'global'
          ? <MacroList macros={globalMacros} onChange={onGlobalChange} />
          : <MacroList macros={connectionMacros} onChange={onConnectionChange} />
        }
      </div>
    </div>
  )
}
