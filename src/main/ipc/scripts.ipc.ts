import { ipcMain } from 'electron'
import { scriptEngine, type BifrostScript, type ScriptOutputMessage } from '../services/script-engine'

export function registerScriptsIpc(): void {
  ipcMain.handle('scripts:list', () => {
    return scriptEngine.listScripts()
  })

  ipcMain.handle('scripts:get', (_event, id: string) => {
    return scriptEngine.getScript(id)
  })

  ipcMain.handle(
    'scripts:save',
    (_event, script: Omit<BifrostScript, 'id' | 'createdAt' | 'updatedAt'>) => {
      return scriptEngine.saveScript(script)
    }
  )

  ipcMain.handle('scripts:update', (_event, id: string, updates: Partial<BifrostScript>) => {
    scriptEngine.updateScript(id, updates)
  })

  ipcMain.handle('scripts:delete', (_event, id: string) => {
    scriptEngine.deleteScript(id)
  })

  ipcMain.handle('scripts:validate', (_event, code: string) => {
    return scriptEngine.validateScript(code)
  })

  ipcMain.handle('scripts:execute', (event, code: string) => {
    return new Promise<void>((resolve, reject) => {
      const { promise } = scriptEngine.executeScript(code, (msg: ScriptOutputMessage) => {
        // Forward send/log messages to the renderer that initiated execution
        event.sender.send('script:output', msg)
      })
      promise.then(resolve).catch(reject)
    })
  })
}
