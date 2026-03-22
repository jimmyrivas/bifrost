import { safeStorage } from 'electron'

export class CredentialStore {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  encrypt(plainText: string): Buffer {
    if (!this.isAvailable()) {
      throw new Error('Encryption not available on this system')
    }
    return safeStorage.encryptString(plainText)
  }

  decrypt(encrypted: Buffer): string {
    if (!this.isAvailable()) {
      throw new Error('Encryption not available on this system')
    }
    return safeStorage.decryptString(encrypted)
  }
}

export const credentialStore = new CredentialStore()
