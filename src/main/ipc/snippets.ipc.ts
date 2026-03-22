import { ipcMain } from 'electron'
import { snippetManager, type Snippet } from '../services/snippet-manager'

export function registerSnippetsIpc(): void {
  ipcMain.handle('snippets:getAll', () => {
    return snippetManager.getAll()
  })

  ipcMain.handle('snippets:search', (_event, query: string) => {
    return snippetManager.search(query)
  })

  ipcMain.handle('snippets:getCategories', () => {
    return snippetManager.getCategories()
  })

  ipcMain.handle('snippets:getByCategory', (_event, category: string) => {
    return snippetManager.getByCategory(category)
  })

  ipcMain.handle(
    'snippets:add',
    (_event, snippet: Omit<Snippet, 'id' | 'variables' | 'createdAt' | 'updatedAt'>) => {
      return snippetManager.add(snippet)
    }
  )

  ipcMain.handle('snippets:update', (_event, id: string, updates: Partial<Snippet>) => {
    snippetManager.update(id, updates)
  })

  ipcMain.handle('snippets:delete', (_event, id: string) => {
    snippetManager.delete(id)
  })

  ipcMain.handle(
    'snippets:resolve',
    (_event, command: string, values: Record<string, string>) => {
      return snippetManager.resolveCommand(command, values)
    }
  )
}
