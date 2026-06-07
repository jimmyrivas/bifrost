import { ipcMain } from 'electron'
import { hasClipboardImage, pasteImageToRemote } from '../services/image-paste'

export function registerClipboardIpc(): void {
  ipcMain.handle('clipboard:hasImage', () => hasClipboardImage())

  ipcMain.handle(
    'terminal:pasteImageToRemote',
    (_event, sshSessionId: string, remoteDir: string, deleteOnClose: boolean): Promise<string | null> => {
      return pasteImageToRemote(sshSessionId, remoteDir, deleteOnClose)
    }
  )
}
