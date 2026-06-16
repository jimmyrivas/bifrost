import { ipcMain } from 'electron'
import { sftpManager, type SftpFileEntry, type SftpFileStat } from '../services/sftp-manager'

export function registerSftpIpc(): void {
  ipcMain.handle(
    'sftp:open',
    (_event, sshSessionId: string): Promise<string> => {
      return sftpManager.openSftp(sshSessionId)
    }
  )

  ipcMain.handle(
    'sftp:listDirectory',
    (_event, sftpId: string, path: string): Promise<SftpFileEntry[]> => {
      return sftpManager.listDirectory(sftpId, path)
    }
  )

  ipcMain.handle(
    'sftp:readFile',
    (_event, sftpId: string, remotePath: string, localPath: string): Promise<void> => {
      return sftpManager.readFile(sftpId, remotePath, localPath)
    }
  )

  ipcMain.handle(
    'sftp:writeFile',
    (_event, sftpId: string, localPath: string, remotePath: string): Promise<void> => {
      return sftpManager.writeFile(sftpId, localPath, remotePath)
    }
  )

  ipcMain.handle(
    'sftp:mkdir',
    (_event, sftpId: string, path: string): Promise<void> => {
      return sftpManager.mkdir(sftpId, path)
    }
  )

  ipcMain.handle(
    'sftp:delete',
    (_event, sftpId: string, path: string): Promise<void> => {
      return sftpManager.delete(sftpId, path)
    }
  )

  ipcMain.handle(
    'sftp:rename',
    (_event, sftpId: string, oldPath: string, newPath: string): Promise<void> => {
      return sftpManager.rename(sftpId, oldPath, newPath)
    }
  )

  ipcMain.handle(
    'sftp:stat',
    (_event, sftpId: string, path: string): Promise<SftpFileStat> => {
      return sftpManager.stat(sftpId, path)
    }
  )

  // Internal Markdown viewer: read a remote .md file straight into memory over
  // the live SSH session (works through JumpHost). Validates extension and size
  // server-side so the renderer can't coerce it into reading arbitrary blobs.
  ipcMain.handle(
    'sftp:readMarkdown',
    async (
      _event,
      sshSessionId: string,
      remotePath: string,
      maxBytes?: number
    ): Promise<{ content: string; bytes: number; truncated: boolean }> => {
      if (typeof remotePath !== 'string' || !/\.(?:md|markdown)$/i.test(remotePath)) {
        throw new Error('Markdown viewer only opens .md / .markdown files')
      }
      const cap = Math.min(Math.max(maxBytes ?? 2_000_000, 1_024), 20_000_000)
      try {
        return await sftpManager.readFileToString(sshSessionId, remotePath, cap)
      } catch (err) {
        console.error('[markdown-viewer] read failed', err)
        throw err
      }
    }
  )

  ipcMain.handle('sftp:close', (_event, sftpId: string) => {
    sftpManager.closeSftp(sftpId)
  })

  ipcMain.handle('sftp:isOpen', (_event, sftpId: string) => {
    return sftpManager.isOpen(sftpId)
  })
}
