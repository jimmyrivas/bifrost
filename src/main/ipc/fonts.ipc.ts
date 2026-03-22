import { ipcMain } from 'electron'
import { scanMonospaceFonts } from '../services/font-scanner'

let cachedFonts: string[] | null = null

export function registerFontsIpc(): void {
  ipcMain.handle('fonts:listMonospace', () => {
    if (!cachedFonts) {
      cachedFonts = scanMonospaceFonts()
    }
    return cachedFonts
  })
}
