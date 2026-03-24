import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, Zap } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { cn } from '@renderer/lib/utils'

interface RemoteCommand {
  id: string
  connectionId?: string | null
  command: string
  description: string
  cmdGroup?: string
  confirm?: boolean
  sendIntro?: boolean
  keybinding?: string
  sortOrder?: number
}

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] mb-2'
const fieldLabel = 'text-xs text-[var(--on-surface-variant)] mb-1 block'

export function RemoteCommandsEditor(): JSX.Element {
  const [commands, setCommands] = useState<RemoteCommand[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [command, setCommand] = useState('')
  const [description, setDescription] = useState('')
  const [cmdGroup, setCmdGroup] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [sendIntro, setSendIntro] = useState(true)
  const [keybinding, setKeybinding] = useState('')
  const [scope, setScope] = useState<'global' | string>('global')
  const [saving, setSaving] = useState(false)
  const [connections, setConnections] = useState<Array<{ id: string; name: string }>>([])

  const loadCommands = useCallback(async () => {
    if (!window.bifrost?.remoteCommands) return
    const list = await window.bifrost.remoteCommands.list()
    setCommands(list)
  }, [])

  const loadConnections = useCallback(async () => {
    if (!window.bifrost?.connections) return
    const list = await window.bifrost.connections.list()
    setConnections(list.map((c) => ({ id: c.id!, name: c.name })))
  }, [])

  useEffect(() => {
    loadCommands()
    loadConnections()
  }, [loadCommands, loadConnections])

  const selectCommand = useCallback((cmd: RemoteCommand) => {
    setSelectedId(cmd.id)
    setCommand(cmd.command)
    setDescription(cmd.description)
    setCmdGroup(cmd.cmdGroup ?? '')
    setConfirm(cmd.confirm ?? false)
    setSendIntro(cmd.sendIntro ?? true)
    setKeybinding(cmd.keybinding ?? '')
    setScope(cmd.connectionId ?? 'global')
  }, [])

  const handleNew = useCallback(() => {
    setSelectedId(null)
    setCommand('')
    setDescription('')
    setCmdGroup('')
    setConfirm(false)
    setSendIntro(true)
    setKeybinding('')
    setScope('global')
  }, [])

  const handleSave = useCallback(async () => {
    if (!window.bifrost?.remoteCommands || !command.trim()) return
    setSaving(true)
    try {
      const data = {
        command,
        description: description || command,
        cmdGroup,
        confirm,
        sendIntro,
        keybinding,
        connectionId: scope === 'global' ? null : scope
      }
      if (selectedId) {
        await window.bifrost.remoteCommands.update(selectedId, data)
      } else {
        const id = await window.bifrost.remoteCommands.create(data as RemoteCommand)
        setSelectedId(id)
      }
      await loadCommands()
    } finally {
      setSaving(false)
    }
  }, [selectedId, command, description, cmdGroup, confirm, sendIntro, keybinding, scope, loadCommands])

  const handleDelete = useCallback(async () => {
    if (!window.bifrost?.remoteCommands || !selectedId) return
    await window.bifrost.remoteCommands.delete(selectedId)
    handleNew()
    await loadCommands()
  }, [selectedId, loadCommands, handleNew])

  // Group commands for display
  const globalCmds = commands.filter((c) => !c.connectionId)
  const connCmds = commands.filter((c) => c.connectionId)

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-[var(--on-surface)]">Remote Commands</h2>
          <p className={sectionLabel}>ASBRU-STYLE REMOTE EXECUTION</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleNew}>
          <Plus className="h-3 w-3" /> NEW
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Command list */}
        <div className="w-52 shrink-0 surface-2 rounded-[var(--radius)] p-2 overflow-y-auto flex flex-col gap-0.5">
          {globalCmds.length > 0 && (
            <>
              <p className={cn(sectionLabel, 'px-2')}>GLOBAL</p>
              {globalCmds.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => selectCommand(cmd)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-[var(--radius)] transition-colors text-xs',
                    selectedId === cmd.id
                      ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                      : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/50'
                  )}
                >
                  <Zap className="h-3 w-3 shrink-0" />
                  <div className="min-w-0">
                    <span className="truncate block">{cmd.description || cmd.command}</span>
                    {cmd.cmdGroup && (
                      <span className="text-[9px] text-[var(--on-surface-variant)]/50 truncate block">{cmd.cmdGroup}</span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
          {connCmds.length > 0 && (
            <>
              <p className={cn(sectionLabel, 'px-2 mt-2')}>PER-CONNECTION</p>
              {connCmds.map((cmd) => {
                const conn = connections.find((c) => c.id === cmd.connectionId)
                return (
                  <button
                    key={cmd.id}
                    onClick={() => selectCommand(cmd)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-[var(--radius)] transition-colors text-xs',
                      selectedId === cmd.id
                        ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                        : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/50'
                    )}
                  >
                    <Zap className="h-3 w-3 shrink-0" />
                    <div className="min-w-0">
                      <span className="truncate block">{cmd.description || cmd.command}</span>
                      <span className="text-[9px] text-[var(--on-surface-variant)]/50 truncate block">
                        {conn?.name ?? cmd.connectionId}
                      </span>
                    </div>
                  </button>
                )
              })}
            </>
          )}
          {commands.length === 0 && (
            <p className="text-xs text-[var(--on-surface-variant)] px-2 py-4 text-center">No commands yet</p>
          )}
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="col-span-2">
              <label className={fieldLabel} htmlFor="rc-command">COMMAND</label>
              <Input
                id="rc-command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="systemctl status nginx"
                className="font-[family-name:var(--font-mono)] text-xs"
              />
              <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
                Supports variables: &lt;USER&gt; &lt;IP&gt; &lt;PORT&gt; &lt;NAME&gt; &lt;ENV:name&gt; &lt;GV:name&gt;
              </span>
            </div>
            <div>
              <label className={fieldLabel} htmlFor="rc-desc">DESCRIPTION</label>
              <Input
                id="rc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Check nginx status"
              />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="rc-group">GROUP</label>
              <Input
                id="rc-group"
                value={cmdGroup}
                onChange={(e) => setCmdGroup(e.target.value)}
                placeholder="Monitoring"
              />
              <span className="text-[9px] text-[var(--on-surface-variant)] mt-0.5 block">
                Commands with the same group appear in a submenu
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div>
              <label className={fieldLabel} htmlFor="rc-scope">SCOPE</label>
              <select
                id="rc-scope"
                className={cn(
                  'flex h-9 w-full rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-3 py-1',
                  'text-sm text-[var(--on-surface)] ghost-border focus-visible:outline-none'
                )}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="global">Global (all connections)</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={fieldLabel} htmlFor="rc-keybinding">KEYBINDING</label>
              <Input
                id="rc-keybinding"
                value={keybinding}
                onChange={(e) => setKeybinding(e.target.value)}
                placeholder="Ctrl+Shift+1"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0 py-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={confirm} onCheckedChange={setConfirm} />
              <span className="text-xs text-[var(--on-surface-variant)]">Confirm before execute</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={sendIntro} onCheckedChange={setSendIntro} />
              <span className="text-xs text-[var(--on-surface-variant)]">Send INTRO (newline) at end</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="spectral" size="sm" onClick={handleSave} disabled={saving || !command.trim()}>
              <Save className="h-3 w-3" /> {saving ? 'SAVING...' : 'SAVE'}
            </Button>
            {selectedId && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="ml-auto text-[var(--error)]">
                <Trash2 className="h-3 w-3" /> DELETE
              </Button>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 min-h-0 rounded-[var(--radius)] bg-[var(--surface-container-lowest)] p-4 overflow-y-auto">
            <p className={cn(sectionLabel, 'mb-3')}>CONTEXT MENU PREVIEW</p>
            {commands.length === 0 ? (
              <p className="text-xs text-[var(--on-surface-variant)]">
                Commands will appear in the terminal right-click menu under &quot;Remote Commands&quot;.
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {(() => {
                  const grouped = new Map<string, RemoteCommand[]>()
                  const ungrouped: RemoteCommand[] = []
                  for (const cmd of commands) {
                    const g = cmd.cmdGroup?.trim()
                    if (g) {
                      const list = grouped.get(g) ?? []
                      list.push(cmd)
                      grouped.set(g, list)
                    } else {
                      ungrouped.push(cmd)
                    }
                  }
                  const items: JSX.Element[] = []
                  for (const [group, cmds] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
                    items.push(
                      <div key={`g-${group}`} className="mb-2">
                        <p className="text-[10px] font-semibold text-[#6bd5ff] mb-0.5">{group} &rsaquo;</p>
                        {cmds.map((cmd) => (
                          <div
                            key={cmd.id}
                            className={cn(
                              'flex items-center gap-2 pl-3 py-0.5 text-xs rounded-[var(--radius)] cursor-pointer',
                              selectedId === cmd.id ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]' : 'text-[var(--on-surface-variant)]'
                            )}
                            onClick={() => selectCommand(cmd)}
                          >
                            <Zap size={10} strokeWidth={1.5} />
                            <span className="truncate">{cmd.description || cmd.command}</span>
                            {cmd.confirm && <span className="text-[9px] text-[var(--warning)]">confirm</span>}
                            {cmd.keybinding && <span className="ml-auto text-[9px] text-[var(--on-surface-variant)]/40">{cmd.keybinding}</span>}
                          </div>
                        ))}
                      </div>
                    )
                  }
                  for (const cmd of ungrouped) {
                    items.push(
                      <div
                        key={cmd.id}
                        className={cn(
                          'flex items-center gap-2 py-0.5 text-xs rounded-[var(--radius)] cursor-pointer',
                          selectedId === cmd.id ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]' : 'text-[var(--on-surface-variant)]'
                        )}
                        onClick={() => selectCommand(cmd)}
                      >
                        <Zap size={10} strokeWidth={1.5} />
                        <span className="truncate">{cmd.description || cmd.command}</span>
                        {cmd.confirm && <span className="text-[9px] text-[var(--warning)]">confirm</span>}
                        {cmd.keybinding && <span className="ml-auto text-[9px] text-[var(--on-surface-variant)]/40">{cmd.keybinding}</span>}
                      </div>
                    )
                  }
                  return items
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
