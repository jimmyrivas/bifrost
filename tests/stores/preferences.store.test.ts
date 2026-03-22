import { describe, it, expect, beforeEach } from 'vitest'
import { usePreferencesStore } from '../../src/renderer/src/stores/preferences.store'

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
