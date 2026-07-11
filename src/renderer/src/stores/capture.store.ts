import { create } from 'zustand'

/**
 * Tracks which live sessions are being recorded (asciicast) or logged
 * (plain-text transcript), keyed by the RAW backend session id (no `ssh:`
 * prefix). This is the single source of truth the context menu uses for
 * dynamic Start/Stop labels and the tab badges use for the "capturing"
 * indicator — so the user always knows a capture is running and where it lands.
 */
interface CaptureState {
  recordings: Record<string, number> // raw sessionId -> started timestamp (ms)
  logs: Record<string, string> // raw sessionId -> log file path
  setRecording: (sessionId: string, startedAt: number) => void
  clearRecording: (sessionId: string) => void
  setLogging: (sessionId: string, filePath: string) => void
  clearLogging: (sessionId: string) => void
}

/**
 * Drop any capture entries for a session that just ended (tab closed, remote
 * disconnect, process exit). Accepts a prefixed terminal id (`ssh:x`,
 * `mosh:x`) or a raw session id. Keeps the global REC indicator honest — the
 * main process finalizes the files on its side.
 */
export function clearCaptureForSession(terminalId: string | null | undefined): void {
  if (!terminalId) return
  const raw = terminalId.startsWith('ssh:')
    ? terminalId.slice(4)
    : terminalId.startsWith('mosh:')
      ? terminalId.slice(5)
      : terminalId
  const s = useCaptureStore.getState()
  s.clearRecording(raw)
  s.clearLogging(raw)
}

export const useCaptureStore = create<CaptureState>((set) => ({
  recordings: {},
  logs: {},
  setRecording: (sessionId, startedAt) =>
    set((s) => ({ recordings: { ...s.recordings, [sessionId]: startedAt } })),
  clearRecording: (sessionId) =>
    set((s) => {
      const rest = { ...s.recordings }
      delete rest[sessionId]
      return { recordings: rest }
    }),
  setLogging: (sessionId, filePath) =>
    set((s) => ({ logs: { ...s.logs, [sessionId]: filePath } })),
  clearLogging: (sessionId) =>
    set((s) => {
      const rest = { ...s.logs }
      delete rest[sessionId]
      return { logs: rest }
    })
}))
