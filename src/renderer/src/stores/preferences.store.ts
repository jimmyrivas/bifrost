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
  /** When pasting an image on an SSH tab, upload it and type the remote path. */
  imagePasteEnabled: boolean
  /** Remote directory for uploaded images. `~` is expanded on the server. */
  imagePasteDir: string
  /** Delete uploaded images from the server when the app window closes. */
  imagePasteDeleteOnClose: boolean
  /** Turn absolute/`~` .md paths in SSH output into clickable links. */
  markdownLinksEnabled: boolean
  /** Gesture that opens the Markdown viewer from a detected path. */
  markdownLinkActivation: 'ctrl-click' | 'click'
  /** Max bytes fetched for the Markdown viewer (larger files are truncated). */
  markdownMaxBytes: number
  /** Width of the docked AI Assistant side panel, in pixels (clamped 280–720). */
  aiPanelWidthPx: number
}

/** Min/max bounds for the AI Assistant panel width (px). */
export const AI_PANEL_MIN_PX = 280
export const AI_PANEL_MAX_PX = 720
export const clampAiPanelWidth = (px: number): number =>
  Math.min(AI_PANEL_MAX_PX, Math.max(AI_PANEL_MIN_PX, Math.round(px)))

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
  tabTitleTemplate: '',
  imagePasteEnabled: true,
  imagePasteDir: '~/.bifrost/pastes',
  imagePasteDeleteOnClose: false,
  markdownLinksEnabled: true,
  markdownLinkActivation: 'ctrl-click',
  markdownMaxBytes: 2_000_000,
  aiPanelWidthPx: 320
}

const defaultLocalMultiplexer: MultiplexerConfig = {
  ...defaultMultiplexer,
  sessionPrefix: 'bifrost-local'
}

/**
 * Persisted-state migration for the preferences store. Exported for testing.
 * Each `version < N` branch backfills fields introduced at persist version N so
 * older payloads load with the current shape.
 */
export function migratePreferences(
  persisted: unknown,
  version: number
): PreferencesState {
  const state = (persisted ?? {}) as Partial<PreferencesState>
  if (version < 2 && !state.localMultiplexer) {
    state.localMultiplexer = { ...defaultLocalMultiplexer }
  }
  // v3: disableMouseCapture added to MultiplexerConfig. Pre-existing
  // localMultiplexer objects lack the field; backfill with the safe
  // default (true) so zellij users get working selection on first run.
  if (version < 3 && state.localMultiplexer) {
    state.localMultiplexer = {
      ...defaultLocalMultiplexer,
      ...state.localMultiplexer,
      disableMouseCapture: state.localMultiplexer.disableMouseCapture ?? true
    }
  }
  // v4: image-paste preferences added. Backfill onto persisted terminal.
  if (version < 4) {
    state.terminal = { ...defaultTerminal, ...(state.terminal ?? {}) }
  }
  // v5: markdown-link viewer preferences added. Backfill defaults.
  if (version < 5) {
    state.terminal = { ...defaultTerminal, ...(state.terminal ?? {}) }
  }
  // v6: AI panel width preference added. Backfill the default.
  if (version < 6) {
    state.terminal = { ...defaultTerminal, ...(state.terminal ?? {}) }
  }
  // v7: custom multiplexer args (configFile/layout/extraArgs) added.
  // Backfill onto localMultiplexer with empty defaults so pre-existing
  // configs load unchanged.
  if (version < 7 && state.localMultiplexer) {
    state.localMultiplexer = {
      ...defaultLocalMultiplexer,
      ...state.localMultiplexer,
      configFile: state.localMultiplexer.configFile ?? '',
      layout: state.localMultiplexer.layout ?? '',
      extraArgs: state.localMultiplexer.extraArgs ?? ''
    }
  }
  return state as PreferencesState
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
      version: 7,
      migrate: migratePreferences
    }
  )
)
