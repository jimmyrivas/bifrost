import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock ssh-manager
vi.mock('../../src/main/services/ssh-manager', () => ({
  sshManager: {
    write: vi.fn(),
    isConnected: vi.fn(() => true)
  }
}))

import { ClusterManager } from '../../src/main/services/cluster-manager'
import { sshManager } from '../../src/main/services/ssh-manager'

describe('ClusterManager', () => {
  let manager: ClusterManager

  beforeEach(() => {
    manager = new ClusterManager()
    vi.clearAllMocks()
  })

  it('creates a cluster session', () => {
    const id = manager.createSession('Production', ['ssh-1', 'ssh-2', 'ssh-3'])
    expect(id).toMatch(/^cluster-session-\d+$/)

    const session = manager.getSession(id)
    expect(session).toBeDefined()
    expect(session!.name).toBe('Production')
    expect(session!.memberSessionIds).toEqual(['ssh-1', 'ssh-2', 'ssh-3'])
    expect(session!.syncInput).toBe(true)
  })

  it('broadcasts input to all cluster members', () => {
    const id = manager.createSession('Test', ['ssh-1', 'ssh-2'])
    manager.broadcastInput(id, 'uptime\r')

    expect(sshManager.write).toHaveBeenCalledTimes(2)
    expect(sshManager.write).toHaveBeenCalledWith('ssh-1', 'uptime\r')
    expect(sshManager.write).toHaveBeenCalledWith('ssh-2', 'uptime\r')
  })

  it('does not broadcast when syncInput is disabled', () => {
    const id = manager.createSession('Test', ['ssh-1', 'ssh-2'])
    manager.setSyncInput(id, false)
    manager.broadcastInput(id, 'data')

    expect(sshManager.write).not.toHaveBeenCalled()
  })

  it('adds a member to an active cluster', () => {
    const id = manager.createSession('Test', ['ssh-1'])
    manager.addMember(id, 'ssh-2')

    const session = manager.getSession(id)
    expect(session!.memberSessionIds).toEqual(['ssh-1', 'ssh-2'])
  })

  it('removes a member from an active cluster', () => {
    const id = manager.createSession('Test', ['ssh-1', 'ssh-2', 'ssh-3'])
    manager.removeMember(id, 'ssh-2')

    const session = manager.getSession(id)
    expect(session!.memberSessionIds).toEqual(['ssh-1', 'ssh-3'])
  })

  it('does not add duplicate members', () => {
    const id = manager.createSession('Test', ['ssh-1'])
    manager.addMember(id, 'ssh-1')

    const session = manager.getSession(id)
    expect(session!.memberSessionIds).toEqual(['ssh-1'])
  })

  it('destroys a cluster session', () => {
    const id = manager.createSession('Test', ['ssh-1'])
    manager.destroySession(id)

    expect(manager.getSession(id)).toBeUndefined()
  })

  it('lists all active sessions', () => {
    manager.createSession('A', ['ssh-1'])
    manager.createSession('B', ['ssh-2'])

    const sessions = manager.getAllSessions()
    expect(sessions).toHaveLength(2)
  })

  it('PCC broadcasts to all cluster members', () => {
    manager.createSession('A', ['ssh-1', 'ssh-2'])
    manager.createSession('B', ['ssh-3'])

    manager.broadcastToAll('reboot\r')

    expect(sshManager.write).toHaveBeenCalledTimes(3)
    expect(sshManager.write).toHaveBeenCalledWith('ssh-1', 'reboot\r')
    expect(sshManager.write).toHaveBeenCalledWith('ssh-2', 'reboot\r')
    expect(sshManager.write).toHaveBeenCalledWith('ssh-3', 'reboot\r')
  })
})
