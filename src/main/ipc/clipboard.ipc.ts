import { ipcMain } from 'electron'
import { hasClipboardImage, pasteImageToRemote } from '../services/image-paste'

export function registerClipboardIpc(): void {
  ipcMain.handle('clipboard:hasImage', () => hasClipboardImage())

  ipcMain.handle(
    'terminal:pasteImageToRemote',
    async (
      _event,
      sshSessionId: string,
      remoteDir: string,
      deleteOnClose: boolean
    ): Promise<string | null> => {
      try {
        return await pasteImageToRemote(sshSessionId, remoteDir, deleteOnClose)
      } catch (err) {
        console.error('[image-paste] IPC failed', err)
        throw err
      }
    }
  )
}
