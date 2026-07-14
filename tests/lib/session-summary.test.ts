import { describe, it, expect } from 'vitest'
import {
  rawSessionId,
  meaningfulLineCount,
  hasMeaningfulContent,
  MIN_SUMMARY_LINES
} from '../../src/renderer/src/lib/session-summary'

describe('rawSessionId', () => {
  it('strips every known protocol prefix', () => {
    expect(rawSessionId('ssh:abc123')).toBe('abc123')
    expect(rawSessionId('mosh:xyz')).toBe('xyz')
    expect(rawSessionId('telnet:host')).toBe('host')
    expect(rawSessionId('ftp:host')).toBe('host')
    expect(rawSessionId('ssm:i-0abc')).toBe('i-0abc')
    expect(rawSessionId('rdp:win')).toBe('win')
    expect(rawSessionId('vnc:box')).toBe('box')
  })

  it('leaves unprefixed (local PTY) ids untouched', () => {
    expect(rawSessionId('local-42')).toBe('local-42')
    expect(rawSessionId('pty123')).toBe('pty123')
    expect(rawSessionId('terminal-7')).toBe('terminal-7')
  })

  it('does not strip an unknown prefix', () => {
    expect(rawSessionId('foo:bar')).toBe('foo:bar')
  })

  it('handles a raw id that itself contains a colon after a known prefix', () => {
    expect(rawSessionId('ssh:host:22')).toBe('host:22')
  })

  it('returns null for empty/nullish input', () => {
    expect(rawSessionId(null)).toBeNull()
    expect(rawSessionId(undefined)).toBeNull()
    expect(rawSessionId('')).toBeNull()
  })
})

describe('meaningfulLineCount', () => {
  it('counts only non-blank lines', () => {
    expect(meaningfulLineCount('a\n\n  \nb\nc')).toBe(3)
  })

  it('returns 0 for empty/whitespace/nullish', () => {
    expect(meaningfulLineCount('')).toBe(0)
    expect(meaningfulLineCount('   \n\n  ')).toBe(0)
    expect(meaningfulLineCount(null)).toBe(0)
    expect(meaningfulLineCount(undefined)).toBe(0)
  })
})

describe('hasMeaningfulContent', () => {
  it('is true when there are at least MIN_SUMMARY_LINES non-trivial lines', () => {
    const buffer = Array.from({ length: MIN_SUMMARY_LINES }, (_, i) => `line ${i}`).join('\n')
    expect(hasMeaningfulContent(buffer)).toBe(true)
  })

  it('is false for sparse output and no errors', () => {
    expect(hasMeaningfulContent('only one line')).toBe(false)
    expect(hasMeaningfulContent('')).toBe(false)
  })

  it('is true when an error was detected even with little output', () => {
    expect(hasMeaningfulContent('one line', 1)).toBe(true)
  })
})
