import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TerminalPreferences {
  fontFamily: string
  fontSize: number
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scrollback: number
  theme: 'dark' | 'light'
}

interface PreferencesState {
  terminal: TerminalPreferences
  language: 'en' | 'es'
  setTerminalPref: <K extends keyof TerminalPreferences>(
    key: K,
    value: TerminalPreferences[K]
  ) => void
  setLanguage: (lang: 'en' | 'es') => void
}

const defaultTerminal: TerminalPreferences = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: 14,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  theme: 'dark'
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      terminal: { ...defaultTerminal },
      language: navigator.language.startsWith('es') ? 'es' : 'en',

      setTerminalPref: (key, value) =>
        set((state) => ({
          terminal: { ...state.terminal, [key]: value }
        })),

      setLanguage: (lang) => set({ language: lang })
    }),
    {
      name: 'bifrost-preferences',
      version: 1
    }
  )
)
