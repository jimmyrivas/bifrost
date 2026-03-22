import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { cn } from '@renderer/lib/utils'

export interface ExpectRule {
  id: string
  pattern: string
  sendText: string
  timeout: number
  sendReturn: boolean
  hideFromLog: boolean
  onMatch: string | null
  onFail: string | null
}

interface ExpectEditorProps {
  rules: ExpectRule[]
  onChange: (rules: ExpectRule[]) => void
}

let ruleCounter = 0
function newRuleId(): string {
  return `rule-${++ruleCounter}-${Date.now()}`
}

const selectClass = 'flex h-8 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400'
const switchClass = 'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors'

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

export function ExpectEditor({ rules, onChange }: ExpectEditorProps): JSX.Element {
  const { t } = useTranslation()

  const addRule = useCallback(() => {
    onChange([...rules, {
      id: newRuleId(), pattern: '', sendText: '', timeout: 10,
      sendReturn: true, hideFromLog: false, onMatch: null, onFail: null
    }])
  }, [rules, onChange])

  const removeRule = useCallback((id: string) => {
    onChange(rules.filter((r) => r.id !== id))
  }, [rules, onChange])

  const updateRule = useCallback(<K extends keyof ExpectRule>(id: string, key: K, value: ExpectRule[K]) => {
    onChange(rules.map((r) => r.id === id ? { ...r, [key]: value } : r))
  }, [rules, onChange])

  const moveRule = useCallback((index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rules.length) return
    const next = [...rules]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }, [rules, onChange])

  const ruleOptions = rules.map((r) => ({ value: r.id, label: r.pattern || r.id }))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">{t('expect.title', 'Expect Rules')}</h3>
        <Button variant="outline" size="sm" onClick={addRule}>
          <Plus className="h-3 w-3" /> {t('expect.add', 'Add Rule')}
        </Button>
      </div>

      {rules.length === 0 && (
        <p className="text-xs text-zinc-500 text-center py-4">{t('expect.empty', 'No expect rules defined.')}</p>
      )}

      <div className="flex flex-col gap-2" role="list" aria-label={t('expect.title', 'Expect Rules')}>
        {rules.map((rule, idx) => (
          <div key={rule.id} role="listitem" className="flex gap-2 items-start p-3 bg-zinc-800/50 rounded-md border border-zinc-700/50">
            <div className="flex flex-col gap-1 pt-1" aria-label={t('expect.reorder', 'Reorder')}>
              <GripVertical className="h-4 w-4 text-zinc-500" />
              <button type="button" onClick={() => moveRule(idx, -1)} disabled={idx === 0} className="text-zinc-400 hover:text-zinc-200 disabled:opacity-30" aria-label={t('expect.moveUp', 'Move up')}>
                <ChevronUp className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => moveRule(idx, 1)} disabled={idx === rules.length - 1} className="text-zinc-400 hover:text-zinc-200 disabled:opacity-30" aria-label={t('expect.moveDown', 'Move down')}>
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            <div className="flex-1 grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">{t('expect.pattern', 'Pattern')}</Label>
                <Input value={rule.pattern} onChange={(e) => updateRule(rule.id, 'pattern', e.target.value)} placeholder="regex..." className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">{t('expect.sendText', 'Send Text')}</Label>
                <Input value={rule.sendText} onChange={(e) => updateRule(rule.id, 'sendText', e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">{t('expect.timeout', 'Timeout (s)')}</Label>
                <Input type="number" min={1} value={rule.timeout} onChange={(e) => updateRule(rule.id, 'timeout', Number(e.target.value))} className="h-8 text-xs" />
              </div>

              <div className="flex items-center gap-3">
                <Label className="text-xs">{t('expect.sendReturn', 'Send Return')}</Label>
                <Toggle checked={rule.sendReturn} onChange={(v) => updateRule(rule.id, 'sendReturn', v)} label={t('expect.sendReturn', 'Send Return')} />
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs">{t('expect.hideLog', 'Hide from Log')}</Label>
                <Toggle checked={rule.hideFromLog} onChange={(v) => updateRule(rule.id, 'hideFromLog', v)} label={t('expect.hideLog', 'Hide from Log')} />
              </div>

              <div className="grid grid-cols-2 gap-2 col-span-3">
                <div>
                  <Label className="text-xs">{t('expect.onMatch', 'On Match')}</Label>
                  <select className={selectClass} value={rule.onMatch ?? ''} onChange={(e) => updateRule(rule.id, 'onMatch', e.target.value || null)}>
                    <option value="">{t('expect.none', '-- None --')}</option>
                    {ruleOptions.filter((o) => o.value !== rule.id).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">{t('expect.onFail', 'On Fail')}</Label>
                  <select className={selectClass} value={rule.onFail ?? ''} onChange={(e) => updateRule(rule.id, 'onFail', e.target.value || null)}>
                    <option value="">{t('expect.none', '-- None --')}</option>
                    {ruleOptions.filter((o) => o.value !== rule.id).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={() => removeRule(rule.id)} className="shrink-0 text-red-400 hover:text-red-300 h-8 w-8" aria-label={t('expect.delete', 'Delete rule')}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
