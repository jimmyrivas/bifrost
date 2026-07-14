/**
 * Canonical helpers for renderer terminal/session ids.
 *
 * The renderer tags each terminal with a protocol-prefixed id so it can route
 * I/O to the right backend:
 *   - `ssh:<id>`                              → SSH shell (ssh.* IPC)
 *   - `mosh:<id>` `telnet:<id>` `ftp:<id>` `ssm:<id>` → PTY/socket launcher (protocols.* IPC)
 *   - `rdp:<id>` `vnc:<id>`                   → external GUI client (protocols.* IPC, no stdin)
 *   - bare `terminal-N`                       → local/custom PTY (terminal.* IPC)
 *
 * Main-process buffers and the capture store are keyed by the RAW backend id
 * (no prefix). Every place that needs the raw key, the protocol, or wants to
 * write to a session MUST go through here — hardcoding a single prefix (the old
 * `mosh:`-only checks) silently breaks every other protocol.
 */

/** PTY/socket-backed protocols driven through the `protocols.*` IPC namespace. */
const PTY_BACKED_PREFIXES = ['mosh', 'telnet', 'ftp', 'ssm'] as const
/** Every protocol prefix that can appear on a renderer terminal id. */
const ALL_PREFIXES = ['ssh', ...PTY_BACKED_PREFIXES, 'rdp', 'vnc'] as const

export type SessionProtocol = (typeof ALL_PREFIXES)[number]

/**
 * Split a terminal id into its protocol prefix (or `null` for a bare
 * local/custom id) and the RAW backend session id used as a buffer/capture key.
 */
export function parseSessionId(id: string | null | undefined): {
  protocol: SessionProtocol | null
  raw: string
} {
  if (!id) return { protocol: null, raw: '' }
  const colon = id.indexOf(':')
  if (colon === -1) return { protocol: null, raw: id }
  const prefix = id.slice(0, colon)
  if ((ALL_PREFIXES as readonly string[]).includes(prefix)) {
    return { protocol: prefix as SessionProtocol, raw: id.slice(colon + 1) }
  }
  return { protocol: null, raw: id }
}

/** RAW backend session id (buffer/capture key) with any protocol prefix stripped. */
export function rawSessionId(id: string | null | undefined): string | null {
  if (!id) return null
  return parseSessionId(id).raw
}

/**
 * Write data to a live session's input, routing by protocol:
 *   SSH → ssh.write, PTY-backed (mosh/telnet/ftp/ssm) → protocols.writePty,
 *   local/custom → terminal.write. RDP/VNC are external clients with no
 *   writable stdin, so their writes are ignored.
 */
export function writeToSession(termId: string, data: string): void {
  const { protocol, raw } = parseSessionId(termId)
  if (protocol === 'ssh') {
    window.bifrost?.ssh?.write(raw, data)
  } else if (protocol && (PTY_BACKED_PREFIXES as readonly string[]).includes(protocol)) {
    window.bifrost?.protocols?.writePty(raw, data)
  } else if (protocol === 'rdp' || protocol === 'vnc') {
    // External GUI client — no writable stdin exposed to the renderer.
  } else {
    window.bifrost?.terminal?.write(termId, data)
  }
}
