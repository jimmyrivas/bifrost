import { describe, it, expect } from 'vitest'
import { shouldOpenUrl } from '../../src/renderer/src/lib/terminal-web-links'

const base = { uri: 'https://example.com', ctrl: false, meta: false, enabled: true, activation: 'ctrl-click' as const }

describe('shouldOpenUrl', () => {
  it('opens on Ctrl or Cmd in ctrl-click mode', () => {
    expect(shouldOpenUrl({ ...base, ctrl: true })).toBe(true)
    expect(shouldOpenUrl({ ...base, meta: true })).toBe(true)
  })

  it('does not open on a plain click in ctrl-click mode', () => {
    expect(shouldOpenUrl({ ...base })).toBe(false)
  })

  it('opens on a plain click in click mode', () => {
    expect(shouldOpenUrl({ ...base, activation: 'click' })).toBe(true)
  })

  it('never opens when disabled, even with Ctrl', () => {
    expect(shouldOpenUrl({ ...base, enabled: false, ctrl: true })).toBe(false)
  })

  it('refuses non-http(s) schemes', () => {
    expect(shouldOpenUrl({ ...base, uri: 'file:///etc/passwd', ctrl: true })).toBe(false)
    expect(shouldOpenUrl({ ...base, uri: 'javascript:alert(1)', activation: 'click' })).toBe(false)
  })

  it('accepts http and https', () => {
    expect(shouldOpenUrl({ ...base, uri: 'http://x.io', activation: 'click' })).toBe(true)
    expect(shouldOpenUrl({ ...base, uri: 'https://x.io', ctrl: true })).toBe(true)
  })
})
