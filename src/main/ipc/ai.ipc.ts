import { ipcMain, type BrowserWindow } from 'electron'
import {
  checkAvailable,
  listModels,
  generateSuggestion,
  explainCommand,
  setAiConfig,
  getAiConfig,
  type AiConfig
} from '../services/ai-assistant'

export function registerAiIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle('ai:checkAvailable', async () => {
    return checkAvailable()
  })

  ipcMain.handle('ai:listModels', async () => {
    return listModels()
  })

  ipcMain.handle('ai:generate', async (_event, prompt: string, context?: string) => {
    let fullResponse = ''
    await generateSuggestion(prompt, context, (chunk) => {
      fullResponse += chunk.text
      mainWindow.webContents.send('ai:chunk', chunk.text, chunk.done)
    })
    return fullResponse
  })

  ipcMain.handle('ai:explain', async (_event, command: string) => {
    return explainCommand(command)
  })

  ipcMain.handle('ai:getConfig', () => {
    return getAiConfig()
  })

  ipcMain.handle('ai:setConfig', (_event, cfg: Partial<AiConfig>) => {
    setAiConfig(cfg)
  })
}
