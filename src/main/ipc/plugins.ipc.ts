/**
 * #29-31: Plugin system IPC handlers.
 */

import { ipcMain } from 'electron'
import { loadPlugins, installPlugin, uninstallPlugin } from '../services/plugin-manager'

export function registerPluginsIpc(): void {
  ipcMain.handle('plugins:list', () => {
    return loadPlugins()
  })

  ipcMain.handle('plugins:install', (_event, packageName: string) => {
    return installPlugin(packageName)
  })

  ipcMain.handle('plugins:uninstall', (_event, pluginName: string) => {
    uninstallPlugin(pluginName)
  })
}
