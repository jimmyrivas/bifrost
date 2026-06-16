/**
 * Detects Markdown file paths inside a single line of terminal output so they
 * can be turned into Ctrl+Click links that open Bifrost's internal viewer.
 *
 * v1 scope (intentionally conservative to avoid false positives in noisy
 * terminal output):
 *   - Absolute paths:            /home/user/README.md
 *   - Home-relative paths:       ~/docs/setup.md   ~/notes.markdown
 *   - Optionally quoted:         "/etc/app/CHANGES.md"   '~/x.md'
 *   - Optional :line / :line:col suffix is stripped from the returned path
 *
 * Explicitly NOT matched in v1 (documented limitation, resolved later via
 * shell integration / OSC 7):
 *   - Relative paths:            ./README.md   ../docs/x.md   docs/x.md
 *   - URLs:                      https://host/x.md  (WebLinksAddon owns those)
 */

export interface MarkdownPathMatch {
  /** Absolute or ~-anchored remote path, without surrounding quotes or :line. */
  path: string
  /** Inclusive start column (0-based) of the match within the line. */
  start: number
  /** Exclusive end column (0-based) of the match within the line. */
  end: number
}

const MD_EXT = /\.(?:md|markdown)$/i

// A path "core": starts at `/` or `~/`, followed by non-space, non-quote chars,
// ending in a Markdown extension. The optional :line[:col] suffix is matched
// separately so we can exclude it from the clickable range.
//   group 1: the path core (what we want to open)
//   group 2: optional :line or :line:col trailer (ignored)
const PATH_RE =
  /(~?\/(?:[^\s"'`:]|:(?![\s"'`]|\d+(?::\d+)?(?:[\s"'`]|$)))*\.(?:md|markdown))(:\d+(?::\d+)?)?/gi

/**
 * Find every Markdown path in `line`. Returns matches in left-to-right order.
 * `line` MUST already be stripped of ANSI escape sequences (see stripAnsi).
 */
export function findMarkdownPaths(line: string): MarkdownPathMatch[] {
  if (!line || !line.includes('/')) return []

  const matches: MarkdownPathMatch[] = []
  PATH_RE.lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = PATH_RE.exec(line)) !== null) {
    const core = m[1]
    if (!core || !MD_EXT.test(core)) continue

    // Reject URL-like matches whose `/` is actually part of `://` (e.g. the
    // path inside https://host/a.md). WebLinksAddon already handles URLs.
    const before = line.slice(0, m.index)
    if (/[a-z][a-z0-9+.-]*:\/?$/i.test(before)) continue

    // Reject relative paths: if the leading `/` is preceded by a token char,
    // the real token is something like `./x.md`, `../x.md` or `docs/x.md`.
    // v1 only links genuinely absolute or ~-anchored paths.
    const prevChar = m.index > 0 ? line[m.index - 1] : ''
    if (prevChar && /[A-Za-z0-9._~-]/.test(prevChar)) continue

    const start = m.index
    const end = m.index + core.length
    matches.push({ path: core, start, end })

    // Guard against zero-length matches looping forever.
    if (PATH_RE.lastIndex <= start) PATH_RE.lastIndex = end
  }

  return matches
}

/**
 * Strip ANSI escape / control sequences so the matcher sees plain text.
 * Anchored on the ESC (0x1b) / CSI (0x9b) introducer so it never touches
 * ordinary characters like `[` in regular output. xterm's link provider hands
 * us already-decoded cell text, so this is only needed when matching raw data.
 */
// eslint-disable-next-line no-control-regex
const ANSI_RE =
  /[\x1b\x9b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\x07)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g

export function stripAnsi(input: string): string {
  return input.replace(ANSI_RE, '')
}
