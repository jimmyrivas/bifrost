import { describe, it, expect, vi } from 'vitest'
import { sealInlinePasswords } from '../../src/main/services/jump-host/seal'

const fakeEncrypt = (plain: string): string => `enc(${plain})`

describe('sealInlinePasswords', () => {
  it('returns null for null/empty input', () => {
    expect(sealInlinePasswords(null, fakeEncrypt)).toBeNull()
    expect(sealInlinePasswords(undefined, fakeEncrypt)).toBeNull()
    expect(sealInlinePasswords('', fakeEncrypt)).toBeNull()
  })

  it('passes through invalid JSON unchanged', () => {
    expect(sealInlinePasswords('not json', fakeEncrypt)).toBe('not json')
  })

  it('passes through JSON without chain unchanged', () => {
    const json = JSON.stringify({ random: 'data' })
    expect(sealInlinePasswords(json, fakeEncrypt)).toBe(json)
  })

  it('encrypts inline password and removes plain field', () => {
    const json = JSON.stringify({
      chain: [
        { inline: { host: 'b', username: 'u', authType: 'userpass', password: 's3cret' } }
      ]
    })
    const sealed = JSON.parse(sealInlinePasswords(json, fakeEncrypt)!)
    expect(sealed.chain[0].inline.password).toBeUndefined()
    expect(sealed.chain[0].inline.encryptedPassword).toBe('enc(s3cret)')
  })

  it('preserves an existing encryptedPassword when password is blank', () => {
    const json = JSON.stringify({
      chain: [
        {
          inline: {
            host: 'b',
            username: 'u',
            authType: 'userpass',
            password: '',
            encryptedPassword: 'PRIOR'
          }
        }
      ]
    })
    const sealed = JSON.parse(sealInlinePasswords(json, fakeEncrypt)!)
    expect(sealed.chain[0].inline.encryptedPassword).toBe('PRIOR')
    expect(sealed.chain[0].inline.password).toBeUndefined()
  })

  it('encrypts passphrase the same way', () => {
    const json = JSON.stringify({
      chain: [
        {
          inline: { host: 'b', username: 'u', authType: 'key_pass', passphrase: 'pp' }
        }
      ]
    })
    const sealed = JSON.parse(sealInlinePasswords(json, fakeEncrypt)!)
    expect(sealed.chain[0].inline.passphrase).toBeUndefined()
    expect(sealed.chain[0].inline.encryptedPassphrase).toBe('enc(pp)')
  })

  it('leaves reference hops untouched', () => {
    const json = JSON.stringify({
      chain: [{ connectionId: 'abc-123' }]
    })
    expect(sealInlinePasswords(json, fakeEncrypt)).toBe(json)
  })

  it('encrypts only the hops that need it across a mixed chain', () => {
    const encrypt = vi.fn((p: string) => `e(${p})`)
    const json = JSON.stringify({
      chain: [
        { connectionId: 'abc' },
        { inline: { host: 'b1', username: 'u', authType: 'userpass', password: 'p1' } },
        { inline: { host: 'b2', username: 'u', authType: 'agent' } },
        { inline: { host: 'b3', username: 'u', authType: 'userpass', encryptedPassword: 'kept' } }
      ]
    })
    const sealed = JSON.parse(sealInlinePasswords(json, encrypt)!)
    expect(encrypt).toHaveBeenCalledTimes(1)
    expect(encrypt).toHaveBeenCalledWith('p1')
    expect(sealed.chain[1].inline.encryptedPassword).toBe('e(p1)')
    expect(sealed.chain[3].inline.encryptedPassword).toBe('kept')
    expect(sealed.chain[2].inline.encryptedPassword).toBeUndefined()
  })
})
