import { useState, useCallback } from 'react'
import { X, Variable, Globe, Key, MessageSquare, Terminal } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface VariableWizardProps {
  open: boolean
  onClose: () => void
  onInsert: (variable: string) => void
}

interface VariableCategory {
  id: string
  label: string
  icon: typeof Variable
  items: Array<{ token: string; description: string; preview?: string }>
}

const CATEGORIES: VariableCategory[] = [
  {
    id: 'internal',
    label: 'Internal',
    icon: Variable,
    items: [
      { token: '<IP>', description: 'Connection host/IP address', preview: '10.0.0.1' },
      { token: '<PORT>', description: 'Connection port number', preview: '22' },
      { token: '<USER>', description: 'Connection username', preview: 'admin' },
      { token: '<PASS>', description: 'Connection password', preview: '****' },
      { token: '<NAME>', description: 'Connection name', preview: 'My Server' },
      { token: '<ID>', description: 'Connection UUID', preview: 'a1b2c3d4...' },
      { token: '<TIMESTAMP>', description: 'Current timestamp', preview: new Date().toISOString() },
      { token: '<DATE>', description: 'Current date (YYYY-MM-DD)', preview: new Date().toISOString().split('T')[0] },
      { token: '<TIME>', description: 'Current time (HH:MM:SS)', preview: new Date().toTimeString().split(' ')[0] },
      { token: '<HOSTNAME>', description: 'Local hostname', preview: 'bifrost-client' }
    ]
  },
  {
    id: 'environment',
    label: 'Environment',
    icon: Globe,
    items: [
      { token: '<ENV:HOME>', description: 'Home directory', preview: '/home/user' },
      { token: '<ENV:USER>', description: 'Current system user', preview: 'user' },
      { token: '<ENV:SHELL>', description: 'Default shell', preview: '/bin/bash' },
      { token: '<ENV:PATH>', description: 'System PATH', preview: '/usr/bin:...' },
      { token: '<ENV:TERM>', description: 'Terminal type', preview: 'xterm-256color' },
      { token: '<ENV:LANG>', description: 'Language setting', preview: 'en_US.UTF-8' },
      { token: '<ENV:>', description: 'Custom env variable (type name)', preview: '' }
    ]
  },
  {
    id: 'global',
    label: 'Global Variables',
    icon: Key,
    items: [
      { token: '<GV:ssh_key_path>', description: 'Global SSH key path' },
      { token: '<GV:default_user>', description: 'Default username' },
      { token: '<GV:proxy_host>', description: 'Default proxy host' },
      { token: '<GV:>', description: 'Custom global variable (type name)', preview: '' }
    ]
  },
  {
    id: 'ask',
    label: 'Prompts',
    icon: MessageSquare,
    items: [
      { token: '<ASK:password>', description: 'Prompt for password (masked)', preview: '[prompt]' },
      { token: '<ASK:username>', description: 'Prompt for username', preview: '[prompt]' },
      { token: '<ASK:otp>', description: 'Prompt for OTP code', preview: '[prompt]' },
      { token: '<ASK:>', description: 'Custom prompt (type label)', preview: '[prompt]' }
    ]
  },
  {
    id: 'command',
    label: 'Commands',
    icon: Terminal,
    items: [
      { token: '<CMD:hostname>', description: 'Run hostname locally', preview: 'result' },
      { token: '<CMD:whoami>', description: 'Run whoami locally', preview: 'user' },
      { token: '<CMD:date +%s>', description: 'Unix timestamp', preview: '1711107200' },
      { token: '<CMD:>', description: 'Custom command (type command)', preview: 'result' }
    ]
  }
]

export function VariableWizard({ open, onClose, onInsert }: VariableWizardProps): JSX.Element | null {
  const [activeCategory, setActiveCategory] = useState('internal')

  const handleInsert = useCallback(
    (token: string) => {
      onInsert(token)
      onClose()
    },
    [onInsert, onClose]
  )

  if (!open) return null

  const category = CATEGORIES.find((c) => c.id === activeCategory)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0d0f]/60 backdrop-blur-[12px]"
      onClick={onClose}
      role="dialog"
      aria-label="Variable substitution wizard"
    >
      <div
        className="bg-[var(--surface-container-low)] rounded-[var(--radius)] w-[520px] max-h-[420px] flex overflow-hidden shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Category sidebar */}
        <nav className="w-40 shrink-0 bg-[var(--surface)] p-2 flex flex-col gap-0.5" role="tablist">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={activeCategory === cat.id}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-2 text-xs rounded-[var(--radius)] transition-colors text-left',
                  activeCategory === cat.id
                    ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/50'
                )}
                onClick={() => setActiveCategory(cat.id)}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            )
          })}
        </nav>

        {/* Items */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-[var(--on-surface)]">
              {category?.label} Variables
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              aria-label="Close wizard"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="flex flex-col gap-1">
              {category?.items.map((item) => (
                <button
                  key={item.token}
                  onClick={() => handleInsert(item.token)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-[var(--radius)] text-left',
                    'hover:bg-[var(--surface-container-highest)]/50 transition-colors group'
                  )}
                >
                  <span className="text-[11px] font-[family-name:var(--font-mono)] text-[#6bd5ff] shrink-0 min-w-[120px]">
                    {item.token}
                  </span>
                  <span className="text-[10px] text-[var(--on-surface-variant)] flex-1">
                    {item.description}
                  </span>
                  {item.preview && (
                    <span className="text-[9px] font-[family-name:var(--font-mono)] text-[var(--on-surface-variant)]/50 opacity-0 group-hover:opacity-100">
                      {item.preview}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
