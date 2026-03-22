import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeePassBridge } from '../../src/main/services/keepass-bridge'

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes('which keepassxc-cli')) return '/usr/bin/keepassxc-cli'
    if (cmd.includes('show')) return 'my-secret-password\n'
    if (cmd.includes('ls')) return 'entry1\nentry2\nentry3\n'
    throw new Error('Command not found')
  })
}))

describe('KeePassBridge', () => {
  let bridge: KeePassBridge

  beforeEach(() => {
    bridge = new KeePassBridge()
    vi.clearAllMocks()
  })

  it('reports not configured initially', () => {
    expect(bridge.isConfigured()).toBe(false)
  })

  it('reports configured after configure()', () => {
    bridge.configure({ databasePath: '/path/to/db.kdbx' })
    expect(bridge.isConfigured()).toBe(true)
  })

  it('checks if keepassxc-cli is available', () => {
    expect(bridge.isAvailable()).toBe(true)
  })

  it('resolves a field from KeePass', () => {
    bridge.configure({ databasePath: '/path/to/db.kdbx' })
    const result = bridge.resolve('password', '/servers/prod')
    expect(result).toBe('my-secret-password')
  })

  it('throws when not configured', () => {
    expect(() => bridge.resolve('password', '/path')).toThrow('KeePass not configured')
  })

  it('lists entries', () => {
    bridge.configure({ databasePath: '/path/to/db.kdbx' })
    const entries = bridge.listEntries('/servers')
    expect(entries).toEqual(['entry1', 'entry2', 'entry3'])
  })

  it('returns empty array when not configured', () => {
    expect(bridge.listEntries('/path')).toEqual([])
  })
})
