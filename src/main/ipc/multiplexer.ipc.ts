import { ipcMain } from 'electron'
import {
  probe,
  buildAttachCmd,
  killSession,
  cleanStale,
  type Transport,
  type MultiplexerKind,
  type AttachOptions,
  type ProbeResponse
} from '../services/multiplexer'

export interface ProbeRequestArg {
  preferred: MultiplexerKind
  fallback?: MultiplexerKind
  socketDir?: string
}

export function registerMultiplexerIpc(): void {
  ipcMain.handle(
    'multiplexer:probe',
    async (_event, transport: Transport, req: ProbeRequestArg): Promise<ProbeResponse> => {
      return probe(transport, req)
    }
  )

  ipcMain.handle(
    'multiplexer:buildAttachCmd',
    (_event, kind: MultiplexerKind, target: string, opts?: AttachOptions): string => {
      return buildAttachCmd(kind, target, opts)
    }
  )

  ipcMain.handle(
    'multiplexer:killSession',
    async (_event, transport: Transport, kind: MultiplexerKind, target: string): Promise<void> => {
      await killSession(transport, kind, target)
    }
  )

  ipcMain.handle(
    'multiplexer:cleanStale',
    async (
      _event,
      transport: Transport,
      kind: MultiplexerKind,
      socketDir?: string
    ): Promise<number> => {
      return cleanStale(transport, kind, socketDir)
    }
  )
}
