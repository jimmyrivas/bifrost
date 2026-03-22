import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString())
  }
}))

// Mock better-sqlite3 and drizzle
vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    pragma: vi.fn(),
    close: vi.fn()
  }))
}))

vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ get: vi.fn(() => null), all: vi.fn(() => []) })),
        all: vi.fn(() => [])
      }))
    }))
  }))
}))

vi.mock('../../src/main/db', () => ({
  getDatabase: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ get: vi.fn(() => null), all: vi.fn(() => []) })),
        all: vi.fn(() => [])
      }))
    }))
  })),
  getSqlite: vi.fn(),
  schema: {}
}))

import { VariableEngine } from '../../src/main/services/variable-engine'

describe('VariableEngine', () => {
  let engine: VariableEngine

  beforeEach(() => {
    engine = new VariableEngine()
  })

  it('resolves internal variables', () => {
    const result = engine.resolveInternal('<IP>:<PORT> as <USER>', {
      ip: '192.168.1.1',
      port: 22,
      user: 'root'
    })
    expect(result).toBe('192.168.1.1:22 as root')
  })

  it('resolves date/time variables', () => {
    const result = engine.resolveInternal('<DATE_Y>-<DATE_M>-<DATE_D>', {})
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(result).toBe(expected)
  })

  it('resolves environment variables', () => {
    process.env.TEST_VAR_BIFROST = 'hello'
    const result = engine.resolveEnv('<ENV:TEST_VAR_BIFROST>')
    expect(result).toBe('hello')
    delete process.env.TEST_VAR_BIFROST
  })

  it('returns empty string for missing env var', () => {
    const result = engine.resolveEnv('<ENV:NONEXISTENT_VAR_XYZ>')
    expect(result).toBe('')
  })

  it('resolves CMD variables', () => {
    const result = engine.resolveCmd('<CMD:echo hello>')
    expect(result).toBe('hello')
  })

  it('returns empty for failed CMD', () => {
    const result = engine.resolveCmd('<CMD:nonexistent_command_xyz>')
    expect(result).toBe('')
  })

  it('resolves ASK with first option as default (no callback)', async () => {
    const result = await engine.resolveAsk('<ASK:Pick server|prod|staging>')
    expect(result).toBe('prod')
  })

  it('resolves ASK with callback', async () => {
    engine.setAskCallback(async (req) => {
      expect(req.description).toBe('Pick server')
      expect(req.options).toEqual(['prod', 'staging'])
      return 'staging'
    })

    const result = await engine.resolveAsk('<ASK:Pick server|prod|staging>')
    expect(result).toBe('staging')
  })

  it('preserves text without variables', () => {
    const result = engine.resolveInternal('just plain text', {})
    expect(result).toBe('just plain text')
  })

  it('handles multiple variables in one string', () => {
    const result = engine.resolveInternal('ssh <USER>@<IP> -p <PORT>', {
      user: 'admin',
      ip: '10.0.0.1',
      port: 2222
    })
    expect(result).toBe('ssh admin@10.0.0.1 -p 2222')
  })
})
