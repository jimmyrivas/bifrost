import {
  shellQuote,
  PROBE_PATH_PREFIX,
  type AttachOptions,
  type Multiplexer,
  type MultiplexerSession,
  type ProbeOptions,
  type ProbeResult,
  type RemoteExecutor
} from './types'

export const tmux: Multiplexer = {
  kind: 'tmux',

  async probe(exec: RemoteExecutor, _opts: ProbeOptions): Promise<ProbeResult> {
    const which = await exec.run(`${PROBE_PATH_PREFIX} command -v tmux 2>/dev/null`)
    const path = which.stdout.trim().split('\n')[0]
    if (which.code !== 0 || !path) {
      return { kind: 'tmux', installed: false, sessions: [] }
    }

    // Format: name|attached|created
    const fmt = `"#{session_name}|#{session_attached}|#{session_created}"`
    const list = await exec.run(
      `${PROBE_PATH_PREFIX} tmux list-sessions -F ${fmt} 2>/dev/null`
    )
    const sessions = parseTmuxListOutput(list.stdout)
    return { kind: 'tmux', installed: true, path, sessions }
  },

  buildAttachCmd(target: string, opts: AttachOptions): string {
    const create = opts.createIfMissing ?? true
    const shell = opts.shell ? ` ${shellQuote(opts.shell)}` : ''
    const bin = opts.binaryPath ? shellQuote(opts.binaryPath) : 'tmux'
    // `set -g mouse off` is server-global, but `set -t <target> mouse off`
    // pins the override to this session so user defaults elsewhere are not
    // disturbed. The chain runs before attach so the override is in effect
    // by the time xterm starts dispatching mouse events.
    const mouseOff = opts.disableMouseCapture
      ? `${bin} set-option -t ${shellQuote(target)} -q mouse off >/dev/null 2>&1; `
      : ''
    if (create) {
      // new-session -A: attach if exists, create otherwise.
      return `${mouseOff}${bin} new-session -A -s ${shellQuote(target)}${shell}`
    }
    return `${mouseOff}${bin} attach-session -t ${shellQuote(target)}`
  },

  async killSession(exec: RemoteExecutor, target: string): Promise<void> {
    await exec.run(
      `${PROBE_PATH_PREFIX} tmux kill-session -t ${shellQuote(target)} >/dev/null 2>&1`
    )
  },

  async cleanStale(_exec: RemoteExecutor, _opts: ProbeOptions): Promise<number> {
    return 0
  }
}

export function parseTmuxListOutput(stdout: string): MultiplexerSession[] {
  const sessions: MultiplexerSession[] = []
  for (const raw of stdout.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split('|')
    if (parts.length < 2) continue
    const [name, attachedStr, createdStr] = parts
    sessions.push({
      name,
      target: name,
      alive: true,
      attached: attachedStr !== '0',
      createdAt: createdStr ? parseInt(createdStr, 10) || undefined : undefined
    })
  }
  return sessions
}
