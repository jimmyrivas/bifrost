import { safeStorage } from 'electron'

/**
 * Credential store using electron safeStorage.
 * Falls back to base64 encoding (NOT secure) when OS keychain is unavailable.
 */
export class CredentialStore {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  encrypt(plainText: string): Buffer {
    if (this.isAvailable()) {
      return safeStorage.encryptString(plainText)
    }
    // Fallback: base64 encode (not secure, but functional)
    console.warn('safeStorage not available — using base64 fallback (not secure)')
    return Buffer.from('b64:' + Buffer.from(plainText, 'utf-8').toString('base64'))
  }

  decrypt(encrypted: Buffer): string {
    if (!encrypted || encrypted.length === 0) return ''

    // Check if this is our base64 fallback
    const str = encrypted.toString('utf-8')
    if (str.startsWith('b64:')) {
      return Buffer.from(str.slice(4), 'base64').toString('utf-8')
    }

    if (this.isAvailable()) {
      return safeStorage.decryptString(encrypted)
    }

    // Last resort: try to interpret as utf-8
    console.warn('safeStorage not available — cannot decrypt')
    return ''
  }
}

export const credentialStore = new CredentialStore()
