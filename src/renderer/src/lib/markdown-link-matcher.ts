/**
 * Detects Markdown file paths inside a single line of terminal output so they
 * can be turned into Ctrl+Click links that open Bifrost's internal viewer.
 *
 * Two modes:
 *   - Default (anchored only): absolute `/a/b.md` and home `~/a.md` paths.
 *     These resolve without knowing the shell's cwd.
 *   - `includeRelative`: also `./x.md`, `../docs/x.md`, `docs/x.md`, and bare
 *     `README.md`. These need the remote shell cwd to resolve (see
 *     resolveRemotePath); the caller drops any it can't resolve.
 *
 * URLs (`https://host/x.md`) are never matched — WebLinksAddon owns those.
 */

export interface MarkdownPathMatch {
  /** Path token, without surrounding quotes or a trailing :line[:col]. */
  path: string
  /** Inclusive start column (0-based) of the match within the line. */
  start: number
  /** Exclusive end column (0-based) of the match within the line. */
  end: number
  /**
   * True when `path` is relative (`./x`, `../x`, `dir/x`, bare `x.md`) and so
   * needs the remote cwd to resolve. Absolute (`/…`) and home (`~/…`) are false.
   */
  relative: boolean
}

export interface FindOptions {
  /** Also match relative and bare paths (default: false). */
  includeRelative?: boolean
}

const MD_EXT = /\.(?:md|markdown)$/i

// A Markdown path token, optionally with a `:line[:col]` trailer (group 2).
//   - lead:     `/` (abs) | `~/` (home) | one-or-more `./` or `../`
//   - segments: `seg/seg/…`
//   - name:     `file.md` / `file.markdown`
// The negative lookbehind keeps us from matching inside a larger token (so the
// `/a.md` inside `https://h/a.md` or `./a.md` is not picked up on its own).
const PATH_RE =
  /(?<![\w.@/~+-])((?:\/|~\/|(?:\.\.?\/)+)?(?:[\w.@+-]+\/)*[\w.@+-]+\.(?:md|markdown))(:\d+(?::\d+)?)?/gi

function isRelative(path: string): boolean {
  return !path.startsWith('/') && !path.startsWith('~')
}

/**
 * Find every Markdown path in `line`, left to right. `line` MUST already be
 * stripped of ANSI escape sequences (see stripAnsi).
 */
export function findMarkdownPaths(line: string, opts: FindOptions = {}): MarkdownPathMatch[] {
  if (!line) return []
  // Fast bail when there's nothing that could end a Markdown path.
  if (!/\.(?:md|markdown)\b/i.test(line)) return []

  const includeRelative = opts.includeRelative ?? false
  const matches: MarkdownPathMatch[] = []
  PATH_RE.lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = PATH_RE.exec(line)) !== null) {
    const core = m[1]
    if (!core || !MD_EXT.test(core)) {
      if (PATH_RE.lastIndex <= m.index) PATH_RE.lastIndex = m.index + 1
      continue
    }

    // Defense in depth against URLs even though the lookbehind blocks most.
    const before = line.slice(0, m.index)
    if (/[a-z][a-z0-9+.-]*:\/?$/i.test(before)) continue

    const relative = isRelative(core)
    if (relative && !includeRelative) continue

    const start = m.index
    const end = m.index + core.length
    matches.push({ path: core, start, end, relative })

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
