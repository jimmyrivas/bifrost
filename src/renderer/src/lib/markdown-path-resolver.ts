/**
 * Resolves a Markdown path token (from markdown-link-matcher) to a remote path
 * that the SFTP layer can open. Relative paths need the remote shell's cwd,
 * captured via OSC 7 or, as a fallback, parsed from the prompt.
 *
 * Output may keep a leading `~` — the main process expands it to the remote
 * home with `sftp.realpath('.')`. Everything else is normalized to an absolute
 * POSIX path with `.`/`..` collapsed.
 */

/**
 * Normalize a remote POSIX path, collapsing `.` and `..` and duplicate slashes.
 * A leading `~` is preserved as an anchor (treated like root for `..` purposes).
 */
function normalizeRemote(p: string): string {
  let prefix = ''
  let rest = p
  if (rest === '~') return '~'
  if (rest.startsWith('~/')) {
    prefix = '~'
    rest = rest.slice(1) // keep the leading '/'
  }
  const isAbs = prefix === '~' || rest.startsWith('/')
  const stack: string[] = []
  for (const part of rest.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (stack.length && stack[stack.length - 1] !== '..') stack.pop()
      else if (!isAbs) stack.push('..')
      // at an absolute root, `..` is a no-op
    } else {
      stack.push(part)
    }
  }
  return prefix + (isAbs ? '/' : '') + stack.join('/')
}

/**
 * Turn a matched path token into a remote path to open, or null when it can't
 * be resolved (relative path with no known cwd, or an unusable cwd).
 *
 * @param raw  path token from the matcher (`/a/b.md`, `~/a.md`, `./x.md`, …)
 * @param cwd  remote shell cwd (absolute or `~`-anchored), if known
 */
export function resolveRemotePath(raw: string, cwd?: string | null): string | null {
  if (!raw) return null
  if (raw.startsWith('/')) return normalizeRemote(raw)
  if (raw === '~' || raw.startsWith('~/')) return normalizeRemote(raw)

  // Relative (`./x`, `../x`, `dir/x.md`, bare `x.md`) — needs the cwd.
  if (!cwd) return null
  if (!cwd.startsWith('/') && !cwd.startsWith('~')) return null
  return normalizeRemote(cwd.replace(/\/+$/, '') + '/' + raw)
}

// CWD candidate inside a prompt: `~`, `~/foo`, or `/abs/foo` (no spaces, stops
// before a trailing prompt sigil).
const CWD = '(~|~\\/[^\\s$#%>]*|\\/[^\\s$#%>]*)'
const PROMPT_WITH_USER = new RegExp(`[^\\s:]+@[^\\s:]+:\\s*${CWD}\\s*[$#%>]`)
const PROMPT_BARE = new RegExp(`(?:^|\\s)${CWD}\\s*[$#%>]\\s*$`)

/**
 * Best-effort extraction of the remote cwd from the last non-empty prompt line
 * in the terminal buffer. Returns `~`, `~/path`, or `/abs/path`, or null.
 *
 * Fallback for when the shell doesn't emit OSC 7. Inherently heuristic — works
 * for common `user@host:~/path$` / `/abs/path #` prompts, not powerline/custom.
 */
export function parseCwdFromPrompt(text: string): string | null {
  const lines = text.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trimEnd()
    if (!line.trim()) continue
    const withUser = line.match(PROMPT_WITH_USER)
    if (withUser) return withUser[1]
    const bare = line.match(PROMPT_BARE)
    if (bare) return bare[1]
    return null // only the last non-empty line is a candidate prompt
  }
  return null
}
