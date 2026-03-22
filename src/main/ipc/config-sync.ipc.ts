import { ipcMain } from 'electron'
import { exportToGit, importFromGit, syncWithGit } from '../services/config-sync'

export function registerConfigSyncIpc(): void {
  ipcMain.handle('configSync:export', async (_event, repoPath: string) => {
    return exportToGit(repoPath)
  })

  ipcMain.handle('configSync:import', async (_event, repoPath: string) => {
    return importFromGit(repoPath)
  })

  ipcMain.handle('configSync:sync', async (_event, repoPath: string) => {
    return syncWithGit(repoPath)
  })
}
