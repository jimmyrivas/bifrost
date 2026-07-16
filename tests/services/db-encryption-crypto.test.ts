import { describe, it, expect } from 'vitest'
import { encryptBytes, decryptBytes, hasEncryptedHeader } from '../../src/main/services/db-encryption-crypto'

const plain = Buffer.from('SQLite format 3\0 …pretend database bytes… secret=hunter2')

describe('db-encryption-crypto', () => {
  it('round-trips through encrypt → decrypt with the right passphrase', () => {
    const enc = encryptBytes(plain, 'correct horse battery staple')
    expect(hasEncryptedHeader(enc)).toBe(true)
    expect(decryptBytes(enc, 'correct horse battery staple').equals(plain)).toBe(true)
  })

  it('produces a different ciphertext each time (random salt/iv)', () => {
    const a = encryptBytes(plain, 'pw')
    const b = encryptBytes(plain, 'pw')
    expect(a.equals(b)).toBe(false)
  })

  it('throws on the wrong passphrase', () => {
    const enc = encryptBytes(plain, 'right')
    expect(() => decryptBytes(enc, 'wrong')).toThrow()
  })

  it('throws when the ciphertext is tampered (GCM auth)', () => {
    const enc = encryptBytes(plain, 'pw')
    enc[enc.length - 1] ^= 0xff // flip a byte in the ciphertext
    expect(() => decryptBytes(enc, 'pw')).toThrow()
  })

  it('rejects a buffer without the magic header', () => {
    expect(hasEncryptedHeader(Buffer.from('not encrypted'))).toBe(false)
    expect(() => decryptBytes(Buffer.from('not encrypted at all, plain bytes here!!'), 'pw')).toThrow(
      /not a valid encrypted/i
    )
  })
})
