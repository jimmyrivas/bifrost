import { ipcMain } from 'electron'
import { clusterManager } from '../services/cluster-manager'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export function registerClusterIpc(): void {
  // Cluster definitions (persistent)
  ipcMain.handle('cluster:list', () => {
    const db = getDatabase()
    return db.select().from(schema.clusters).all()
  })

  ipcMain.handle('cluster:create', (_event, name: string, connectionIds: string[]) => {
    const db = getDatabase()
    const id = randomUUID()
    db.insert(schema.clusters).values({ id, name }).run()
    for (const connId of connectionIds) {
      db.insert(schema.clusterMembers).values({ clusterId: id, connectionId: connId }).run()
    }
    return id
  })

  // Update a cluster's name and membership in place (keeps the id, so anything
  // referencing the cluster stays valid). Members are replaced wholesale.
  ipcMain.handle('cluster:update', (_event, id: string, name: string, connectionIds: string[]) => {
    const db = getDatabase()
    db.update(schema.clusters).set({ name }).where(eq(schema.clusters.id, id)).run()
    db.delete(schema.clusterMembers).where(eq(schema.clusterMembers.clusterId, id)).run()
    for (const connId of connectionIds) {
      db.insert(schema.clusterMembers).values({ clusterId: id, connectionId: connId }).run()
    }
  })

  ipcMain.handle('cluster:delete', (_event, id: string) => {
    const db = getDatabase()
    db.delete(schema.clusters).where(eq(schema.clusters.id, id)).run()
  })

  ipcMain.handle('cluster:getMembers', (_event, clusterId: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.clusterMembers)
      .where(eq(schema.clusterMembers.clusterId, clusterId))
      .all()
  })

  // Active cluster sessions (runtime)
  ipcMain.handle(
    'cluster:startSession',
    (_event, name: string, sshSessionIds: string[]) => {
      return clusterManager.createSession(name, sshSessionIds)
    }
  )

  ipcMain.on('cluster:broadcastInput', (_event, clusterSessionId: string, data: string) => {
    clusterManager.broadcastInput(clusterSessionId, data)
  })

  ipcMain.handle(
    'cluster:setSyncInput',
    (_event, clusterSessionId: string, enabled: boolean) => {
      clusterManager.setSyncInput(clusterSessionId, enabled)
    }
  )

  ipcMain.handle('cluster:destroySession', (_event, clusterSessionId: string) => {
    clusterManager.destroySession(clusterSessionId)
  })

  ipcMain.handle('cluster:getActiveSessions', () => {
    return clusterManager.getAllSessions()
  })

  // PCC - Power Cluster Controller
  ipcMain.on('cluster:pccBroadcast', (_event, data: string) => {
    clusterManager.broadcastToAll(data)
  })
}
