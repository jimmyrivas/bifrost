/**
 * Plugin Manager UI.
 * Lists installed plugins with enable/disable toggle, install, and uninstall.
 */

import { useState, useEffect, useCallback } from 'react'
import { Package, Trash2, Plus, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

interface PluginInfo {
  name: string
  version: string
  description: string
  path: string
  valid: boolean
  enabled: boolean
}

const sectionCard = 'rounded-[var(--radius)] bg-[var(--surface-container-high)] p-4'
const fieldLabel = 'text-xs text-[var(--on-surface-variant)] mb-1 block'

export function PluginManager(): JSX.Element {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [packageName, setPackageName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshPlugins = useCallback(async () => {
    if (!window.bifrost?.plugins) return
    try {
      const list = await window.bifrost.plugins.list()
      setPlugins(list)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { refreshPlugins() }, [refreshPlugins])

  const handleInstall = useCallback(async () => {
    const name = packageName.trim()
    if (!name || !window.bifrost?.plugins) return
    setLoading(true)
    setError(null)
    try {
      await window.bifrost.plugins.install(name)
      setPackageName('')
      await refreshPlugins()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed')
    } finally {
      setLoading(false)
    }
  }, [packageName, refreshPlugins])

  const handleUninstall = useCallback(async (pluginName: string) => {
    if (!window.bifrost?.plugins) return
    if (!window.confirm(`Uninstall "${pluginName}"?`)) return
    setLoading(true)
    try {
      await window.bifrost.plugins.uninstall(pluginName)
      await refreshPlugins()
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [refreshPlugins])

  const handleToggle = useCallback(async (pluginName: string, currentlyEnabled: boolean) => {
    if (!window.bifrost?.plugins) return
    try {
      if (currentlyEnabled) {
        await window.bifrost.plugins.disable(pluginName)
      } else {
        await window.bifrost.plugins.enable(pluginName)
      }
      await refreshPlugins()
    } catch { /* ignore */ }
  }, [refreshPlugins])

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <h3 className="text-sm font-semibold text-[var(--on-surface)]">Plugins</h3>

      {/* Install section */}
      <div className={sectionCard}>
        <label className={fieldLabel}>INSTALL PLUGIN</label>
        <div className="flex gap-2">
          <Input
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            placeholder="npm package name or local path"
            onKeyDown={(e) => { if (e.key === 'Enter') handleInstall() }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstall}
            disabled={loading || !packageName.trim()}
            className="shrink-0"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Install
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-[var(--error)]">{error}</p>}
        <p className="mt-2 text-[9px] text-[var(--on-surface-variant)]/50">
          Plugins require restart after install/enable/disable to take effect.
        </p>
      </div>

      {/* Plugin list */}
      <div className={sectionCard}>
        <label className={fieldLabel}>INSTALLED PLUGINS</label>
        {plugins.length === 0 ? (
          <p className="text-xs text-[var(--on-surface-variant)]/60 py-4 text-center">
            No plugins installed
          </p>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            {plugins.map((plugin) => (
              <div
                key={plugin.name}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)]',
                  plugin.enabled
                    ? 'bg-[var(--surface-container-low)]'
                    : 'bg-[var(--surface-container-low)]/50 opacity-60'
                )}
              >
                <Package className={cn('h-4 w-4 shrink-0', plugin.enabled ? 'text-[#6bd5ff]' : 'text-[var(--on-surface-variant)]')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--on-surface)] truncate">
                      {plugin.name}
                    </span>
                    <span className="text-[10px] text-[var(--on-surface-variant)] font-mono">
                      v{plugin.version}
                    </span>
                    {!plugin.valid && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--error)]/15 text-[var(--error)]">
                        INVALID
                      </span>
                    )}
                    {plugin.valid && !plugin.enabled && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#c7c4d7]/10 text-[#c7c4d7]/50">
                        DISABLED
                      </span>
                    )}
                    {plugin.valid && plugin.enabled && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e]">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  {plugin.description && (
                    <p className="text-[10px] text-[var(--on-surface-variant)] truncate mt-0.5">
                      {plugin.description}
                    </p>
                  )}
                </div>
                {/* Enable/disable toggle */}
                {plugin.valid && (
                  <button
                    type="button"
                    onClick={() => handleToggle(plugin.name, plugin.enabled)}
                    className="p-1 shrink-0 transition-colors"
                    aria-label={plugin.enabled ? `Disable ${plugin.name}` : `Enable ${plugin.name}`}
                    title={plugin.enabled ? 'Disable (requires restart)' : 'Enable (requires restart)'}
                  >
                    {plugin.enabled
                      ? <ToggleRight size={20} className="text-[#22c55e]" />
                      : <ToggleLeft size={20} className="text-[#c7c4d7]/30" />
                    }
                  </button>
                )}
                {/* Uninstall */}
                <button
                  type="button"
                  onClick={() => handleUninstall(plugin.name)}
                  disabled={loading}
                  className="p-1.5 text-[var(--on-surface-variant)] hover:text-[var(--error)] transition-colors shrink-0"
                  aria-label={`Uninstall ${plugin.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
