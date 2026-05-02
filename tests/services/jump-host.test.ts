import { describe, it, expect } from 'vitest'
import {
  parseJumpServerConfig,
  isValidHop,
  resolveHop,
  resolveChain,
  detectCycle,
  parseProxyJumpString
} from '../../src/main/services/jump-host/resolver'
import type {
  ConnectionLookup,
  ConnectionLookupResult,
  DecryptFn,
  JumpChain
} from '../../src/main/services/jump-host/types'

function makeLookup(connections: Record<string, Partial<ConnectionLookupResult>>): ConnectionLookup {
  return async (id: string) => {
    const c = connections[id]
    if (!c) return null
    return {
      host: c.host ?? null,
      port: c.port ?? 22,
      username: c.username ?? 'user',
      authType: c.authType ?? 'key',
      privateKeyPath: c.privateKeyPath ?? null,
      encryptedPassword: c.encryptedPassword ?? null,
      encryptedPassphrase: c.encryptedPassphrase ?? null,
      jumpServerConfig: c.jumpServerConfig ?? null
    }
  }
}

const decryptIdentity: DecryptFn = (buf) => (buf ? buf.toString('utf-8') : null)

describe('parseJumpServerConfig', () => {
  it('returns empty array for null/empty/invalid', () => {
    expect(parseJumpServerConfig(null)).toEqual([])
    expect(parseJumpServerConfig(undefined)).toEqual([])
    expect(parseJumpServerConfig('')).toEqual([])
    expect(parseJumpServerConfig('not json')).toEqual([])
    expect(parseJumpServerConfig('{}')).toEqual([])
    expect(parseJumpServerConfig('{"chain": "not array"}')).toEqual([])
  })

  it('parses a valid chain with one connectionId hop', () => {
    const json = JSON.stringify({ chain: [{ connectionId: 'abc-123' }] })
    expect(parseJumpServerConfig(json)).toEqual([{ connectionId: 'abc-123' }])
  })

  it('parses a chain with mixed reference and inline hops', () => {
    const json = JSON.stringify({
      chain: [
        { connectionId: 'abc' },
        { inline: { host: 'bastion', username: 'u', authType: 'key' } }
      ]
    })
    const result = parseJumpServerConfig(json)
    expect(result).toHaveLength(2)
    expect(result[0].connectionId).toBe('abc')
    expect(result[1].inline?.host).toBe('bastion')
  })

  it('drops malformed hops silently', () => {
    const json = JSON.stringify({
      chain: [{ connectionId: 'good' }, { random: 'junk' }, { inline: { host: 'h', username: 'u', authType: 'key' } }]
    })
    expect(parseJumpServerConfig(json)).toHaveLength(2)
  })
})

describe('isValidHop', () => {
  it('accepts connectionId-only hops', () => {
    expect(isValidHop({ connectionId: 'x' })).toBe(true)
  })
  it('accepts inline hops with required fields', () => {
    expect(isValidHop({ inline: { host: 'h', username: 'u', authType: 'key' } })).toBe(true)
  })
  it('rejects empty objects', () => {
    expect(isValidHop({})).toBe(false)
  })
  it('rejects non-objects', () => {
    expect(isValidHop(null)).toBe(false)
    expect(isValidHop('string')).toBe(false)
    expect(isValidHop(42)).toBe(false)
  })
})

describe('resolveHop — connectionId mode', () => {
  it('reads stored connection and decrypts credentials', async () => {
    const lookup = makeLookup({
      'conn-1': {
        host: 'bastion.example.com',
        port: 2222,
        username: 'jumper',
        authType: 'userpass',
        encryptedPassword: Buffer.from('s3cr3t')
      }
    })
    const result = await resolveHop({ connectionId: 'conn-1' }, lookup, decryptIdentity)
    expect(result).toMatchObject({
      host: 'bastion.example.com',
      port: 2222,
      username: 'jumper',
      authType: 'userpass',
      password: 's3cr3t'
    })
  })

  it('honors usernameOverride without affecting password', async () => {
    const lookup = makeLookup({
      shared: {
        host: 'bastion',
        username: 'admin',
        authType: 'userpass',
        encryptedPassword: Buffer.from('pw')
      }
    })
    const result = await resolveHop(
      { connectionId: 'shared', usernameOverride: 'alice' },
      lookup,
      decryptIdentity
    )
    expect(result.username).toBe('alice')
    expect(result.password).toBe('pw')
  })

  it('fills port=22 when source connection has none', async () => {
    const lookup = makeLookup({ x: { host: 'h', authType: 'key' } })
    const result = await resolveHop({ connectionId: 'x' }, lookup, decryptIdentity)
    expect(result.port).toBe(22)
  })

  it('throws when the referenced connection does not exist', async () => {
    const lookup = makeLookup({})
    await expect(resolveHop({ connectionId: 'missing' }, lookup, decryptIdentity)).rejects.toThrow(
      /not found/
    )
  })

  it('throws when referenced connection has no host', async () => {
    const lookup = makeLookup({ x: { host: null, authType: 'key' } })
    await expect(resolveHop({ connectionId: 'x' }, lookup, decryptIdentity)).rejects.toThrow(
      /no host/
    )
  })

  it('rejects connections with unsupported authType (fido2/manual)', async () => {
    const lookup = makeLookup({
      x: { host: 'h', authType: 'fido2' },
      y: { host: 'h', authType: 'manual' }
    })
    await expect(resolveHop({ connectionId: 'x' }, lookup, decryptIdentity)).rejects.toThrow(
      /unsupported authType/
    )
    await expect(resolveHop({ connectionId: 'y' }, lookup, decryptIdentity)).rejects.toThrow(
      /unsupported authType/
    )
  })
})

describe('resolveHop — inline mode', () => {
  it('returns inline values directly', async () => {
    const lookup = makeLookup({})
    const result = await resolveHop(
      {
        inline: {
          host: 'bastion-2',
          port: 2200,
          username: 'bob',
          authType: 'key',
          privateKeyPath: '/keys/id_rsa'
        }
      },
      lookup,
      decryptIdentity
    )
    expect(result).toEqual({
      host: 'bastion-2',
      port: 2200,
      username: 'bob',
      authType: 'key',
      privateKeyPath: '/keys/id_rsa',
      password: null,
      passphrase: null
    })
  })

  it('decrypts inline base64-encoded password', async () => {
    const encrypted = Buffer.from('inline-pw').toString('base64')
    const result = await resolveHop(
      {
        inline: {
          host: 'h',
          username: 'u',
          authType: 'userpass',
          encryptedPassword: encrypted
        }
      },
      makeLookup({}),
      decryptIdentity
    )
    expect(result.password).toBe('inline-pw')
  })

  it('defaults port to 22 when inline omits it', async () => {
    const result = await resolveHop(
      { inline: { host: 'h', username: 'u', authType: 'key' } },
      makeLookup({}),
      decryptIdentity
    )
    expect(result.port).toBe(22)
  })
})

describe('resolveHop — invalid input', () => {
  it('throws when neither connectionId nor inline is set', async () => {
    await expect(resolveHop({}, makeLookup({}), decryptIdentity)).rejects.toThrow()
  })
})

describe('resolveChain', () => {
  it('resolves multiple hops in order', async () => {
    const lookup = makeLookup({
      a: { host: 'host-a', username: 'ua', authType: 'key' }
    })
    const chain: JumpChain = [
      { connectionId: 'a' },
      { inline: { host: 'host-b', username: 'ub', authType: 'agent' } }
    ]
    const result = await resolveChain(chain, lookup, decryptIdentity)
    expect(result).toHaveLength(2)
    expect(result[0].host).toBe('host-a')
    expect(result[1].host).toBe('host-b')
  })

  it('propagates errors from a single hop', async () => {
    const chain: JumpChain = [{ connectionId: 'missing' }]
    await expect(resolveChain(chain, makeLookup({}), decryptIdentity)).rejects.toThrow(/not found/)
  })
})

describe('detectCycle', () => {
  it('returns null for a clean chain', async () => {
    const lookup = makeLookup({ a: { host: 'h', authType: 'key' } })
    const result = await detectCycle('root', [{ connectionId: 'a' }], lookup)
    expect(result).toBeNull()
  })

  it('detects direct self-reference', async () => {
    const lookup = makeLookup({})
    const result = await detectCycle('me', [{ connectionId: 'me' }], lookup)
    expect(result).toMatch(/itself/i)
  })

  it('detects A→B→A cycle through nested config', async () => {
    const lookup = makeLookup({
      b: {
        host: 'h',
        authType: 'key',
        jumpServerConfig: JSON.stringify({ chain: [{ connectionId: 'a' }] })
      }
    })
    const result = await detectCycle('a', [{ connectionId: 'b' }], lookup)
    expect(result).toMatch(/cycle|itself/i)
  })

  it('detects deep cycle a→b→c→a', async () => {
    const lookup = makeLookup({
      b: {
        host: 'b',
        authType: 'key',
        jumpServerConfig: JSON.stringify({ chain: [{ connectionId: 'c' }] })
      },
      c: {
        host: 'c',
        authType: 'key',
        jumpServerConfig: JSON.stringify({ chain: [{ connectionId: 'a' }] })
      }
    })
    const result = await detectCycle('a', [{ connectionId: 'b' }], lookup)
    expect(result).toMatch(/cycle|itself/i)
  })

  it('flags two-references-to-same-bastion as cycle (treats revisit defensively)', async () => {
    const lookup = makeLookup({ b: { host: 'h', authType: 'key' } })
    const result = await detectCycle(
      'root',
      [{ connectionId: 'b' }, { connectionId: 'b' }],
      lookup
    )
    expect(result).toMatch(/cycle/i)
  })

  it('ignores inline hops for cycle purposes', async () => {
    const result = await detectCycle(
      'root',
      [
        { inline: { host: 'b1', username: 'u', authType: 'key' } },
        { inline: { host: 'b2', username: 'u', authType: 'key' } }
      ],
      makeLookup({})
    )
    expect(result).toBeNull()
  })
})

describe('parseProxyJumpString', () => {
  it('returns null for empty input', () => {
    expect(parseProxyJumpString('')).toBeNull()
    expect(parseProxyJumpString(null)).toBeNull()
    expect(parseProxyJumpString('   ')).toBeNull()
  })

  it('parses a single user@host', () => {
    const result = parseProxyJumpString('alice@bastion.example.com')
    expect(result).toEqual([
      {
        inline: {
          host: 'bastion.example.com',
          port: undefined,
          username: 'alice',
          authType: 'agent'
        }
      }
    ])
  })

  it('parses user@host:port', () => {
    const result = parseProxyJumpString('alice@bastion:2222')
    expect(result?.[0].inline?.port).toBe(2222)
  })

  it('parses comma-separated multi-hop chain', () => {
    const result = parseProxyJumpString('a@h1,b@h2:2222,c@h3')
    expect(result).toHaveLength(3)
    expect(result?.[0].inline?.username).toBe('a')
    expect(result?.[1].inline?.port).toBe(2222)
    expect(result?.[2].inline?.host).toBe('h3')
  })

  it('returns null for malformed input', () => {
    expect(parseProxyJumpString('no-at-sign')).toBeNull()
    expect(parseProxyJumpString('@hostonly')).toBeNull()
    expect(parseProxyJumpString('user@')).toBeNull()
  })
})
