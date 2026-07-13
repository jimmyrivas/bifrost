import { describe, it, expect } from 'vitest'
import { parseSshOptions } from '../../src/main/services/ssh-options'

const wrap = (options: Record<string, string>): string => JSON.stringify({ options })

describe('parseSshOptions', () => {
  it('returns empty for null/undefined/blank/invalid input', () => {
    expect(parseSshOptions(null)).toEqual({})
    expect(parseSshOptions(undefined)).toEqual({})
    expect(parseSshOptions('')).toEqual({})
    expect(parseSshOptions('not json')).toEqual({})
    expect(parseSshOptions('{}')).toEqual({})
    expect(parseSshOptions(JSON.stringify({ options: {} }))).toEqual({})
  })

  it('parses ciphers / MACs / KEX / host-key algorithms into a list', () => {
    const parsed = parseSshOptions(
      wrap({
        Ciphers: 'aes256-ctr, aes256-gcm@openssh.com',
        MACs: 'hmac-sha2-256,hmac-sha2-512',
        KexAlgorithms: 'curve25519-sha256',
        HostKeyAlgorithms: 'ssh-ed25519'
      })
    )
    expect(parsed.algorithms).toEqual({
      ciphers: ['aes256-ctr', 'aes256-gcm@openssh.com'],
      hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
      kex: ['curve25519-sha256'],
      hostkey: ['ssh-ed25519']
    })
  })

  it('omits empty algorithm values instead of emitting empty lists', () => {
    const parsed = parseSshOptions(wrap({ Ciphers: '', MACs: '   ', KexAlgorithms: 'curve25519-sha256' }))
    expect(parsed.algorithms).toEqual({ kex: ['curve25519-sha256'] })
  })

  it('has no algorithms key when no algorithm options are set', () => {
    const parsed = parseSshOptions(wrap({ ForwardX11: 'yes' }))
    expect(parsed.algorithms).toBeUndefined()
  })

  it('maps ForwardX11=yes to x11Forward, anything else to absent', () => {
    expect(parseSshOptions(wrap({ ForwardX11: 'yes' })).x11Forward).toBe(true)
    expect(parseSshOptions(wrap({ ForwardX11: 'no' })).x11Forward).toBeUndefined()
    expect(parseSshOptions(wrap({})).x11Forward).toBeUndefined()
  })

  it('does not surface ForwardAgent or proxy (not consumed by the connect path)', () => {
    const parsed = parseSshOptions(wrap({ ForwardAgent: 'yes', ProxyJump: 'bastion' }))
    expect(parsed).toEqual({})
  })
})
