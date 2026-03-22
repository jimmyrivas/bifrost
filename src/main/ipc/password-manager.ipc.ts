import { ipcMain } from 'electron'
import {
  onePassword,
  bitwarden,
  vault,
  awsSM,
  azureKV,
  detectPasswordManagers,
  type PasswordManagerStatus,
  type PasswordManagerEntry
} from '../services/password-manager'

export function registerPasswordManagerIpc(): void {
  ipcMain.handle('pm:detect', (): PasswordManagerStatus => {
    return detectPasswordManagers()
  })

  // 1Password
  ipcMain.handle('pm:op:listSSHKeys', (): PasswordManagerEntry[] => {
    return onePassword.listSSHKeys()
  })

  ipcMain.handle('pm:op:listLogins', (): PasswordManagerEntry[] => {
    return onePassword.listLogins()
  })

  ipcMain.handle('pm:op:getPassword', (_event, itemId: string): string => {
    return onePassword.getPassword(itemId)
  })

  ipcMain.handle('pm:op:getField', (_event, itemId: string, field: string): string => {
    return onePassword.getField(itemId, field)
  })

  ipcMain.handle('pm:op:readSecret', (_event, reference: string): string => {
    return onePassword.readSecret(reference)
  })

  // Bitwarden
  ipcMain.handle('pm:bw:listItems', (_event, search?: string): PasswordManagerEntry[] => {
    return bitwarden.listItems(search)
  })

  ipcMain.handle('pm:bw:getPassword', (_event, itemId: string): string => {
    return bitwarden.getPassword(itemId)
  })

  ipcMain.handle('pm:bw:getField', (_event, itemId: string, fieldName: string): string => {
    return bitwarden.getField(itemId, fieldName)
  })

  // === HashiCorp Vault (#78) ===

  ipcMain.handle(
    'pm:vault:signSSHKey',
    (_event, pubKeyPath: string, role: string, addr: string, token: string): string => {
      return vault.signSSHKey(pubKeyPath, role, addr, token)
    }
  )

  ipcMain.handle(
    'pm:vault:listRoles',
    (_event, addr: string, token: string): string[] => {
      return vault.listRoles(addr, token)
    }
  )

  ipcMain.handle(
    'pm:vault:getSecret',
    (_event, path: string, addr: string, token: string): string => {
      return vault.getSecret(path, addr, token)
    }
  )

  ipcMain.handle('pm:vault:isAvailable', (): boolean => {
    return vault.isAvailable()
  })

  // === AWS Secrets Manager (#79) ===

  ipcMain.handle(
    'pm:awsSM:getSecret',
    (_event, secretId: string): string => {
      return awsSM.getSecret(secretId)
    }
  )

  ipcMain.handle(
    'pm:awsSM:listSecrets',
    (): Array<{ name: string; arn: string; description: string }> => {
      return awsSM.listSecrets()
    }
  )

  ipcMain.handle('pm:awsSM:isAvailable', (): boolean => {
    return awsSM.isAvailable()
  })

  // === Azure Key Vault (#80) ===

  ipcMain.handle(
    'pm:azureKV:getSecret',
    (_event, vaultName: string, secretName: string): string => {
      return azureKV.getSecret(vaultName, secretName)
    }
  )

  ipcMain.handle(
    'pm:azureKV:listSecrets',
    (_event, vaultName: string): Array<{ name: string; id: string; enabled: boolean }> => {
      return azureKV.listSecrets(vaultName)
    }
  )

  ipcMain.handle('pm:azureKV:isAvailable', (): boolean => {
    return azureKV.isAvailable()
  })
}
