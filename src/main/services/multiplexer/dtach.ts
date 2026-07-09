import {
  shellQuote,
  dquote,
  extraArgsFragment,
  PROBE_PATH_PREFIX,
  type AttachOptions,
  type Multiplexer,
  type MultiplexerSession,
  type ProbeOptions,
  type ProbeResult,
  type RemoteExecutor
} from './types'

const DEFAULT_SOCKET_DIR = '~/.dtach'

export const dtach: Multiplexer = {
  kind: 'dtach',

  async probe(exec: RemoteExecutor, opts: ProbeOptions): Promise<ProbeResult> {
    const dir = opts.socketDir || DEFAULT_SOCKET_DIR

    const which = await exec.run(`${PROBE_PATH_PREFIX} command -v dtach 2>/dev/null`)
    const path = which.stdout.trim().split('\n')[0]
    if (which.code !== 0 || !path) {
      return { kind: 'dtach', installed: false, sessions: [] }
    }

    // Single script: ensure dir, list sockets, check liveness via fuser or lsof.
    // Output format per line: "<socket_path>|<alive 0|1>"
    const script = `mkdir -p ${dir} 2>/dev/null; \
for s in ${dir}/*.sock; do \
  [ -e "$s" ] || continue; \
  if fuser "$s" >/dev/null 2>&1 || lsof "$s" >/dev/null 2>&1; then \
    echo "$s|1"; \
  else \
    echo "$s|0"; \
  fi; \
done`

    const list = await exec.run(script)
    const sessions: MultiplexerSession[] = []
    for (const line of list.stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const idx = trimmed.lastIndexOf('|')
      if (idx === -1) continue
      const socket = trimmed.slice(0, idx)
      const aliveFlag = trimmed.slice(idx + 1)
      const base = socket.split('/').pop() || socket
      const name = base.replace(/\.sock$/, '')
      sessions.push({
        name,
        target: socket,
        alive: aliveFlag === '1',
        attached: false
      })
    }

    return { kind: 'dtach', installed: true, path, sessions }
  },

  buildAttachCmd(target: string, opts: AttachOptions): string {
    const create = opts.createIfMissing ?? true
    const shell = opts.shell || '"$SHELL"'
    // Use double quotes so $HOME / $XDG_* / etc. expand on the remote.
    // -E: disable detach character (avoids hijacking common keys)
    // -z: blocking-IO mode (better with line-buffered shells)
    const quoted = dquote(target)
    const bin = opts.binaryPath ? shellQuote(opts.binaryPath) : 'dtach'
    // dtach has no config file or layout — only free-form extra flags apply,
    // placed after -E -z and before the shell.
    const extra = extraArgsFragment(opts.extraArgs)
    if (create) {
      // mkdir -p the parent dir defensively — in case probe was skipped
      // or the directory was removed between probe and attach.
      return `mkdir -p "$(dirname ${quoted})" 2>/dev/null; ${bin} -A ${quoted} -E -z${extra} ${shell}`
    }
    return `${bin} -a ${quoted} -E -z${extra}`
  },

  async killSession(exec: RemoteExecutor, target: string): Promise<void> {
    await exec.run(
      `fuser -k ${shellQuote(target)} >/dev/null 2>&1; rm -f ${shellQuote(target)}`
    )
  },

  async cleanStale(exec: RemoteExecutor, opts: ProbeOptions): Promise<number> {
    const dir = opts.socketDir || DEFAULT_SOCKET_DIR
    const script = `removed=0; \
for s in ${dir}/*.sock; do \
  [ -e "$s" ] || continue; \
  if ! fuser "$s" >/dev/null 2>&1 && ! lsof "$s" >/dev/null 2>&1; then \
    rm -f "$s" && removed=$((removed+1)); \
  fi; \
done; \
echo $removed`
    const { stdout } = await exec.run(script)
    return parseInt(stdout.trim(), 10) || 0
  }
}

export function parseDtachListOutput(stdout: string, dirHint = ''): MultiplexerSession[] {
  const sessions: MultiplexerSession[] = []
  for (const raw of stdout.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const idx = line.lastIndexOf('|')
    if (idx === -1) continue
    const socket = line.slice(0, idx)
    const aliveFlag = line.slice(idx + 1)
    if (dirHint && !socket.startsWith(dirHint.replace(/\/$/, ''))) {
      // Allow path validation if caller wants
    }
    const base = socket.split('/').pop() || socket
    sessions.push({
      name: base.replace(/\.sock$/, ''),
      target: socket,
      alive: aliveFlag === '1',
      attached: false
    })
  }
  return sessions
}
