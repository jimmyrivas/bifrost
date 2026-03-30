import { ipcMain } from 'electron'
import {
  listPlugins,
  installPlugin,
  uninstallPlugin,
  enablePlugin,
  disablePlugin,
  getContextMenuItems,
  getRegisteredCommands,
  getRegisteredThemes
} from '../services/plugin-manager'

export function registerPluginsIpc(): void {
  ipcMain.handle('plugins:list', () => {
    return listPlugins()
  })

  ipcMain.handle('plugins:install', (_event, packageName: string) => {
    return installPlugin(packageName)
  })

  ipcMain.handle('plugins:uninstall', (_event, pluginName: string) => {
    uninstallPlugin(pluginName)
  })

  ipcMain.handle('plugins:enable', (_event, pluginName: string) => {
    enablePlugin(pluginName)
  })

  ipcMain.handle('plugins:disable', (_event, pluginName: string) => {
    disablePlugin(pluginName)
  })

  ipcMain.handle('plugins:contextMenuItems', () => {
    return getContextMenuItems().map((item) => ({ label: item.label }))
  })

  ipcMain.handle('plugins:runContextMenuAction', (_event, label: string, context: { sessionId?: string; connectionId?: string }) => {
    const item = getContextMenuItems().find((i) => i.label === label)
    if (item) item.handler(context)
  })

  ipcMain.handle('plugins:runCommand', (_event, name: string) => {
    const cmd = getRegisteredCommands().get(name)
    if (cmd) cmd()
  })

  ipcMain.handle('plugins:listCommands', () => {
    return [...getRegisteredCommands().keys()]
  })

  ipcMain.handle('plugins:listThemes', () => {
    const themes: Array<{ name: string; theme: Record<string, string> }> = []
    for (const [name, theme] of getRegisteredThemes()) {
      themes.push({ name, theme })
    }
    return themes
  })
}
