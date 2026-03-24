import { createHmac } from 'crypto'

/**
 * Generate a TOTP code (RFC 6238) from a base32-encoded secret.
 * No external dependencies — uses Node.js crypto only.
 */

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = encoded.replace(/[\s=-]/g, '').toUpperCase()
  let bits = ''
  for (const char of cleaned) {
    const val = alphabet.indexOf(char)
    if (val === -1) continue
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

export function generateTOTP(secret: string, digits = 6, period = 30): string {
  const key = base32Decode(secret)
  const counter = Math.floor(Date.now() / 1000 / period)

  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const hmac = createHmac('sha1', key).update(counterBuffer).digest()

  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return (code % Math.pow(10, digits)).toString().padStart(digits, '0')
}
