import { ipcMain } from 'electron'
import {
  onePassword,
  bitwarden,
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
}
