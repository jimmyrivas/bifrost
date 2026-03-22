import { useTranslation } from 'react-i18next'
import { usePreferencesStore } from '@renderer/stores/preferences.store'
import { Settings, Monitor, Globe } from 'lucide-react'
import { useState } from 'react'

type SettingsTab = 'terminal' | 'language' | 'network' | 'keepass'

export function Preferences(): JSX.Element {
  const { t, i18n } = useTranslation()
  const prefs = usePreferencesStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('terminal')

  const tabs: Array<{ id: SettingsTab; label: string; icon: JSX.Element }> = [
    { id: 'terminal', label: 'Terminal', icon: <Monitor className="w-4 h-4" /> },
    { id: 'language', label: 'Language', icon: <Globe className="w-4 h-4" /> },
    { id: 'network', label: 'Network', icon: <Settings className="w-4 h-4" /> },
    { id: 'keepass', label: 'KeePass', icon: <Settings className="w-4 h-4" /> }
  ]

  return (
    <div className="flex h-full">
      <nav className="w-40 border-r border-zinc-800 p-2 space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
              activeTab === tab.id
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {activeTab === 'terminal' && (
          <>
            <h3 className="text-sm font-medium text-zinc-200">Terminal Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Font Family</label>
                <input
                  value={prefs.terminal.fontFamily}
                  onChange={(e) => prefs.setTerminalPref('fontFamily', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Font Size</label>
                <input
                  type="number"
                  value={prefs.terminal.fontSize}
                  onChange={(e) => prefs.setTerminalPref('fontSize', parseInt(e.target.value))}
                  min={8}
                  max={32}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Cursor Style</label>
                <select
                  value={prefs.terminal.cursorStyle}
                  onChange={(e) => prefs.setTerminalPref('cursorStyle', e.target.value as 'block' | 'underline' | 'bar')}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                >
                  <option value="block">Block</option>
                  <option value="underline">Underline</option>
                  <option value="bar">Bar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Scrollback</label>
                <input
                  type="number"
                  value={prefs.terminal.scrollback}
                  onChange={(e) => prefs.setTerminalPref('scrollback', parseInt(e.target.value))}
                  min={500}
                  max={100000}
                  step={500}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={prefs.terminal.cursorBlink}
                onChange={(e) => prefs.setTerminalPref('cursorBlink', e.target.checked)}
                className="rounded"
              />
              Cursor Blink
            </label>
          </>
        )}

        {activeTab === 'language' && (
          <>
            <h3 className="text-sm font-medium text-zinc-200">Language</h3>
            <select
              value={prefs.language}
              onChange={(e) => {
                const lang = e.target.value as 'en' | 'es'
                prefs.setLanguage(lang)
                i18n.changeLanguage(lang)
              }}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
            >
              <option value="en">English</option>
              <option value="es">Espa&ntilde;ol</option>
            </select>
          </>
        )}

        {activeTab === 'network' && (
          <>
            <h3 className="text-sm font-medium text-zinc-200">Global Proxy (SOCKS5)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Proxy Host</label>
                <input
                  placeholder="127.0.0.1"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Proxy Port</label>
                <input
                  type="number"
                  placeholder="1080"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'keepass' && (
          <>
            <h3 className="text-sm font-medium text-zinc-200">KeePassXC Integration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Database Path</label>
                <input
                  placeholder="/path/to/passwords.kdbx"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Key File (optional)</label>
                <input
                  placeholder="/path/to/keyfile"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                />
              </div>
              <button className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded">
                Test Connection
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
