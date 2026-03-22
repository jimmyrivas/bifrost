import { ipcMain, type BrowserWindow } from 'electron'
import {
  checkOllamaAvailable,
  listModels,
  generateSuggestion,
  explainCommand
} from '../services/ai-assistant'

export function registerAiIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle('ai:checkAvailable', async () => {
    return checkOllamaAvailable()
  })

  ipcMain.handle('ai:listModels', async () => {
    return listModels()
  })

  ipcMain.handle('ai:generate', async (_event, prompt: string, context?: string) => {
    let fullResponse = ''
    await generateSuggestion(prompt, context, (chunk) => {
      fullResponse = fullResponse // accumulate handled internally
      mainWindow.webContents.send('ai:chunk', chunk.text, chunk.done)
    })
    return fullResponse
  })

  ipcMain.handle('ai:explain', async (_event, command: string) => {
    return explainCommand(command)
  })
}
