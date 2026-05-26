import { describe, it, expect } from 'vitest'
import { dtach, parseDtachListOutput } from '../../src/main/services/multiplexer/dtach'
import { tmux, parseTmuxListOutput } from '../../src/main/services/multiplexer/tmux'
import { zellij, parseZellijListOutput } from '../../src/main/services/multiplexer/zellij'
import { rmux } from '../../src/main/services/multiplexer/rmux'
import { shellQuote, type RemoteExecutor } from '../../src/main/services/multiplexer/types'

function fakeExecutor(
  responses: Array<{
    match: RegExp | string
    stdout?: string
    stderr?: string
    code?: number
  }>
): { exec: RemoteExecutor; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    exec: {
      run: async (cmd: string) => {
        calls.push(cmd)
        for (const r of responses) {
          const matches =
            r.match instanceof RegExp ? r.match.test(cmd) : cmd.includes(r.match)
          if (matches) {
            return {
              stdout: r.stdout ?? '',
              stderr: r.stderr ?? '',
              code: r.code ?? 0
            }
          }
        }
        return { stdout: '', stderr: '', code: 0 }
      }
    }
  }
}

describe('shellQuote', () => {
  it('quotes simple strings', () => {
    expect(shellQuote('foo')).toBe(`'foo'`)
  })
  it('escapes single quotes', () => {
    expect(shellQuote(`it's`)).toBe(`'it'\\''s'`)
  })
  it('preserves spaces and slashes', () => {
    expect(shellQuote('/tmp/my session.sock')).toBe(`'/tmp/my session.sock'`)
  })
})

describe('dtach.buildAttachCmd', () => {
  it('uses -A when create-if-missing (default) and ensures parent dir', () => {
    const cmd = dtach.buildAttachCmd('/home/u/.dtach/work.sock', {})
    expect(cmd).toContain('mkdir -p')
    expect(cmd).toContain('dtach -A')
    expect(cmd).toContain(`"/home/u/.dtach/work.sock"`)
    expect(cmd).toContain('"$SHELL"')
    expect(cmd).toContain('-E -z')
  })
  it('uses -a when not creating and skips mkdir', () => {
    const cmd = dtach.buildAttachCmd('/tmp/x.sock', { createIfMissing: false })
    expect(cmd).toMatch(/^dtach -a/)
    expect(cmd).not.toContain('mkdir')
    expect(cmd).not.toContain('"$SHELL"')
  })
  it('honors a custom shell', () => {
    const cmd = dtach.buildAttachCmd('/tmp/x.sock', { shell: '/bin/zsh' })
    expect(cmd).toContain('/bin/zsh')
  })
  it('preserves $HOME so the remote shell expands it', () => {
    const cmd = dtach.buildAttachCmd('$HOME/.dtach/work.sock', {})
    // $ must not be escaped — otherwise it would arrive as literal $HOME
    expect(cmd).toContain(`"$HOME/.dtach/work.sock"`)
    expect(cmd).not.toContain('\\$HOME')
  })
  it('escapes characters that would break the double-quoted string', () => {
    const cmd = dtach.buildAttachCmd(`/tmp/with"quote.sock`, { createIfMissing: false })
    expect(cmd).toContain(`"/tmp/with\\"quote.sock"`)
  })
})

describe('parseDtachListOutput', () => {
  it('parses alive and stale sockets', () => {
    const stdout = [
      '/home/u/.dtach/alpha.sock|1',
      '/home/u/.dtach/beta.sock|0',
      ''
    ].join('\n')
    const sessions = parseDtachListOutput(stdout)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({ name: 'alpha', alive: true, attached: false })
    expect(sessions[1]).toMatchObject({ name: 'beta', alive: false })
  })
  it('handles paths containing | by using lastIndexOf', () => {
    const stdout = '/weird|path/socket.sock|1\n'
    const sessions = parseDtachListOutput(stdout)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].target).toBe('/weird|path/socket.sock')
    expect(sessions[0].alive).toBe(true)
  })
  it('skips empty and malformed lines', () => {
    const stdout = '\n\nbroken-no-pipe\n/x/y.sock|1\n'
    const sessions = parseDtachListOutput(stdout)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].name).toBe('y')
  })
})

describe('dtach.probe', () => {
  it('returns installed=false when binary missing', async () => {
    const { exec } = fakeExecutor([
      { match: /command -v dtach/, stdout: '', code: 1 }
    ])
    const result = await dtach.probe(exec, {})
    expect(result.installed).toBe(false)
    expect(result.sessions).toEqual([])
  })
  it('parses live sessions when installed', async () => {
    const { exec, calls } = fakeExecutor([
      { match: /command -v dtach/, stdout: '/usr/bin/dtach\n' },
      { match: /for s in/, stdout: '/tmp/d/a.sock|1\n/tmp/d/b.sock|0\n' }
    ])
    const result = await dtach.probe(exec, { socketDir: '/tmp/d' })
    expect(result.installed).toBe(true)
    expect(result.path).toBe('/usr/bin/dtach')
    expect(result.sessions).toHaveLength(2)
    expect(result.sessions[0]).toMatchObject({ name: 'a', alive: true })
    expect(result.sessions[1]).toMatchObject({ name: 'b', alive: false })
    expect(calls[1]).toContain('mkdir -p /tmp/d')
  })
})

describe('dtach.cleanStale', () => {
  it('returns the count printed by the script', async () => {
    const { exec } = fakeExecutor([
      { match: /removed=0/, stdout: '3\n' }
    ])
    const removed = await dtach.cleanStale(exec, { socketDir: '/x' })
    expect(removed).toBe(3)
  })
  it('returns 0 when output is unparseable', async () => {
    const { exec } = fakeExecutor([
      { match: /removed=0/, stdout: 'oops\n' }
    ])
    expect(await dtach.cleanStale(exec, {})).toBe(0)
  })
})

describe('tmux.buildAttachCmd', () => {
  it('uses new-session -A by default', () => {
    const cmd = tmux.buildAttachCmd('work', {})
    expect(cmd).toBe(`tmux new-session -A -s 'work'`)
  })
  it('uses attach-session when not creating', () => {
    expect(tmux.buildAttachCmd('work', { createIfMissing: false })).toBe(
      `tmux attach-session -t 'work'`
    )
  })
  it('appends a custom shell when creating', () => {
    expect(tmux.buildAttachCmd('work', { shell: '/bin/fish' })).toBe(
      `tmux new-session -A -s 'work' '/bin/fish'`
    )
  })
})

describe('parseTmuxListOutput', () => {
  it('parses name|attached|created', () => {
    const stdout = ['main|1|1700000000', 'logs|0|1700000100'].join('\n')
    const sessions = parseTmuxListOutput(stdout)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({
      name: 'main',
      target: 'main',
      alive: true,
      attached: true,
      createdAt: 1700000000
    })
    expect(sessions[1]).toMatchObject({ name: 'logs', attached: false })
  })
  it('ignores blank and short lines', () => {
    const stdout = '\nmain\nfoo|1|123\n'
    const sessions = parseTmuxListOutput(stdout)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].name).toBe('foo')
  })
})

describe('zellij.buildAttachCmd', () => {
  it('uses attach --create by default', () => {
    expect(zellij.buildAttachCmd('work', {})).toBe(`zellij attach --create 'work'`)
  })
  it('uses plain attach when not creating', () => {
    expect(zellij.buildAttachCmd('work', { createIfMissing: false })).toBe(
      `zellij attach 'work'`
    )
  })
  it('appends --force-run-commands when requested', () => {
    expect(zellij.buildAttachCmd('work', { forceRunCommands: true })).toBe(
      `zellij attach --create --force-run-commands 'work'`
    )
  })
  it('combines no-create + force-run', () => {
    expect(
      zellij.buildAttachCmd('work', { createIfMissing: false, forceRunCommands: true })
    ).toBe(`zellij attach --force-run-commands 'work'`)
  })
  it('quotes names with spaces or quotes', () => {
    expect(zellij.buildAttachCmd(`it's a test`, {})).toContain(`'it'\\''s a test'`)
  })
})

describe('parseZellijListOutput', () => {
  it('parses alive sessions with creation metadata', () => {
    const stdout = [
      'session-a [Created 2 hours ago]',
      'session-b [Created 30 minutes ago]'
    ].join('\n')
    const sessions = parseZellijListOutput(stdout)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({ name: 'session-a', alive: true, state: 'alive' })
    expect(sessions[1]).toMatchObject({ name: 'session-b', alive: true })
  })

  it('detects exited sessions via the EXITED marker', () => {
    const stdout = [
      'session-a [Created 2 hours ago]',
      'old-session [EXITED - 3 hours ago]'
    ].join('\n')
    const sessions = parseZellijListOutput(stdout)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({ name: 'session-a', alive: true, state: 'alive' })
    expect(sessions[1]).toMatchObject({ name: 'old-session', alive: false, state: 'exited' })
  })

  it('marks (current) sessions as attached but still alive', () => {
    const stdout = 'session-a [Created 5 minutes ago] (current)'
    const sessions = parseZellijListOutput(stdout)
    expect(sessions[0]).toMatchObject({
      name: 'session-a',
      alive: true,
      attached: true,
      state: 'alive'
    })
  })

  it('is case-insensitive about EXITED to survive minor format drift', () => {
    expect(parseZellijListOutput('s [Exited - 1 hour ago]')[0].state).toBe('exited')
    expect(parseZellijListOutput('s [exited]')[0].state).toBe('exited')
  })

  it('skips empty lines and lines with no name', () => {
    const stdout = '\n\n  \nsession-a [Created]\n'
    const sessions = parseZellijListOutput(stdout)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].name).toBe('session-a')
  })
})

describe('zellij.probe', () => {
  it('returns installed=false when binary missing', async () => {
    const { exec } = fakeExecutor([{ match: /command -v zellij/, code: 1 }])
    const r = await zellij.probe(exec, {})
    expect(r.installed).toBe(false)
    expect(r.sessions).toEqual([])
  })

  it('parses mixed alive + exited output when installed', async () => {
    const { exec } = fakeExecutor([
      { match: /command -v zellij/, stdout: '/usr/bin/zellij\n' },
      {
        match: /list-sessions/,
        stdout: 'live-one [Created 1 hour ago]\nold-one [EXITED - 2 hours ago]\n'
      }
    ])
    const r = await zellij.probe(exec, {})
    expect(r.installed).toBe(true)
    expect(r.sessions).toHaveLength(2)
    expect(r.sessions[0].alive).toBe(true)
    expect(r.sessions[1].state).toBe('exited')
  })
})

describe('zellij.cleanStale', () => {
  it('deletes only exited sessions and returns the count', async () => {
    const calls: string[] = []
    const exec: RemoteExecutor = {
      run: async (cmd: string) => {
        calls.push(cmd)
        if (cmd.includes('list-sessions')) {
          return {
            stdout: 'alive-a [Created 1 hour ago]\nexited-b [EXITED]\nexited-c [EXITED]\n',
            stderr: '',
            code: 0
          }
        }
        return { stdout: '', stderr: '', code: 0 }
      }
    }
    const removed = await zellij.cleanStale(exec, {})
    expect(removed).toBe(2)
    const deleteCalls = calls.filter((c) => c.includes('delete-session'))
    expect(deleteCalls).toHaveLength(2)
    expect(deleteCalls[0]).toContain(`'exited-b'`)
    expect(deleteCalls[1]).toContain(`'exited-c'`)
    // Alive session must NOT be touched
    expect(calls.some((c) => c.includes('delete-session') && c.includes('alive-a'))).toBe(false)
  })
})

describe('rmux.buildAttachCmd', () => {
  it('uses new-session -A by default (tmux-compatible CLI)', () => {
    expect(rmux.buildAttachCmd('work', {})).toBe(`rmux new-session -A -s 'work'`)
  })
  it('uses attach-session when not creating', () => {
    expect(rmux.buildAttachCmd('work', { createIfMissing: false })).toBe(
      `rmux attach-session -t 'work'`
    )
  })
  it('appends a custom shell when creating', () => {
    expect(rmux.buildAttachCmd('work', { shell: '/bin/fish' })).toBe(
      `rmux new-session -A -s 'work' '/bin/fish'`
    )
  })
  it('prefixes set-option mouse off when disableMouseCapture is set', () => {
    const cmd = rmux.buildAttachCmd('work', { disableMouseCapture: true })
    expect(cmd).toContain(`rmux set-option -t 'work' -q mouse off`)
    expect(cmd).toContain(`rmux new-session -A -s 'work'`)
  })
  it('uses the absolute binary path when provided', () => {
    const cmd = rmux.buildAttachCmd('work', { binaryPath: '/home/u/.cargo/bin/rmux' })
    expect(cmd).toBe(`'/home/u/.cargo/bin/rmux' new-session -A -s 'work'`)
  })
})

describe('rmux.probe', () => {
  it('returns installed=false when binary missing', async () => {
    const { exec } = fakeExecutor([{ match: /command -v rmux/, code: 1 }])
    const r = await rmux.probe(exec, {})
    expect(r.installed).toBe(false)
    expect(r.sessions).toEqual([])
  })
  it('parses listed sessions using the tmux output format', async () => {
    const { exec } = fakeExecutor([
      { match: /command -v rmux/, stdout: '/home/u/.cargo/bin/rmux\n' },
      { match: /list-sessions/, stdout: 'main|0|1700000000\nlogs|1|1700000100\n' }
    ])
    const r = await rmux.probe(exec, {})
    expect(r.installed).toBe(true)
    expect(r.path).toBe('/home/u/.cargo/bin/rmux')
    expect(r.sessions).toHaveLength(2)
    expect(r.sessions[0]).toMatchObject({ name: 'main', alive: true, attached: false })
    expect(r.sessions[1]).toMatchObject({ name: 'logs', attached: true })
  })
})

describe('tmux.probe', () => {
  it('returns installed=false when missing', async () => {
    const { exec } = fakeExecutor([{ match: /command -v tmux/, code: 1 }])
    const result = await tmux.probe(exec, {})
    expect(result.installed).toBe(false)
  })
  it('parses listed sessions', async () => {
    const { exec } = fakeExecutor([
      { match: /command -v tmux/, stdout: '/usr/bin/tmux\n' },
      { match: /list-sessions/, stdout: 'main|0|1700000000\n' }
    ])
    const result = await tmux.probe(exec, {})
    expect(result.installed).toBe(true)
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0].alive).toBe(true)
  })
})
