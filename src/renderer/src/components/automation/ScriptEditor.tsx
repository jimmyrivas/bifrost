import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Play, Save, FileCode, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

interface BifrostScript {
  id: string
  name: string
  description: string
  code: string
  createdAt: string
  updatedAt: string
}

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] mb-2'
const fieldLabel = 'text-xs text-[var(--on-surface-variant)] mb-1 block'

export function ScriptEditor(): JSX.Element {
  const { t } = useTranslation()
  const [scripts, setScripts] = useState<BifrostScript[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [validationResult, setValidationResult] = useState<string | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  const loadScripts = useCallback(async () => {
    if (!window.bifrost?.scripts) return
    const list = await window.bifrost.scripts.list()
    setScripts(list)
  }, [])

  useEffect(() => { loadScripts() }, [loadScripts])

  const selectScript = useCallback((script: BifrostScript) => {
    setSelectedId(script.id)
    setName(script.name)
    setDescription(script.description)
    setCode(script.code)
    setOutput([])
    setValidationResult(undefined)
  }, [])

  const handleNew = useCallback(() => {
    setSelectedId(null)
    setName('')
    setDescription('')
    setCode('// New script\nasync function run(ctx) {\n  ctx.send("echo hello\\n");\n  await ctx.sleep(1000);\n  ctx.log("Done");\n}\n')
    setOutput([])
    setValidationResult(undefined)
  }, [])

  const handleSave = useCallback(async () => {
    if (!window.bifrost?.scripts || !name.trim()) return
    setSaving(true)
    try {
      if (selectedId) {
        await window.bifrost.scripts.update(selectedId, { name, description, code })
      } else {
        const saved = await window.bifrost.scripts.save({ name, description, code })
        setSelectedId(saved.id)
      }
      await loadScripts()
      setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Script saved.`])
    } finally {
      setSaving(false)
    }
  }, [selectedId, name, description, code, loadScripts])

  const handleDelete = useCallback(async () => {
    if (!window.bifrost?.scripts || !selectedId) return
    await window.bifrost.scripts.delete(selectedId)
    setSelectedId(null)
    setName('')
    setDescription('')
    setCode('')
    await loadScripts()
  }, [selectedId, loadScripts])

  const handleValidate = useCallback(async () => {
    if (!window.bifrost?.scripts) return
    const result = await window.bifrost.scripts.validate(code)
    setValidationResult(result)
    if (result) {
      setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Validation error: ${result}`])
    } else {
      setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Syntax valid.`])
    }
  }, [code])

  const handleRun = useCallback(() => {
    setOutput((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Running "${name}"...`,
      `[${new Date().toLocaleTimeString()}] Script execution is handled via terminal context.`
    ])
  }, [name])

  const lineCount = code.split('\n').length

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-[var(--on-surface)]">{t('scripts.title', 'Script Editor')}</h2>
          <p className={sectionLabel}>AUTOMATION SCRIPTS</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleNew}>
            <Plus className="h-3 w-3" /> NEW
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Script list */}
        <div className="w-48 shrink-0 surface-2 rounded-[var(--radius)] p-2 overflow-y-auto flex flex-col gap-0.5">
          <p className={cn(sectionLabel, 'px-2')}>SAVED SCRIPTS</p>
          {scripts.length === 0 ? (
            <p className="text-xs text-[var(--on-surface-variant)] px-2 py-4 text-center">No scripts yet</p>
          ) : scripts.map((s) => (
            <button
              key={s.id}
              onClick={() => selectScript(s)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-[var(--radius)] transition-colors text-xs',
                selectedId === s.id
                  ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                  : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/50'
              )}
            >
              <FileCode className="h-3 w-3 shrink-0" />
              <span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Name / description */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div>
              <label className={fieldLabel} htmlFor="script-name">SCRIPT NAME</label>
              <Input id="script-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Script" />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="script-desc">DESCRIPTION</label>
              <Input id="script-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this script does" />
            </div>
          </div>

          {/* Code editor with line numbers */}
          <div className="flex-1 min-h-0 rounded-[var(--radius)] bg-[var(--surface-container-lowest)] overflow-hidden flex">
            <div className="py-2 px-2 text-right select-none shrink-0 bg-[var(--surface-container-low)]" aria-hidden="true">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="text-[10px] leading-[1.6rem] text-[var(--on-surface-variant)]/40 font-[family-name:var(--font-mono)]">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={code}
              onChange={(e) => { setCode(e.target.value); setValidationResult(undefined) }}
              className={cn(
                'flex-1 bg-transparent text-xs text-[var(--on-surface)] p-2 resize-none outline-none',
                'font-[family-name:var(--font-mono)] leading-[1.6rem] whitespace-pre overflow-auto'
              )}
              spellCheck={false}
              aria-label="Script code"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <select className="h-8 rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-2 text-[10px] text-[var(--on-surface)] ghost-border">
              <option value="active">Active Terminal</option>
              <option value="all">All Tabs</option>
            </select>
            <Button variant="spectral" size="sm" onClick={handleRun} disabled={!code.trim()}>
              <Play className="h-3 w-3" /> RUN
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
              <Save className="h-3 w-3" /> {saving ? 'SAVING...' : 'SAVE'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleValidate} disabled={!code.trim()}>
              {validationResult === null ? (
                <CheckCircle className="h-3 w-3 text-[var(--success)]" />
              ) : validationResult ? (
                <AlertCircle className="h-3 w-3 text-[var(--error)]" />
              ) : null}
              VALIDATE
            </Button>
            {selectedId && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="ml-auto text-[var(--error)]">
                <Trash2 className="h-3 w-3" /> DELETE
              </Button>
            )}
          </div>

          {/* Output log */}
          <div
            ref={outputRef}
            className="h-24 shrink-0 rounded-[var(--radius)] bg-[var(--surface-container-lowest)] p-2 overflow-y-auto"
          >
            <p className={cn(sectionLabel, 'mb-1')}>OUTPUT</p>
            {output.length === 0 ? (
              <p className="text-xs text-[var(--on-surface-variant)] font-[family-name:var(--font-mono)]">No output yet</p>
            ) : output.map((line, i) => (
              <div key={i} className="text-[10px] text-[var(--on-surface)] font-[family-name:var(--font-mono)] leading-relaxed">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
