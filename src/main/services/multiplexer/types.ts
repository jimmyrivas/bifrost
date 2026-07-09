export type MultiplexerKind = 'dtach' | 'tmux' | 'zellij' | 'rmux'

export interface MultiplexerSession {
  name: string
  /** dtach: socket path. tmux/zellij: session name (same as `name`). */
  target: string
  /** dtach: process holding socket detected via fuser/lsof. tmux: always true.
   *  zellij: false when the session is exited but still resurrectable. */
  alive: boolean
  /** tmux only: another client is currently attached. */
  attached: boolean
  /** Lifecycle state. `exited` is zellij-specific (resurrectable from cache);
   *  `stale` is dtach-specific (orphan socket, process gone). */
  state?: 'alive' | 'exited' | 'stale'
  /** tmux only: creation timestamp in unix seconds. */
  createdAt?: number
}

export interface ProbeResult {
  kind: MultiplexerKind
  installed: boolean
  /** Absolute path to the binary, when installed. */
  path?: string
  sessions: MultiplexerSession[]
  /** Optional human-readable message — e.g. permission denied listing sockets. */
  error?: string
}

export interface RemoteExecutor {
  /** Run a single command on the remote host. Stdout/stderr captured separately. */
  run(cmd: string): Promise<{ stdout: string; stderr: string; code: number }>
}

export interface ProbeOptions {
  /** dtach: socket directory (default `~/.dtach`). */
  socketDir?: string
}

export interface AttachOptions {
  /** Shell launched when creating a new session. Default `$SHELL`. */
  shell?: string
  /** Default true: create the session if it does not exist. */
  createIfMissing?: boolean
  /** Zellij-only: run resurrected commands immediately on exited-session attach. */
  forceRunCommands?: boolean
  /** Absolute path to the binary on the remote (from probe). When set, the
   *  attach command uses it directly instead of relying on PATH at exec time. */
  binaryPath?: string
  /** When true, disable the multiplexer's own mouse capture so xterm.js can
   *  perform native click-and-drag selection. Restoring native selection is
   *  the only reliable fix for selection that disappears under zellij's
   *  mouse-tracking redraws and keeps OSC 52 copy paths predictable. */
  disableMouseCapture?: boolean
  /** User-supplied config file. tmux/rmux emit `-f <file>`, zellij emits
   *  `--config <file>`, both in the global-flag position on create and attach.
   *  dtach has no config file and ignores this. Quoted with {@link dquote} so a
   *  leading `~`/`$HOME` still expands on the remote. */
  configFile?: string
  /** zellij-only layout — a registered name or a `.kdl` path — emitted as
   *  `--layout <value>` and applied only when creating a session (zellij ignores
   *  it on re-attach). Other kinds ignore it. Quoted with {@link dquote}. */
  layout?: string
  /** Free-form extra arguments inserted verbatim in the global-flag position on
   *  both create and attach (for dtach: after `-E -z`, before the shell).
   *  Supported by all kinds. NOT shell-quoted — it must survive as multiple
   *  tokens (e.g. `-r winch`); it is the user's own shell on their own host. */
  extraArgs?: string
}

/**
 * PATH prefix used by every probe so we can find binaries installed in common
 * non-system locations (cargo, ~/.local/bin, etc.) over a non-interactive
 * non-login SSH exec — which doesn't source the user's shell rc files.
 */
export const PROBE_PATH_PREFIX =
  'PATH="$HOME/.cargo/bin:$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"'

export interface Multiplexer {
  kind: MultiplexerKind
  probe(executor: RemoteExecutor, opts: ProbeOptions): Promise<ProbeResult>
  buildAttachCmd(target: string, opts: AttachOptions): string
  killSession(executor: RemoteExecutor, target: string): Promise<void>
  cleanStale(executor: RemoteExecutor, opts: ProbeOptions): Promise<number>
}

export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

/**
 * Quote a value for inclusion inside a double-quoted shell context.
 * Preserves `$HOME`/`~`/`$XDG_*` expansion (does NOT escape `$`) — only escapes
 * `\`, `"`, and `` ` `` so the quoted string can't break out or trigger command
 * substitution. Used for path-like user values (socket dir, config file, layout)
 * where tilde/variable expansion must still happen on the remote shell.
 */
export function dquote(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`')}"`
}

/**
 * Trim a user-supplied free-form argument string. Returns a leading-space-padded
 * fragment ready to splice into a command (verbatim, no quoting), or '' when the
 * input is empty/whitespace so callers can concatenate unconditionally.
 */
export function extraArgsFragment(raw?: string): string {
  const trimmed = (raw ?? '').trim()
  return trimmed ? ` ${trimmed}` : ''
}
