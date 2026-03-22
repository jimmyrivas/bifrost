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

  ipcMain.handle('sftp:close', (_event, sftpId: string) => {
    sftpManager.closeSftp(sftpId)
  })

  ipcMain.handle('sftp:isOpen', (_event, sftpId: string) => {
    return sftpManager.isOpen(sftpId)
  })
}
