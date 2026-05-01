import {
  shellQuote,
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

    const which = await exec.run('command -v dtach 2>/dev/null')
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
    // -E: disable detach character (avoids hijacking common keys)
    // -z: blocking-IO mode (better with line-buffered shells)
    if (create) {
      return `dtach -A ${shellQuote(target)} -E -z ${shell}`
    }
    return `dtach -a ${shellQuote(target)} -E -z`
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
