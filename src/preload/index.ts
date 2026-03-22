import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

export interface BifrostApi {
  terminal: {
    create: (cols: number, rows: number) => Promise<string>
    write: (id: string, data: string) => void
    resize: (id: string, cols: number, rows: number) => void
    destroy: (id: string) => Promise<void>
    getDefaultShell: () => Promise<string>
    onData: (callback: (id: string, data: string) => void) => () => void
    onExit: (callback: (id: string, exitCode: number) => void) => () => void
  }
}

const api: BifrostApi = {
  terminal: {
    create: (cols: number, rows: number) => ipcRenderer.invoke('terminal:create', cols, rows),
    write: (id: string, data: string) => ipcRenderer.send('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('terminal:resize', id, cols, rows),
    destroy: (id: string) => ipcRenderer.invoke('terminal:destroy', id),
    getDefaultShell: () => ipcRenderer.invoke('terminal:getDefaultShell'),
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_event: IpcRendererEvent, id: string, data: string): void =>
        callback(id, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback: (id: string, exitCode: number) => void) => {
      const handler = (_event: IpcRendererEvent, id: string, exitCode: number): void =>
        callback(id, exitCode)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    }
  }
}

contextBridge.exposeInMainWorld('bifrost', api)
