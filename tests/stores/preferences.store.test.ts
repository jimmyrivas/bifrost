import { describe, it, expect, beforeEach } from 'vitest'
import {
  usePreferencesStore,
  migratePreferences,
  clampAiPanelWidth,
  AI_PANEL_MIN_PX,
  AI_PANEL_MAX_PX
} from '../../src/renderer/src/stores/preferences.store'

describe('Preferences Store', () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      terminal: {
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 14,
        cursorStyle: 'block',
        cursorBlink: true,
        scrollback: 5000,
        theme: 'dark'
      },
      language: 'en'
    })
  })

  it('has correct default terminal preferences', () => {
    const { terminal } = usePreferencesStore.getState()
    expect(terminal.fontSize).toBe(14)
    expect(terminal.cursorStyle).toBe('block')
    expect(terminal.cursorBlink).toBe(true)
    expect(terminal.scrollback).toBe(5000)
    expect(terminal.theme).toBe('dark')
  })

  it('updates a single terminal preference', () => {
    usePreferencesStore.getState().setTerminalPref('fontSize', 16)

    const { terminal } = usePreferencesStore.getState()
    expect(terminal.fontSize).toBe(16)
    // Other prefs unchanged
    expect(terminal.cursorStyle).toBe('block')
  })

  it('changes cursor style', () => {
    usePreferencesStore.getState().setTerminalPref('cursorStyle', 'underline')
    expect(usePreferencesStore.getState().terminal.cursorStyle).toBe('underline')
  })

  it('changes language', () => {
    usePreferencesStore.getState().setLanguage('es')
    expect(usePreferencesStore.getState().language).toBe('es')
  })

  it('updates scrollback buffer', () => {
    usePreferencesStore.getState().setTerminalPref('scrollback', 10000)
    expect(usePreferencesStore.getState().terminal.scrollback).toBe(10000)
  })
})

describe('migratePreferences — v6 → v7 custom multiplexer args', () => {
  it('backfills configFile/layout/extraArgs onto a pre-v7 localMultiplexer', () => {
    const legacy = {
      localMultiplexer: {
        preferred: 'zellij',
        fallback: 'tmux',
        socketDir: '~/.dtach',
        sessionPrefix: 'bifrost-{conn}',
        autoAttachSingle: true,
        alwaysAsk: false,
        disableMouseCapture: true
      }
    }
    const migrated = migratePreferences(legacy, 6)
    expect(migrated.localMultiplexer.configFile).toBe('')
    expect(migrated.localMultiplexer.layout).toBe('')
    expect(migrated.localMultiplexer.extraArgs).toBe('')
    // Prior settings must be preserved
    expect(migrated.localMultiplexer.preferred).toBe('zellij')
    expect(migrated.localMultiplexer.sessionPrefix).toBe('bifrost-{conn}')
    expect(migrated.localMultiplexer.disableMouseCapture).toBe(true)
  })

  it('does not overwrite already-set custom args', () => {
    const migrated = migratePreferences(
      {
        localMultiplexer: {
          preferred: 'tmux',
          fallback: 'none',
          socketDir: '~/.dtach',
          sessionPrefix: 'x',
          autoAttachSingle: false,
          alwaysAsk: false,
          disableMouseCapture: true,
          configFile: '~/.tmux.conf',
          layout: '',
          extraArgs: '-u'
        }
      },
      6
    )
    expect(migrated.localMultiplexer.configFile).toBe('~/.tmux.conf')
    expect(migrated.localMultiplexer.extraArgs).toBe('-u')
  })
})

describe('clampAiPanelWidth', () => {
  it('clamps below the minimum up to AI_PANEL_MIN_PX', () => {
    expect(clampAiPanelWidth(100)).toBe(AI_PANEL_MIN_PX)
    expect(clampAiPanelWidth(0)).toBe(AI_PANEL_MIN_PX)
    expect(clampAiPanelWidth(-50)).toBe(AI_PANEL_MIN_PX)
  })

  it('clamps above the maximum down to AI_PANEL_MAX_PX', () => {
    expect(clampAiPanelWidth(9999)).toBe(AI_PANEL_MAX_PX)
  })

  it('passes through (rounded) values within range', () => {
    expect(clampAiPanelWidth(400)).toBe(400)
    expect(clampAiPanelWidth(420.7)).toBe(421)
  })

  it('keeps the bounds themselves stable', () => {
    expect(clampAiPanelWidth(AI_PANEL_MIN_PX)).toBe(AI_PANEL_MIN_PX)
    expect(clampAiPanelWidth(AI_PANEL_MAX_PX)).toBe(AI_PANEL_MAX_PX)
  })
})
