import { describe, it, expect } from 'vitest'
import { isOpenableExternalUrl } from '../../src/main/services/external-url'

describe('isOpenableExternalUrl', () => {
  it('accepts http and https', () => {
    expect(isOpenableExternalUrl('http://example.com')).toBe(true)
    expect(isOpenableExternalUrl('https://example.com/a/b?q=1#x')).toBe(true)
    expect(isOpenableExternalUrl('HTTPS://EXAMPLE.COM')).toBe(true)
  })

  it('rejects dangerous and non-web schemes', () => {
    expect(isOpenableExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isOpenableExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isOpenableExternalUrl('data:text/html,<script>')).toBe(false)
    expect(isOpenableExternalUrl('ftp://example.com')).toBe(false)
    expect(isOpenableExternalUrl('vscode://x')).toBe(false)
  })

  it('rejects malformed or empty input', () => {
    expect(isOpenableExternalUrl('not a url')).toBe(false)
    expect(isOpenableExternalUrl('')).toBe(false)
    expect(isOpenableExternalUrl('example.com')).toBe(false)
  })
})
