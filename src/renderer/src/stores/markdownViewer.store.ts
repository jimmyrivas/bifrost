import { create } from 'zustand'
import { usePreferencesStore } from './preferences.store'

/**
 * Drives the internal Markdown viewer modal. A terminal Ctrl+Click on a remote
 * `.md` path calls `openFor(sessionId, path)`, which fetches the file over SFTP
 * on the live SSH session (works through a JumpHost) and renders it.
 *
 * Field selectors only (no object selectors) per the Zustand lesson in
 * CLAUDE.md — subscribing to the whole store causes render loops.
 */

export type MarkdownViewerStatus = 'idle' | 'loading' | 'ready' | 'error'

interface MarkdownViewerState {
  open: boolean
  /** SSH session id (without the `ssh:` prefix) the file is read from. */
  sessionId: string | null
  /** Absolute / ~-anchored remote path being shown. */
  path: string | null
  /** Host label, for the modal header. */
  host: string | null
  content: string
  status: MarkdownViewerStatus
  error: string | null
  truncated: boolean
  bytes: number
  /** Monotonic token so a slow fetch can't clobber a newer one. */
  _reqId: number

  openFor: (sessionId: string, path: string, host?: string) => Promise<void>
  close: () => void
}

export const useMarkdownViewerStore = create<MarkdownViewerState>((set, get) => ({
  open: false,
  sessionId: null,
  path: null,
  host: null,
  content: '',
  status: 'idle',
  error: null,
  truncated: false,
  bytes: 0,
  _reqId: 0,

  openFor: async (sessionId, path, host) => {
    const reqId = get()._reqId + 1
    set({
      open: true,
      sessionId,
      path,
      host: host ?? null,
      content: '',
      status: 'loading',
      error: null,
      truncated: false,
      bytes: 0,
      _reqId: reqId
    })

    const maxBytes = usePreferencesStore.getState().terminal.markdownMaxBytes

    try {
      const res = await window.bifrost.sftp.readMarkdown(sessionId, path, maxBytes)
      // Drop the result if a newer request started or the modal was closed.
      if (get()._reqId !== reqId) return
      set({
        content: res.content,
        bytes: res.bytes,
        truncated: res.truncated,
        status: 'ready'
      })
    } catch (err) {
      if (get()._reqId !== reqId) return
      const msg = err instanceof Error ? err.message : String(err)
      set({ status: 'error', error: msg })
    }
  },

  close: () =>
    set((s) => ({
      open: false,
      status: 'idle',
      content: '',
      error: null,
      // Bump _reqId so any in-flight fetch is ignored on resolve.
      _reqId: s._reqId + 1
    }))
}))
