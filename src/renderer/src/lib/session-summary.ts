/**
 * Helpers for the idle session-summary feature.
 *
 * Output buffers in the main process (`window-router`) are keyed by the RAW
 * session id, while the renderer tracks terminals with a protocol prefix. The
 * raw-key stripping lives in `./session-id` (protocol-complete); re-exported
 * here for the existing callers.
 */

export { rawSessionId } from './session-id'

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
