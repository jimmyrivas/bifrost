import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// The hop fixtures use agent auth and the stale-socket guard checks that
// SSH_AUTH_SOCK points at an existing file. Give the whole suite its own
// fake socket so tests don't depend on the host's agent (absent in CI).
let agentEnvDir: string
let prevAgentSock: string | undefined
beforeAll(() => {
  agentEnvDir = mkdtempSync(join(tmpdir(), 'bifrost-agent-env-'))
  const sock = join(agentEnvDir, 'agent.sock')
  writeFileSync(sock, '')
  prevAgentSock = process.env.SSH_AUTH_SOCK
  process.env.SSH_AUTH_SOCK = sock
})
afterAll(() => {
  if (prevAgentSock === undefined) delete process.env.SSH_AUTH_SOCK
  else process.env.SSH_AUTH_SOCK = prevAgentSock
  rmSync(agentEnvDir, { recursive: true, force: true })
})
import {
  buildHopConnectConfig,
  establishJumpChain,
  type ChainClient
} from '../../src/main/services/jump-host/chain'
import type { ResolvedHop } from '../../src/main/services/jump-host/types'
import type { Socket } from 'net'
import type { ConnectConfig } from 'ssh2'

// === Mock client ============================================================

interface MockClientOptions {
  /** When true, the client emits 'error' instead of 'ready' on connect. */
  failConnect?: string
  /** When true, forwardOut returns an error on the next call. */
  failForward?: string
}

function makeMockClient(options: MockClientOptions = {}): ChainClient & {
  __log: string[]
  __config?: ConnectConfig
  __ended: boolean
} {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  const log: string[] = []
  const client = {
    __log: log,
    __config: undefined as ConnectConfig | undefined,
    __ended: false,
    on(event: string, listener: (...args: unknown[]) => void) {
      const arr = listeners.get(event) ?? []
      arr.push(listener)
      listeners.set(event, arr)
      return this
    },
    once(event: string, listener: (...args: unknown[]) => void) {
      return this.on(event, listener)
    },
    connect(config: ConnectConfig) {
      this.__config = config
      log.push(`connect ${config.host}:${config.port}${config.sock ? ' (via sock)' : ''}`)
      // Fire async to mimic real ssh2.
      setImmediate(() => {
        if (options.failConnect) {
          ;(listeners.get('error') ?? []).forEach((l) => l(new Error(options.failConnect!)))
        } else {
          ;(listeners.get('ready') ?? []).forEach((l) => l())
        }
      })
      return this
    },
    forwardOut(srcIP, srcPort, dstIP, dstPort, cb) {
      log.push(`forwardOut ${dstIP}:${dstPort}`)
      setImmediate(() => {
        if (options.failForward) {
          cb(new Error(options.failForward), undefined as unknown as Socket)
        } else {
          // Fake stream: any object accepted by ssh2 as `sock`.
          const fakeStream = { __mockStream: `${dstIP}:${dstPort}` } as unknown as Socket
          cb(undefined, fakeStream)
        }
      })
      return this
    },
    end() {
      this.__ended = true
      log.push('end')
      return this
    }
  }
  return client as typeof client & ChainClient
}

const hopA: ResolvedHop = {
  host: 'bastion-a',
  port: 22,
  username: 'jumper',
  authType: 'agent'
}
const hopB: ResolvedHop = {
  host: 'bastion-b',
  port: 2222,
  username: 'jumper',
  authType: 'agent'
}
const hopC: ResolvedHop = {
  host: 'bastion-c',
  port: 22,
  username: 'jumper',
  authType: 'agent'
}
const target = { host: 'target.example', port: 22 }

// === Tests ==================================================================

describe('buildHopConnectConfig', () => {
  it('passes through host, port, username, readyTimeout', () => {
    const cc = buildHopConnectConfig({ ...hopA, authType: 'agent' }, undefined)
    expect(cc).toMatchObject({
      host: 'bastion-a',
      port: 22,
      username: 'jumper',
      readyTimeout: 30000
    })
  })

  it('attaches the upstream sock when provided', () => {
    const sock = { __id: 'sock-1' } as unknown as Socket
    const cc = buildHopConnectConfig(hopA, sock)
    expect(cc.sock).toBe(sock)
  })

  it('sets password for userpass auth', () => {
    const cc = buildHopConnectConfig(
      { ...hopA, authType: 'userpass', password: 'secret' },
      undefined
    )
    expect(cc.password).toBe('secret')
  })

  it('reads private key from disk for key auth (via injected reader)', () => {
    const reader = vi.fn().mockReturnValue(Buffer.from('FAKE-KEY'))
    const cc = buildHopConnectConfig(
      { ...hopA, authType: 'key', privateKeyPath: '/keys/id_rsa' },
      undefined,
      { readKeyFile: reader }
    )
    expect(reader).toHaveBeenCalledWith('/keys/id_rsa')
    expect(cc.privateKey).toEqual(Buffer.from('FAKE-KEY'))
  })

  it('attaches passphrase for key_pass auth', () => {
    const reader = vi.fn().mockReturnValue(Buffer.from('K'))
    const cc = buildHopConnectConfig(
      {
        ...hopA,
        authType: 'key_pass',
        privateKeyPath: '/k',
        passphrase: 'pp'
      },
      undefined,
      { readKeyFile: reader }
    )
    expect(cc.privateKey).toEqual(Buffer.from('K'))
    expect(cc.passphrase).toBe('pp')
  })

  it('throws a descriptive error when the key file cannot be read', () => {
    const reader = vi.fn().mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(() =>
      buildHopConnectConfig(
        { ...hopA, authType: 'key', privateKeyPath: '/missing' },
        undefined,
        { readKeyFile: reader }
      )
    ).toThrow(/Cannot read jump-host key \/missing.*ENOENT/)
  })

  it('uses agent socket env when authType=agent and SSH_AUTH_SOCK is set', () => {
    // The stale-socket guard checks existsSync, so point at a real temp file.
    const dir = mkdtempSync(join(tmpdir(), 'bifrost-agent-'))
    const sockPath = join(dir, 'agent.sock')
    writeFileSync(sockPath, '')
    const prev = process.env.SSH_AUTH_SOCK
    process.env.SSH_AUTH_SOCK = sockPath
    try {
      const cc = buildHopConnectConfig({ ...hopA, authType: 'agent' }, undefined)
      expect(cc.agent).toBe(sockPath)
    } finally {
      if (prev === undefined) delete process.env.SSH_AUTH_SOCK
      else process.env.SSH_AUTH_SOCK = prev
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects agent auth when SSH_AUTH_SOCK points to a missing socket', () => {
    const prev = process.env.SSH_AUTH_SOCK
    process.env.SSH_AUTH_SOCK = '/nonexistent/agent.sock'
    try {
      expect(() =>
        buildHopConnectConfig({ ...hopA, authType: 'agent' }, undefined)
      ).toThrow(/socket inexistente/)
    } finally {
      if (prev === undefined) delete process.env.SSH_AUTH_SOCK
      else process.env.SSH_AUTH_SOCK = prev
    }
  })

  it('wires hostVerifier to TOFU hooks when provided', () => {
    const hooks = {
      hostKey: vi.fn(() => 'k'),
      computeFingerprint: vi.fn(() => 'fp1'),
      loadKnownHosts: vi.fn(() => ({})),
      storeHostKey: vi.fn()
    }
    const cc = buildHopConnectConfig(hopA, undefined, { hostKeyHooks: hooks })
    const verify = cc.hostVerifier as (k: Buffer) => boolean
    const accepted = verify(Buffer.from('keymat'))
    expect(accepted).toBe(true)
    expect(hooks.storeHostKey).toHaveBeenCalled()
  })

  it('hostVerifier rejects on fingerprint mismatch', () => {
    const hooks = {
      hostKey: vi.fn(() => 'k'),
      computeFingerprint: vi.fn(() => 'NEW'),
      loadKnownHosts: vi.fn(() => ({ k: { fingerprint: 'OLD' } })),
      storeHostKey: vi.fn()
    }
    const cc = buildHopConnectConfig(hopA, undefined, { hostKeyHooks: hooks })
    const verify = cc.hostVerifier as (k: Buffer) => boolean
    expect(verify(Buffer.from('x'))).toBe(false)
  })
})

describe('establishJumpChain — happy path', () => {
  it('connects a single hop and forwards to the final target', async () => {
    const c = makeMockClient()
    const factory = () => c
    const result = await establishJumpChain([hopA], target, { factory })
    expect(result.clients).toHaveLength(1)
    expect(c.__log).toEqual([
      'connect bastion-a:22',
      'forwardOut target.example:22'
    ])
  })

  it('chains 3 hops, passing the upstream sock to each subsequent client', async () => {
    const c1 = makeMockClient()
    const c2 = makeMockClient()
    const c3 = makeMockClient()
    const queue = [c1, c2, c3]
    const factory = () => queue.shift()!
    const result = await establishJumpChain([hopA, hopB, hopC], target, { factory })

    expect(result.clients).toHaveLength(3)
    // Each forwardOut targets the NEXT hop, except the last which targets the
    // final target.
    expect(c1.__log).toEqual(['connect bastion-a:22', 'forwardOut bastion-b:2222'])
    expect(c2.__log).toEqual([
      'connect bastion-b:2222 (via sock)',
      'forwardOut bastion-c:22'
    ])
    expect(c3.__log).toEqual([
      'connect bastion-c:22 (via sock)',
      'forwardOut target.example:22'
    ])
  })
})

describe('establishJumpChain — failure cleanup', () => {
  it('rejects with a hop-prefixed error when a hop fails to connect', async () => {
    const c1 = makeMockClient({ failConnect: 'authentication failed' })
    const factory = () => c1
    await expect(establishJumpChain([hopA], target, { factory })).rejects.toThrow(
      /hop 1 \(bastion-a:22\): authentication failed/
    )
  })

  it('closes earlier hops when a later hop fails to connect', async () => {
    const c1 = makeMockClient()
    const c2 = makeMockClient({ failConnect: 'timeout' })
    const queue = [c1, c2]
    const factory = () => queue.shift()!

    await expect(establishJumpChain([hopA, hopB], target, { factory })).rejects.toThrow(
      /hop 2.*timeout/
    )
    expect(c1.__ended).toBe(true)
  })

  it('closes all hops when forwardOut to the final target fails', async () => {
    const c1 = makeMockClient({ failForward: 'connection refused' })
    const factory = () => c1
    await expect(establishJumpChain([hopA], target, { factory })).rejects.toThrow(
      /forward via hop 1 to target.example:22 failed: connection refused/
    )
    expect(c1.__ended).toBe(true)
  })

  it('rejects an empty chain (would otherwise yield no upstream sock)', async () => {
    await expect(establishJumpChain([], target, { factory: () => makeMockClient() }))
      .rejects.toThrow(/Empty jump chain/)
  })
})
