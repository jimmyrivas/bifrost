import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Activity, Info, ListOrdered } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
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
  priority: number
}

interface ExpectEditorProps {
  rules: ExpectRule[]
  onChange: (rules: ExpectRule[]) => void
}

let ruleCounter = 0
function newRuleId(): string { return `rule-${++ruleCounter}-${Date.now()}` }

const headerCell = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] text-left'
const bodyCell = 'px-3 py-2.5 text-sm'
const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] mb-2'

const selectClass = cn(
  'flex h-8 w-full rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-2 py-1',
  'text-xs text-[var(--on-surface)] ghost-border focus-visible:outline-none [font-family:var(--font-mono)]'
)

export function ExpectEditor({ rules, onChange }: ExpectEditorProps): JSX.Element {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const addRule = useCallback(() => {
    onChange([...rules, {
      id: newRuleId(), pattern: '', sendText: '', timeout: 10,
      sendReturn: true, hideFromLog: false, onMatch: null, onFail: null, priority: rules.length
    }])
  }, [rules, onChange])

  const removeRule = useCallback((id: string) => {
    onChange(rules.filter((r) => r.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [rules, onChange, selectedId])

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
    <div className="flex flex-col gap-4 p-4">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
          <span>scripts</span>
          <span className="text-[var(--on-surface-variant)]/50">/</span>
          <span>automation</span>
          <span className="text-[var(--on-surface-variant)]/50">&gt;</span>
          <span className="text-[var(--on-surface)] font-[family-name:var(--font-mono)]">expect_editor.rules</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="spectral" size="sm" onClick={addRule}>
            <Plus className="h-3 w-3" /> {t('expect.add', 'ADD RULE')}
          </Button>
          <Switch aria-label="Enable expect engine" />
        </div>
      </div>

      {/* Rules table */}
      {rules.length === 0 ? (
        <div className="text-xs text-[var(--on-surface-variant)] text-center py-8 surface-2 rounded-[var(--radius)]">
          {t('expect.empty', 'No expect rules defined. Add a rule to get started.')}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] overflow-hidden" role="table" aria-label={t('expect.title', 'Expect Rules')}>
          <div className="surface-2 flex" role="row">
            <div className={cn(headerCell, 'w-8')} role="columnheader" />
            <div className={cn(headerCell, 'flex-1')} role="columnheader">REGEX PATTERN</div>
            <div className={cn(headerCell, 'w-36')} role="columnheader">SEND TEXT</div>
            <div className={cn(headerCell, 'w-20')} role="columnheader">TIMEOUT</div>
            <div className={cn(headerCell, 'w-28')} role="columnheader">ON MATCH</div>
            <div className={cn(headerCell, 'w-28')} role="columnheader">ON FAIL</div>
            <div className={cn(headerCell, 'w-16 text-center')} role="columnheader">PRI</div>
            <div className={cn(headerCell, 'w-20')} role="columnheader" />
          </div>
          {rules.map((rule, idx) => (
            <div
              key={rule.id} role="row"
              onClick={() => setSelectedId(rule.id)}
              className={cn(
                'flex items-center transition-colors cursor-pointer',
                idx % 2 === 0 ? 'bg-[var(--surface-container-low)]' : 'bg-[var(--surface-container-high)]',
                selectedId === rule.id && 'ring-1 ring-inset ring-[var(--outline-variant)]'
              )}
            >
              <div className={cn(bodyCell, 'w-8 flex flex-col items-center gap-0.5')}>
                <GripVertical className="h-3 w-3 text-[var(--on-surface-variant)]" />
              </div>
              <div className={cn(bodyCell, 'flex-1')}>
                <Input value={rule.pattern} onChange={(e) => updateRule(rule.id, 'pattern', e.target.value)} placeholder="regex..." className="h-7 text-xs" />
              </div>
              <div className={cn(bodyCell, 'w-36')}>
                <Input value={rule.sendText} onChange={(e) => updateRule(rule.id, 'sendText', e.target.value)} className="h-7 text-xs" type="password" />
              </div>
              <div className={cn(bodyCell, 'w-20')}>
                <Input type="number" min={1} value={rule.timeout} onChange={(e) => updateRule(rule.id, 'timeout', Number(e.target.value))} className="h-7 text-xs" />
              </div>
              <div className={cn(bodyCell, 'w-28')}>
                <select className={cn(selectClass, 'h-7 text-[10px]')} value={rule.onMatch ?? ''} onChange={(e) => updateRule(rule.id, 'onMatch', e.target.value || null)}>
                  <option value="">NONE</option>
                  {ruleOptions.filter((o) => o.value !== rule.id).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className={cn(bodyCell, 'w-28')}>
                <select className={cn(selectClass, 'h-7 text-[10px]')} value={rule.onFail ?? ''} onChange={(e) => updateRule(rule.id, 'onFail', e.target.value || null)}>
                  <option value="">NEXT RULE</option>
                  {ruleOptions.filter((o) => o.value !== rule.id).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className={cn(bodyCell, 'w-16 text-center text-xs text-[var(--on-surface-variant)]')}>{idx + 1}</div>
              <div className={cn(bodyCell, 'w-20 flex items-center gap-1')}>
                <Switch checked={rule.sendReturn} onCheckedChange={(v) => updateRule(rule.id, 'sendReturn', v)} aria-label="Toggle active" />
                <button type="button" onClick={(e) => { e.stopPropagation(); removeRule(rule.id) }} className="text-[var(--error)] hover:text-[var(--error)]/80 ml-1" aria-label="Delete rule">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom info cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className={cn('rounded-[var(--radius)] surface-2 p-3')}>
          <h4 className={sectionLabel}><Info className="inline h-3 w-3 mr-1" />RULE DETAILS</h4>
          <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed">
            {selectedId ? `Selected: ${rules.find((r) => r.id === selectedId)?.pattern || 'unnamed'}` : 'Select a rule to view details.'}
          </p>
        </div>
        <div className={cn('rounded-[var(--radius)] surface-2 p-3')}>
          <h4 className={sectionLabel}><ListOrdered className="inline h-3 w-3 mr-1" />MATCH SEQUENCE</h4>
          <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed font-[family-name:var(--font-mono)]">
            {rules.length > 0 ? `${rules.length} rules in chain` : 'No active rules'}
          </p>
        </div>
        <div className={cn('rounded-[var(--radius)] surface-2 p-3')}>
          <h4 className={sectionLabel}><Activity className="inline h-3 w-3 mr-1" />ACTIVE MONITOR</h4>
          <p className="text-xs text-[var(--success)] font-[family-name:var(--font-mono)]">Idle</p>
        </div>
      </div>
    </div>
  )
}
