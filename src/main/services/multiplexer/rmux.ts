import {
  shellQuote,
  dquote,
  extraArgsFragment,
  PROBE_PATH_PREFIX,
  type AttachOptions,
  type Multiplexer,
  type ProbeOptions,
  type ProbeResult,
  type RemoteExecutor
} from './types'
import { parseTmuxListOutput } from './tmux'

/**
 * rmux — universal Rust multiplexer with a tmux-compatible CLI.
 * https://github.com/Helvesec/rmux
 *
 * Because the CLI mirrors tmux's surface (new-session, attach-session,
 * list-sessions -F, kill-session, set-option mouse off), we reuse the
 * tmux output parser instead of duplicating it.
 */
export const rmux: Multiplexer = {
  kind: 'rmux',

  async probe(exec: RemoteExecutor, _opts: ProbeOptions): Promise<ProbeResult> {
    const which = await exec.run(`${PROBE_PATH_PREFIX} command -v rmux 2>/dev/null`)
    const path = which.stdout.trim().split('\n')[0]
    if (which.code !== 0 || !path) {
      return { kind: 'rmux', installed: false, sessions: [] }
    }

    const fmt = `"#{session_name}|#{session_attached}|#{session_created}"`
    const list = await exec.run(
      `${PROBE_PATH_PREFIX} rmux list-sessions -F ${fmt} 2>/dev/null`
    )
    const sessions = parseTmuxListOutput(list.stdout)
    return { kind: 'rmux', installed: true, path, sessions }
  },

  buildAttachCmd(target: string, opts: AttachOptions): string {
    const create = opts.createIfMissing ?? true
    const shell = opts.shell ? ` ${shellQuote(opts.shell)}` : ''
    const bin = opts.binaryPath ? shellQuote(opts.binaryPath) : 'rmux'
    const mouseOff = opts.disableMouseCapture
      ? `${bin} set-option -t ${shellQuote(target)} -q mouse off >/dev/null 2>&1; `
      : ''
    // tmux-compatible CLI: -f <config> and extra args go before the subcommand;
    // no layout flag, so `layout` is ignored. Applied on create & attach.
    const cfg = opts.configFile?.trim() ? ` -f ${dquote(opts.configFile.trim())}` : ''
    const globalArgs = `${cfg}${extraArgsFragment(opts.extraArgs)}`
    if (create) {
      return `${mouseOff}${bin}${globalArgs} new-session -A -s ${shellQuote(target)}${shell}`
    }
    return `${mouseOff}${bin}${globalArgs} attach-session -t ${shellQuote(target)}`
  },

  async killSession(exec: RemoteExecutor, target: string): Promise<void> {
    await exec.run(
      `${PROBE_PATH_PREFIX} rmux kill-session -t ${shellQuote(target)} >/dev/null 2>&1`
    )
  },

  async cleanStale(_exec: RemoteExecutor, _opts: ProbeOptions): Promise<number> {
    return 0
  }
}
