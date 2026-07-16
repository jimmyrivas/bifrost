import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto'

/**
 * Pure AES-256-GCM file crypto for at-rest DB encryption (Phase 5.5). No
 * Electron/DB imports, so it is unit-testable in isolation.
 *
 * File layout: `BIFROST_ENC\0` (12) | salt (32) | iv (16) | authTag (16) | ciphertext.
 * The key is derived from the passphrase with scrypt over the per-file salt.
 */
const HEADER = Buffer.from('BIFROST_ENC\0') // 12 bytes
const MAGIC = 'BIFROST_ENC'

export function encryptBytes(plain: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(32)
  const key = scryptSync(passphrase, salt, 32)
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([HEADER, salt, iv, authTag, data])
}

/** True when a buffer starts with the Bifrost encrypted-DB magic header. */
export function hasEncryptedHeader(content: Buffer): boolean {
  return content.length >= 76 && content.subarray(0, MAGIC.length).toString() === MAGIC
}

/**
 * Decrypt a buffer produced by {@link encryptBytes}. Throws on a wrong
 * passphrase, a tampered file (GCM auth failure), or a bad header.
 */
export function decryptBytes(content: Buffer, passphrase: string): Buffer {
  if (!hasEncryptedHeader(content)) {
    throw new Error('Not a valid encrypted Bifrost database')
  }
  const salt = content.subarray(12, 44)
  const iv = content.subarray(44, 60)
  const authTag = content.subarray(60, 76)
  const ciphertext = content.subarray(76)
  const key = scryptSync(passphrase, salt, 32)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
