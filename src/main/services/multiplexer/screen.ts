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

/**
 * GNU screen backend. Sessions are keyed by NAME (as tmux/zellij are) even though
 * `screen -ls` prints `<pid>.<name>` — screen accepts a unique name for
 * `-r`/`-x`/`-X`, and keeping `target === name` keeps the remote alias store keys
 * stable between create-time and probe-time. Bifrost generates unique names, so a
 * genuinely duplicated name is the documented edge case.
 */
export const screen: Multiplexer = {
  kind: 'screen',

  async probe(exec: RemoteExecutor, _opts: ProbeOptions): Promise<ProbeResult> {
    const which = await exec.run(`${PROBE_PATH_PREFIX} command -v screen 2>/dev/null`)
    const path = which.stdout.trim().split('\n')[0]
    if (which.code !== 0 || !path) {
      return { kind: 'screen', installed: false, sessions: [] }
    }
    // `screen -ls` returns a non-zero exit code even when sessions exist, so we
    // key off stdout, not the code.
    const list = await exec.run(`${PROBE_PATH_PREFIX} screen -ls 2>/dev/null`)
    const sessions = parseScreenListOutput(list.stdout)
    return { kind: 'screen', installed: true, path, sessions }
  },

  buildAttachCmd(target: string, opts: AttachOptions): string {
    const create = opts.createIfMissing ?? true
    const bin = opts.binaryPath ? shellQuote(opts.binaryPath) : 'screen'
    const shell = opts.shell ? ` ${shellQuote(opts.shell)}` : ''
    // screen's rc file is `-c <file>`. layout + disableMouseCapture don't apply.
    const cfg = opts.configFile?.trim() ? ` -c ${dquote(opts.configFile.trim())}` : ''
    const globalArgs = `${cfg}${extraArgsFragment(opts.extraArgs)}`
    if (create) {
      // -D -R: reattach the named session (detaching a stale client) or create
      // it — the `tmux new-session -A` analog. -S sets the session name.
      return `${bin}${globalArgs} -D -R -S ${shellQuote(target)}${shell}`
    }
    // -x: multi-display attach, works whether the session is detached or attached.
    return `${bin}${globalArgs} -x ${shellQuote(target)}`
  },

  async killSession(exec: RemoteExecutor, target: string): Promise<void> {
    await exec.run(
      `${PROBE_PATH_PREFIX} screen -S ${shellQuote(target)} -X quit >/dev/null 2>&1`
    )
  },

  async cleanStale(exec: RemoteExecutor, _opts: ProbeOptions): Promise<number> {
    const res = await exec.run(`${PROBE_PATH_PREFIX} screen -wipe 2>/dev/null`)
    const m = res.stdout.match(/(\d+)\s+sockets?\s+wiped/i)
    return m ? parseInt(m[1], 10) || 0 : 0
  }
}

export function parseScreenListOutput(stdout: string): MultiplexerSession[] {
  const sessions: MultiplexerSession[] = []
  for (const raw of stdout.split('\n')) {
    const line = raw.trim()
    // e.g. "12345.mysession  (Detached)"  /  "12346.other  (Attached)"
    //      "12347.dead       (Dead ???)"
    const m = line.match(/^(\d+)\.(\S+)\s+\((Attached|Detached|Dead[^)]*)\)/)
    if (!m) continue
    const state = m[3]
    const dead = /^Dead/i.test(state)
    sessions.push({
      name: m[2],
      target: m[2],
      alive: !dead,
      attached: /^Attached/i.test(state),
      state: dead ? 'stale' : 'alive'
    })
  }
  return sessions
}
