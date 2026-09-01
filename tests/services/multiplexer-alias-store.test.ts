import { describe, it, expect } from 'vitest'
import {
  readAliases,
  writeAlias,
  pruneAliases,
  enrichWithAliases
} from '../../src/main/services/multiplexer/alias-store'
import type { ProbeResult, RemoteExecutor } from '../../src/main/services/multiplexer/types'

/**
 * A fake remote host holding a single sidecar file in memory. `cat` returns it
 * (or exit 1 when absent); the `printf %s '<json>' > tmp && mv` write path is
 * parsed back into the stored file so read-modify-write round-trips faithfully.
 */
function fakeHost(initial: string | null = null): {
  exec: RemoteExecutor
  file: () => string | null
  reads: number
  writes: number
  set: (v: string | null) => void
} {
  const state = { file: initial, reads: 0, writes: 0 }
  const exec: RemoteExecutor = {
    run: async (cmd: string) => {
      if (cmd.startsWith('cat ')) {
        state.reads++
        if (state.file == null) return { stdout: '', stderr: '', code: 0 }
        return { stdout: state.file, stderr: '', code: 0 }
      }
      const m = cmd.match(
        /printf %s '([\s\S]*)' > \$HOME\/\.config\/bifrost\/session-aliases\.json\.tmp/
      )
      if (m) {
        state.writes++
        state.file = m[1].replace(/'\\''/g, "'")
        return { stdout: '', stderr: '', code: 0 }
      }
      return { stdout: '', stderr: '', code: 0 }
    }
  }
  return {
    exec,
    file: () => state.file,
    get reads() {
      return state.reads
    },
    get writes() {
      return state.writes
    },
    set: (v) => {
      state.file = v
    }
  }
}

const session = (target: string, alias?: string) => ({
  name: target,
  target,
  alive: true,
  attached: false,
  ...(alias ? { alias } : {})
})

const probeResult = (over: Partial<ProbeResult>): ProbeResult => ({
  kind: 'tmux',
  installed: true,
  sessions: [],
  ...over
})

describe('alias-store: readAliases', () => {
  it('returns {} when the file is absent', async () => {
    const h = fakeHost(null)
    expect(await readAliases(h.exec)).toEqual({})
  })

  it('returns {} on invalid JSON', async () => {
    const h = fakeHost('{ not json')
    expect(await readAliases(h.exec)).toEqual({})
  })

  it('returns {} when the stored JSON is an array, not an object', async () => {
    const h = fakeHost('[1,2,3]')
    expect(await readAliases(h.exec)).toEqual({})
  })

  it('parses a valid map', async () => {
    const h = fakeHost(JSON.stringify({ tmux: { work: 'Deploy prod' } }))
    expect(await readAliases(h.exec)).toEqual({ tmux: { work: 'Deploy prod' } })
  })
})

describe('alias-store: writeAlias', () => {
  it('creates the store and the entry when nothing exists', async () => {
    const h = fakeHost(null)
    const ok = await writeAlias(h.exec, 'tmux', 'work', 'Deploy prod')
    expect(ok).toBe(true)
    expect(JSON.parse(h.file()!)).toEqual({ tmux: { work: 'Deploy prod' } })
  })

  it('adds a new target without clobbering existing ones', async () => {
    const h = fakeHost(JSON.stringify({ tmux: { a: 'A' } }))
    await writeAlias(h.exec, 'tmux', 'b', 'B')
    expect(JSON.parse(h.file()!)).toEqual({ tmux: { a: 'A', b: 'B' } })
  })

  it('overwrites an existing alias and keeps other backends', async () => {
    const h = fakeHost(JSON.stringify({ tmux: { a: 'Old' }, dtach: { s: 'D' } }))
    await writeAlias(h.exec, 'tmux', 'a', 'New')
    expect(JSON.parse(h.file()!)).toEqual({ tmux: { a: 'New' }, dtach: { s: 'D' } })
  })

  it('round-trips an alias containing a single quote', async () => {
    const h = fakeHost(null)
    await writeAlias(h.exec, 'dtach', '/x/y.sock', "Jimmy's box")
    expect(JSON.parse(h.file()!)).toEqual({ dtach: { '/x/y.sock': "Jimmy's box" } })
  })
})

describe('alias-store: pruneAliases', () => {
  it('drops entries whose target is not live', async () => {
    const h = fakeHost(JSON.stringify({ tmux: { keep: 'K', dead: 'D' } }))
    await pruneAliases(h.exec, 'tmux', ['keep'])
    expect(JSON.parse(h.file()!)).toEqual({ tmux: { keep: 'K' } })
  })

  it('removes the backend key entirely when nothing survives', async () => {
    const h = fakeHost(JSON.stringify({ tmux: { dead: 'D' }, dtach: { s: 'D' } }))
    await pruneAliases(h.exec, 'tmux', [])
    expect(JSON.parse(h.file()!)).toEqual({ dtach: { s: 'D' } })
  })

  it('does not write when nothing changes', async () => {
    const h = fakeHost(JSON.stringify({ tmux: { keep: 'K' } }))
    await pruneAliases(h.exec, 'tmux', ['keep'])
    expect(h.writes).toBe(0)
  })

  it('is a no-op when the backend has no entries', async () => {
    const h = fakeHost(JSON.stringify({ dtach: { s: 'D' } }))
    await pruneAliases(h.exec, 'tmux', ['whatever'])
    expect(h.writes).toBe(0)
  })
})

describe('alias-store: enrichWithAliases', () => {
  it('attaches aliases to matching sessions and prunes dead targets', async () => {
    const h = fakeHost(JSON.stringify({ tmux: { live: 'My name', gone: 'Stale' } }))
    const result = probeResult({ sessions: [session('live'), session('other')] })
    await enrichWithAliases(h.exec, result)
    expect(result.sessions.find((s) => s.target === 'live')?.alias).toBe('My name')
    expect(result.sessions.find((s) => s.target === 'other')?.alias).toBeUndefined()
    // 'gone' was not live → pruned from the store
    expect(JSON.parse(h.file()!)).toEqual({ tmux: { live: 'My name' } })
  })

  it('does nothing when the multiplexer is not installed', async () => {
    const h = fakeHost(JSON.stringify({ tmux: { a: 'A' } }))
    const result = probeResult({ installed: false, sessions: [session('a')] })
    await enrichWithAliases(h.exec, result)
    expect(result.sessions[0].alias).toBeUndefined()
    expect(h.reads).toBe(0)
    expect(h.writes).toBe(0)
  })

  it('does not prune when the probe reported a listing error', async () => {
    const h = fakeHost(JSON.stringify({ tmux: { a: 'A', b: 'B' } }))
    const result = probeResult({ error: 'permission denied', sessions: [session('a')] })
    await enrichWithAliases(h.exec, result)
    // no read, no prune — the store keeps both entries
    expect(JSON.parse(h.file()!)).toEqual({ tmux: { a: 'A', b: 'B' } })
    expect(h.writes).toBe(0)
  })
})
