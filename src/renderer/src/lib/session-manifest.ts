/**
 * Session-restore manifest: a small, persisted snapshot of the open tabs so the
 * previous session can be reopened after the app restarts.
 *
 * Stored in localStorage (not the Zustand store) on purpose: the live `sessions.store`
 * shape (full `Tab` with `rootPane`, live `terminalId`, Maps/Sets) is not what we want to
 * persist, and a Zustand `persist` on it would rehydrate incomplete tabs into live state
 * and could overwrite the previous session before the restore prompt is answered. A plain
 * read-once / write-after-decision helper sidesteps both hazards.
 *
 * Restore policy (phase 1): SSH connection tabs are always restorable; local tabs only
 * when the local multiplexer is enabled (so reconnecting reattaches to the live mux
 * session); non-multiplexed local tabs are dropped.
 */
import type { Tab, TerminalStyle } from '@renderer/stores/sessions.store'

const STORAGE_KEY = 'bifrost-session-manifest'

export interface ManifestTab {
  connectionId: string | null
  title: string
  lockTitle: boolean
  terminalStyle?: TerminalStyle
  shell?: string
  shellArgs?: string[]
}

export interface SessionManifest {
  tabs: ManifestTab[]
  /** Index (into `tabs`) of the tab that was active. */
  activeIndex: number
}

export const EMPTY_MANIFEST: SessionManifest = { tabs: [], activeIndex: 0 }

/**
 * A tab is restorable if it is a connection tab, or a local tab while the local
 * multiplexer is enabled (so the reconnect path can reattach to the live session).
 */
export function isRestorable(tab: Pick<Tab, 'connectionId'>, localMuxEnabled: boolean): boolean {
  if (tab.connectionId) return true
  return localMuxEnabled
}

/** Strip a live tab down to its restorable, non-ephemeral fields. */
export function toManifestTab(tab: Tab): ManifestTab {
  return {
    connectionId: tab.connectionId,
    title: tab.title,
    lockTitle: tab.lockTitle,
    terminalStyle: tab.terminalStyle,
    shell: tab.shell,
    shellArgs: tab.shellArgs
  }
}

/** Build the manifest from the live tab list, applying the restore policy. */
export function deriveManifest(
  tabs: Tab[],
  activeTabId: string | null,
  localMuxEnabled: boolean
): SessionManifest {
  const restorable = tabs.filter((t) => isRestorable(t, localMuxEnabled))
  const activeIndex = Math.max(
    0,
    restorable.findIndex((t) => t.id === activeTabId)
  )
  return { tabs: restorable.map(toManifestTab), activeIndex }
}

export function readManifest(): SessionManifest {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_MANIFEST
    const parsed = JSON.parse(raw) as SessionManifest
    if (!Array.isArray(parsed.tabs)) return EMPTY_MANIFEST
    return { tabs: parsed.tabs, activeIndex: parsed.activeIndex ?? 0 }
  } catch {
    return EMPTY_MANIFEST
  }
}

export function writeManifest(manifest: SessionManifest): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest))
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}
