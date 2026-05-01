export type MultiplexerKind = 'dtach' | 'tmux'

export interface MultiplexerSession {
  name: string
  /** dtach: socket path. tmux: session name (same as `name`). */
  target: string
  /** dtach: process holding socket detected via fuser/lsof. tmux: always true. */
  alive: boolean
  /** tmux only: another client is currently attached. */
  attached: boolean
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
}

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
