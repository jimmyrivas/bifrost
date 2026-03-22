import { EventEmitter } from 'events'
import { sshManager } from './ssh-manager'

export interface ClusterSession {
  id: string
  name: string
  memberSessionIds: string[] // SSH session IDs
  syncInput: boolean
}

let clusterSessionCounter = 0

export class ClusterManager extends EventEmitter {
  private activeClusters = new Map<string, ClusterSession>()

  /**
   * Activate a cluster — opens SSH sessions for all members.
   * The actual connection is handled by caller; this tracks membership.
   */
  createSession(name: string, sshSessionIds: string[]): string {
    const id = `cluster-session-${++clusterSessionCounter}`
    const session: ClusterSession = {
      id,
      name,
      memberSessionIds: [...sshSessionIds],
      syncInput: true
    }
    this.activeClusters.set(id, session)
    this.emit('cluster-created', session)
    return id
  }

  /**
   * Write data to all terminals in a cluster (synchronized input).
   */
  broadcastInput(clusterSessionId: string, data: string): void {
    const session = this.activeClusters.get(clusterSessionId)
    if (!session || !session.syncInput) return

    for (const sshId of session.memberSessionIds) {
      sshManager.write(sshId, data)
    }
  }

  /**
   * Toggle synchronized input for a cluster.
   */
  setSyncInput(clusterSessionId: string, enabled: boolean): void {
    const session = this.activeClusters.get(clusterSessionId)
    if (session) {
      session.syncInput = enabled
    }
  }

  /**
   * Add a member SSH session to an active cluster.
   */
  addMember(clusterSessionId: string, sshSessionId: string): void {
    const session = this.activeClusters.get(clusterSessionId)
    if (session && !session.memberSessionIds.includes(sshSessionId)) {
      session.memberSessionIds.push(sshSessionId)
    }
  }

  /**
   * Remove a member from an active cluster.
   */
  removeMember(clusterSessionId: string, sshSessionId: string): void {
    const session = this.activeClusters.get(clusterSessionId)
    if (session) {
      session.memberSessionIds = session.memberSessionIds.filter(
        (id) => id !== sshSessionId
      )
    }
  }

  /**
   * Destroy a cluster session. Does NOT disconnect individual SSH sessions.
   */
  destroySession(clusterSessionId: string): void {
    this.activeClusters.delete(clusterSessionId)
    this.emit('cluster-destroyed', clusterSessionId)
  }

  getSession(clusterSessionId: string): ClusterSession | undefined {
    return this.activeClusters.get(clusterSessionId)
  }

  getAllSessions(): ClusterSession[] {
    return Array.from(this.activeClusters.values())
  }

  /**
   * Power Cluster Controller (PCC): broadcast to ALL open SSH sessions,
   * regardless of cluster membership.
   */
  broadcastToAll(data: string): void {
    // Get all active cluster member IDs to broadcast
    const allSessionIds = new Set<string>()
    for (const cluster of this.activeClusters.values()) {
      for (const id of cluster.memberSessionIds) {
        allSessionIds.add(id)
      }
    }

    for (const id of allSessionIds) {
      if (sshManager.isConnected(id)) {
        sshManager.write(id, data)
      }
    }
  }
}

export const clusterManager = new ClusterManager()
