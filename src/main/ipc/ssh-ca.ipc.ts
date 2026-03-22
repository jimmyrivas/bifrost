import { ipcMain } from 'electron'
import {
  signPublicKeyWithVault,
  signPublicKeyWithLocalCa,
  isSshKeygenAvailable,
  isVaultCliAvailable,
  type VaultSignOptions,
  type LocalCaSignOptions,
  type SignedCertificateResult
} from '../services/ssh-ca'

export function registerSshCaIpc(): void {
  ipcMain.handle(
    'sshCa:signWithVault',
    async (_event, options: VaultSignOptions): Promise<SignedCertificateResult> => {
      try {
        return await signPublicKeyWithVault(options)
      } catch (err) {
        throw new Error(
          `Vault SSH CA signing failed: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  )

  ipcMain.handle(
    'sshCa:signWithLocalCa',
    async (_event, options: LocalCaSignOptions): Promise<SignedCertificateResult> => {
      try {
        return await signPublicKeyWithLocalCa(options)
      } catch (err) {
        throw new Error(
          `Local CA signing failed: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  )

  ipcMain.handle('sshCa:isSshKeygenAvailable', async (): Promise<boolean> => {
    return isSshKeygenAvailable()
  })

  ipcMain.handle('sshCa:isVaultCliAvailable', async (): Promise<boolean> => {
    return isVaultCliAvailable()
  })
}
