import { describe, it, expect } from 'vitest'
import { parseSessionId, rawSessionId } from '../../src/renderer/src/lib/session-id'

describe('parseSessionId', () => {
  it('splits every known protocol prefix into protocol + raw', () => {
    expect(parseSessionId('ssh:abc')).toEqual({ protocol: 'ssh', raw: 'abc' })
    expect(parseSessionId('mosh:abc')).toEqual({ protocol: 'mosh', raw: 'abc' })
    expect(parseSessionId('telnet:abc')).toEqual({ protocol: 'telnet', raw: 'abc' })
    expect(parseSessionId('ftp:abc')).toEqual({ protocol: 'ftp', raw: 'abc' })
    expect(parseSessionId('ssm:abc')).toEqual({ protocol: 'ssm', raw: 'abc' })
    expect(parseSessionId('rdp:abc')).toEqual({ protocol: 'rdp', raw: 'abc' })
    expect(parseSessionId('vnc:abc')).toEqual({ protocol: 'vnc', raw: 'abc' })
  })

  it('treats a bare local/custom id as protocol-less', () => {
    expect(parseSessionId('terminal-3')).toEqual({ protocol: null, raw: 'terminal-3' })
  })

  it('does not treat an unknown prefix as a protocol', () => {
    expect(parseSessionId('foo:bar')).toEqual({ protocol: null, raw: 'foo:bar' })
  })

  it('only consumes the first colon (raw may contain colons)', () => {
    expect(parseSessionId('ssh:host:22')).toEqual({ protocol: 'ssh', raw: 'host:22' })
  })

  it('handles empty/nullish input', () => {
    expect(parseSessionId(null)).toEqual({ protocol: null, raw: '' })
    expect(parseSessionId(undefined)).toEqual({ protocol: null, raw: '' })
    expect(parseSessionId('')).toEqual({ protocol: null, raw: '' })
  })
})

describe('rawSessionId', () => {
  it('returns the raw id for a prefixed session', () => {
    expect(rawSessionId('rdp:box')).toBe('box')
  })

  it('returns null for nullish input', () => {
    expect(rawSessionId(null)).toBeNull()
    expect(rawSessionId('')).toBeNull()
  })
})
