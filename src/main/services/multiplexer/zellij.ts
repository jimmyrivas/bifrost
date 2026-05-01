import {
  shellQuote,
  type AttachOptions,
  type Multiplexer,
  type MultiplexerSession,
  type ProbeOptions,
  type ProbeResult,
  type RemoteExecutor
} from './types'

export const zellij: Multiplexer = {
  kind: 'zellij',

  async probe(exec: RemoteExecutor, _opts: ProbeOptions): Promise<ProbeResult> {
    const which = await exec.run('command -v zellij 2>/dev/null')
    const path = which.stdout.trim().split('\n')[0]
    if (which.code !== 0 || !path) {
      return { kind: 'zellij', installed: false, sessions: [] }
    }

    // --no-formatting strips ANSI; preserves the textual `[EXITED ...]` marker
    // and the `(current)` annotation. Single round-trip is preferred over two.
    const list = await exec.run('zellij list-sessions --no-formatting 2>/dev/null')
    const sessions = parseZellijListOutput(list.stdout)
    return { kind: 'zellij', installed: true, path, sessions }
  },

  buildAttachCmd(target: string, opts: AttachOptions): string {
    const create = opts.createIfMissing ?? true
    const force = opts.forceRunCommands ? ' --force-run-commands' : ''
    if (create) {
      return `zellij attach --create${force} ${shellQuote(target)}`
    }
    return `zellij attach${force} ${shellQuote(target)}`
  },

  async killSession(exec: RemoteExecutor, target: string): Promise<void> {
    await exec.run(`zellij kill-session ${shellQuote(target)} >/dev/null 2>&1`)
  },

  // For zellij, "stale" maps to "exited" — delete-session removes the cached state
  // so the session can no longer be resurrected. We deliberately list + filter rather
  // than `delete-all-sessions -y` (which would nuke alive sessions too).
  async cleanStale(exec: RemoteExecutor, _opts: ProbeOptions): Promise<number> {
    const { stdout } = await exec.run('zellij list-sessions --no-formatting 2>/dev/null')
    const exited = parseZellijListOutput(stdout).filter((s) => s.state === 'exited')
    for (const s of exited) {
      await exec.run(`zellij delete-session ${shellQuote(s.name)} >/dev/null 2>&1`)
    }
    return exited.length
  }
}

export function parseZellijListOutput(stdout: string): MultiplexerSession[] {
  const sessions: MultiplexerSession[] = []
  for (const raw of stdout.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    // Name = first whitespace-delimited token. Survives format drift in metadata.
    const name = line.split(/\s+/)[0]
    if (!name) continue
    // Detect EXITED marker (case-insensitive — robust to minor zellij format changes).
    const isExited = /\bexited\b/i.test(line)
    const isCurrent = /\(current\)/i.test(line)
    sessions.push({
      name,
      target: name,
      alive: !isExited,
      // zellij list-sessions doesn't expose attach count; (current) only marks the
      // local terminal — over an SSH probe this is never true for our context.
      attached: isCurrent,
      state: isExited ? 'exited' : 'alive'
    })
  }
  return sessions
}
