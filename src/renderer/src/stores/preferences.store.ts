import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  defaultMultiplexer,
  type MultiplexerConfig
} from '@renderer/components/connections/MultiplexerPanel'

export interface TerminalPreferences {
  fontFamily: string
  fontSize: number
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scrollback: number
  theme: 'dark' | 'light'
  colorScheme: string
  pasteWarningEnabled: boolean
  autoReconnect: boolean
  fontLigatures: boolean
  copyOnSelect: boolean
  tabTitleTemplate: string
}

interface PreferencesState {
  terminal: TerminalPreferences
  /** Multiplexer config applied to local PTY tabs (no SSH). Per-connection
   *  config is stored on the connection itself; this covers "local" tabs. */
  localMultiplexer: MultiplexerConfig
  language: 'en' | 'es'
  pasteWarningDismissedForSession: boolean
  setTerminalPref: <K extends keyof TerminalPreferences>(
    key: K,
    value: TerminalPreferences[K]
  ) => void
  setLocalMultiplexer: (cfg: MultiplexerConfig) => void
  setLanguage: (lang: 'en' | 'es') => void
  dismissPasteWarningForSession: () => void
}

const defaultTerminal: TerminalPreferences = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: 14,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  theme: 'dark',
  colorScheme: 'Spectral',
  pasteWarningEnabled: true,
  autoReconnect: true,
  fontLigatures: true,
  copyOnSelect: false,
  tabTitleTemplate: ''
}

const defaultLocalMultiplexer: MultiplexerConfig = {
  ...defaultMultiplexer,
  sessionPrefix: 'bifrost-local'
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      terminal: { ...defaultTerminal },
      localMultiplexer: { ...defaultLocalMultiplexer },
      language: navigator.language.startsWith('es') ? 'es' : 'en',
      pasteWarningDismissedForSession: false,

      setTerminalPref: (key, value) =>
        set((state) => ({
          terminal: { ...state.terminal, [key]: value }
        })),

      setLocalMultiplexer: (cfg) => set({ localMultiplexer: cfg }),

      setLanguage: (lang) => set({ language: lang }),

      dismissPasteWarningForSession: () =>
        set({ pasteWarningDismissedForSession: true })
    }),
    {
      name: 'bifrost-preferences',
      version: 2,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<PreferencesState>
        if (version < 2 && !state.localMultiplexer) {
          state.localMultiplexer = { ...defaultLocalMultiplexer }
        }
        return state as PreferencesState
      }
    }
  )
)
