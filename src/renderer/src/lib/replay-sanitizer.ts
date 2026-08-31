/**
 * Sanitize a buffered terminal replay before writing it to a fresh xterm during
 * session adoption (reattach / combine / explode).
 *
 * Shell-integration prompts and programs emit terminal QUERIES that ask the
 * emulator to report state — color (OSC 10/11/12, OSC 4), cursor position /
 * status (CSI DSR `ESC[6n`), and device attributes (CSI DA `ESC[c`). xterm
 * answers each by writing a REPLY back to the pty. When the tail of a session
 * buffer is replayed, those queries fire again and the replies leak onto the
 * shell prompt as literal text (e.g. `10;rgb:e4e4/e4e4/e7e7`, or `1R` fragments
 * from a cursor-position report). The state was already resolved in the live
 * session, so dropping the queries from the replay is safe and removes the
 * garbage. These final bytes (`n` for DSR, `c` for DA, OSC color `?`) do not
 * occur in normal display output, so stripping them cannot corrupt content.
 */

/* eslint-disable no-control-regex */
// OSC color QUERIES: ESC ] <ps> [;<ps>] ? (BEL | ST). Only queries (end in `?`).
const COLOR_QUERY = /\x1b\][0-9]+;(?:[0-9]+;)?\?(?:\x07|\x1b\\)/g
// CSI Device Status Report: ESC [ <n> n  (e.g. 6n cursor position, 5n status).
const DSR = /\x1b\[[0-9]*n/g
// CSI Device Attributes: ESC [ [<|=|>] <n?> c
const DA = /\x1b\[[<=>]?[0-9]*c/g
/* eslint-enable no-control-regex */

/** Strip reply-triggering query sequences from a replayed session buffer. */
export function stripReplayQueries(buf: string): string {
  return buf.replace(COLOR_QUERY, '').replace(DSR, '').replace(DA, '')
}
