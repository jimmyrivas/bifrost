import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock ssh2 Client
const mockShell = vi.fn()
const mockConnect = vi.fn()
const mockEnd = vi.fn()
const mockOn = vi.fn()

vi.mock('ssh2', () => ({
  Client: vi.fn().mockImplementation(() => ({
    on: mockOn,
    connect: mockConnect,
    shell: mockShell,
    end: mockEnd
  }))
}))

// Mock credential store
vi.mock('../../src/main/services/credential-store', () => ({
  credentialStore: {
    decrypt: vi.fn((buf: Buffer) => buf.toString()),
    encrypt: vi.fn((str: string) => Buffer.from(str)),
    isAvailable: vi.fn(() => true)
  }
}))

// Mock electron
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString())
  }
}))

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => Buffer.from('fake-key'))
}))

import { SshManager } from '../../src/main/services/ssh-manager'

describe('SshManager', () => {
  let manager: SshManager

  beforeEach(() => {
    manager = new SshManager()
    vi.clearAllMocks()
  })

  it('connects with password auth', async () => {
    // Simulate 'ready' event
    mockOn.mockImplementation((event: string, handler: () => void) => {
      if (event === 'ready') setTimeout(handler, 0)
    })

    const id = await manager.connect({
      host: '192.168.1.1',
      port: 22,
      username: 'root',
      authType: 'userpass',
      encryptedPassword: Buffer.from('secret')
    })

    expect(id).toMatch(/^ssh-\d+$/)
    expect(mockConnect).toHaveBeenCalled()
    expect(manager.isConnected(id)).toBe(true)
  })

  it('connects with key auth', async () => {
    mockOn.mockImplementation((event: string, handler: () => void) => {
      if (event === 'ready') setTimeout(handler, 0)
    })

    const id = await manager.connect({
      host: '192.168.1.1',
      port: 22,
      username: 'root',
      authType: 'key',
      privateKeyPath: '/path/to/key'
    })

    expect(id).toMatch(/^ssh-\d+$/)
    expect(manager.isConnected(id)).toBe(true)
  })

  it('rejects on connection error', async () => {
    mockOn.mockImplementation((event: string, handler: (err?: Error) => void) => {
      if (event === 'error') setTimeout(() => handler(new Error('Connection refused')), 0)
    })

    await expect(
      manager.connect({
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        authType: 'userpass'
      })
    ).rejects.toThrow('Connection refused')
  })

  it('disconnects a session', async () => {
    mockOn.mockImplementation((event: string, handler: () => void) => {
      if (event === 'ready') setTimeout(handler, 0)
    })

    const id = await manager.connect({
      host: '192.168.1.1',
      port: 22,
      username: 'root',
      authType: 'manual'
    })

    manager.disconnect(id)
    expect(manager.isConnected(id)).toBe(false)
  })

  it('disconnectAll clears all sessions', async () => {
    mockOn.mockImplementation((event: string, handler: () => void) => {
      if (event === 'ready') setTimeout(handler, 0)
    })

    const id1 = await manager.connect({ host: 'a', port: 22, username: 'u', authType: 'manual' })
    const id2 = await manager.connect({ host: 'b', port: 22, username: 'u', authType: 'manual' })

    manager.disconnectAll()

    expect(manager.isConnected(id1)).toBe(false)
    expect(manager.isConnected(id2)).toBe(false)
  })
})
