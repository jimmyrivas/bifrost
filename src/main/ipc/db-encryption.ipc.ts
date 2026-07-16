import { ipcMain } from 'electron'
import { unlock, enable, disable, isEncryptionEnabled } from '../services/db-encryption'

/**
 * IPC for at-rest DB encryption (Phase 5.5). Registered once at startup. The
 * startup unlock window sets an `onUnlocked` callback (via {@link setOnUnlocked})
 * so the main process can close that window and continue booting once the
 * passphrase is accepted.
 */
let onUnlockedCb: (() => void) | null = null

export function setOnUnlocked(cb: (() => void) | null): void {
  onUnlockedCb = cb
}

export function registerDbEncryptionIpc(): void {
  ipcMain.handle('db:unlock', (_event, passphrase: string): { ok: boolean } => {
    const ok = unlock(passphrase)
    if (ok) onUnlockedCb?.()
    return { ok }
  })

  ipcMain.handle('db:enable', (_event, passphrase: string) => {
    enable(passphrase)
  })

  ipcMain.handle('db:disable', () => {
    disable()
  })

  ipcMain.handle('db:status', (): { enabled: boolean } => {
    return { enabled: isEncryptionEnabled() }
  })
}
