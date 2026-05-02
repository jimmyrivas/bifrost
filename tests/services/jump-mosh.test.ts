import { describe, it, expect } from 'vitest'
import { buildMoshSshFlag } from '../../src/main/services/jump-host/mosh'
import type { ResolvedHop } from '../../src/main/services/jump-host/types'

const agentHop = (h: Partial<ResolvedHop> = {}): ResolvedHop => ({
  host: 'bastion.example.com',
  port: 22,
  username: 'alice',
  authType: 'agent',
  ...h
})

describe('buildMoshSshFlag', () => {
  it('returns null flag for an empty chain', () => {
    expect(buildMoshSshFlag([])).toEqual({ flag: null })
  })

  it('builds -J for a single agent hop', () => {
    const r = buildMoshSshFlag([agentHop()])
    expect(r.flag).toContain('-J alice@bastion.example.com')
    expect(r.flag).toContain('StrictHostKeyChecking=accept-new')
  })

  it('omits :22 for default port and includes non-default ports', () => {
    const r = buildMoshSshFlag([agentHop({ port: 22 }), agentHop({ host: 'b2', port: 2222 })])
    expect(r.flag).toContain('-J alice@bastion.example.com,alice@b2:2222')
  })

  it('chains 3 hops with comma separator', () => {
    const r = buildMoshSshFlag([
      agentHop({ host: 'h1' }),
      agentHop({ host: 'h2', username: 'bob', port: 2200 }),
      agentHop({ host: 'h3' })
    ])
    expect(r.flag).toContain('-J alice@h1,bob@h2:2200,alice@h3')
  })

  it('appends -i for the first hop with a private key path', () => {
    const r = buildMoshSshFlag([
      agentHop({ host: 'h1' }),
      agentHop({ host: 'h2', authType: 'key', privateKeyPath: '/keys/id_rsa' })
    ])
    expect(r.flag).toContain('-i /keys/id_rsa')
  })

  it('quotes key paths containing spaces or special chars', () => {
    const r = buildMoshSshFlag([
      agentHop({ authType: 'key', privateKeyPath: '/my keys/id rsa' })
    ])
    expect(r.flag).toContain(`-i '/my keys/id rsa'`)
  })

  it('refuses chains with a password-auth hop and surfaces a reason', () => {
    const r = buildMoshSshFlag([
      { host: 'b', port: 22, username: 'u', authType: 'userpass', password: 'pw' }
    ])
    expect(r.flag).toBeNull()
    expect(r.reason).toMatch(/key-based|agent/i)
  })

  it('accepts a userpass hop without an actual password (no password set yet)', () => {
    const r = buildMoshSshFlag([
      { host: 'b', port: 22, username: 'u', authType: 'userpass' }
    ])
    expect(r.flag).not.toBeNull()
  })
})
