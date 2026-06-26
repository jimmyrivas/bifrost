/**
 * Helpers for the idle session-summary feature.
 *
 * Output buffers in the main process (`window-router`) are keyed by the RAW session id,
 * while the renderer tracks terminals with a protocol prefix (`ssh:` / `mosh:`). Callers
 * must strip the prefix before `terminal.getBuffer`, or the lookup misses and the summary
 * reports "no terminal output available".
 */

/** Strip a leading `ssh:` / `mosh:` protocol prefix to get the raw buffer key. */
export function rawSessionId(id: string | null | undefined): string | null {
  if (!id) return null
  const colon = id.indexOf(':')
  if (colon === -1) return id
  const prefix = id.slice(0, colon)
  if (prefix === 'ssh' || prefix === 'mosh') return id.slice(colon + 1)
  return id
}

/** Count non-trivial (non-blank after trim) lines in a terminal buffer. */
export function meaningfulLineCount(buffer: string | null | undefined): number {
  if (!buffer) return 0
  let count = 0
  for (const line of buffer.split('\n')) {
    if (line.trim().length > 0) count++
  }
  return count
}

/** Minimum non-trivial lines for an idle session to be worth summarizing. */
export const MIN_SUMMARY_LINES = 3

/**
 * Whether an idle session has "something to say" — enough output to summarize, or a
 * detected error. Cheap; no AI call.
 */
export function hasMeaningfulContent(
  buffer: string | null | undefined,
  errorCount = 0
): boolean {
  return errorCount > 0 || meaningfulLineCount(buffer) >= MIN_SUMMARY_LINES
}
