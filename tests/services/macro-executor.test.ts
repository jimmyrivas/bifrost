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

import { MacroExecutor } from '../../src/main/services/macro-executor'

describe('MacroExecutor', () => {
  let executor: MacroExecutor

  beforeEach(() => {
    executor = new MacroExecutor()
    vi.clearAllMocks()
  })

  it('executes a local command and returns output', async () => {
    const result = await executor.executeLocal('echo hello', {})
    expect(result.trim()).toBe('hello')
  })

  it('rejects on failed local command', async () => {
    await expect(executor.executeLocal('nonexistent_cmd_xyz', {})).rejects.toThrow()
  })

  it('executes remote macro via send callback', async () => {
    const sent: string[] = []
    executor.setRemoteSendCallback((data) => sent.push(data))

    await executor.executeRemote('uptime', {})
    expect(sent).toContain('uptime\r')
  })

  it('skips macro when confirm callback returns false', async () => {
    executor.setConfirmCallback(async () => false)
    const sent: string[] = []
    executor.setRemoteSendCallback((data) => sent.push(data))

    await executor.executeMacro(
      { id: 'm1', name: 'Test', command: 'reboot', type: 'remote', confirmBeforeExec: true },
      {}
    )

    expect(sent).toHaveLength(0)
  })

  it('executes macro when confirm callback returns true', async () => {
    executor.setConfirmCallback(async () => true)
    const sent: string[] = []
    executor.setRemoteSendCallback((data) => sent.push(data))

    await executor.executeMacro(
      { id: 'm1', name: 'Test', command: 'uptime', type: 'remote', confirmBeforeExec: true },
      {}
    )

    expect(sent).toContain('uptime\r')
  })

  it('resolves variables in local command', async () => {
    const result = await executor.executeLocal('echo <IP>', { ip: '10.0.0.1' })
    expect(result.trim()).toBe('10.0.0.1')
  })
})
