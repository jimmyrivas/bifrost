import { ipcMain, Notification } from 'electron'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { sshManager } from '../services/ssh-manager'
import { trayManager } from '../services/tray-manager'
import { resolveJumpChainForJson, sealInlinePasswords } from '../services/jump-host/runtime'

export interface TunnelData {
  id?: string
  name: string
  host: string
  port?: number
  username?: string
  authType?: 'userpass' | 'key' | 'key_pass'
  privateKeyPath?: string
  forwards: string // JSON array of {type, localPort, remoteHost?, remotePort?}
  autoStart?: boolean
  jumpServerConfig?: string | null // JSON, see jump-host/types.ts
}

export interface TunnelForward {
  type: 'local' | 'remote' | 'dynamic'
  localPort: number
  remoteHost?: string
  remotePort?: number
}

// Track active tunnel sessions: tunnelId → sshSessionId
const activeTunnels = new Map<string, { sessionId: string; startedAt: number }>()

export function getActiveTunnels(): Map<string, { sessionId: string; startedAt: number }> {
  return activeTunnels
}

export function registerTunnelsIpc(): void {
  // CRUD
  ipcMain.handle('tunnels:list', () => {
    const db = getDatabase()
    return db.select().from(schema.tunnels).all()
  })

  ipcMain.handle('tunnels:get', (_event, id: string) => {
    const db = getDatabase()
    return db.select().from(schema.tunnels).where(eq(schema.tunnels.id, id)).get()
  })

  ipcMain.handle('tunnels:create', (_event, data: TunnelData) => {
    const db = getDatabase()
    const id = randomUUID()
    const now = new Date().toISOString()
    db.insert(schema.tunnels)
      .values({
        id,
        name: data.name,
        host: data.host,
        port: data.port ?? 22,
        username: data.username ?? null,
        authType: data.authType ?? null,
        privateKeyPath: data.privateKeyPath ?? null,
        forwards: data.forwards ?? '[]',
        autoStart: data.autoStart ?? false,
        jumpServerConfig: sealInlinePasswords(data.jumpServerConfig ?? null),
        createdAt: now,
        updatedAt: now
      })
      .run()
    return id
  })

  ipcMain.handle('tunnels:update', (_event, id: string, data: Partial<TunnelData>) => {
    const db = getDatabase()
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.host !== undefined) updates.host = data.host
    if (data.port !== undefined) updates.port = data.port
    if (data.username !== undefined) updates.username = data.username
    if (data.authType !== undefined) updates.authType = data.authType
    if (data.privateKeyPath !== undefined) updates.privateKeyPath = data.privateKeyPath
    if (data.forwards !== undefined) updates.forwards = data.forwards
    if (data.autoStart !== undefined) updates.autoStart = data.autoStart
    if (data.jumpServerConfig !== undefined) updates.jumpServerConfig = sealInlinePasswords(data.jumpServerConfig)
    db.update(schema.tunnels).set(updates).where(eq(schema.tunnels.id, id)).run()
  })

  ipcMain.handle('tunnels:delete', (_event, id: string) => {
    // Stop if active
    if (activeTunnels.has(id)) {
      const info = activeTunnels.get(id)!
      try { sshManager.disconnect(info.sessionId, true) } catch { /* ok */ }
      activeTunnels.delete(id)
    }
    const db = getDatabase()
    db.delete(schema.tunnels).where(eq(schema.tunnels.id, id)).run()
  })

  // Lifecycle: Start / Stop / Status
  ipcMain.handle('tunnels:start', async (_event, id: string) => {
    if (activeTunnels.has(id)) return { ok: true, message: 'Already running' }

    const db = getDatabase()
    const tunnel = db.select().from(schema.tunnels).where(eq(schema.tunnels.id, id)).get()
    if (!tunnel) return { ok: false, message: 'Tunnel not found' }

    try {
      const jumpChain = await resolveJumpChainForJson(tunnel.jumpServerConfig)

      // Connect SSH (no shell)
      const sessionId = await sshManager.connect({
        host: tunnel.host,
        port: tunnel.port ?? 22,
        username: tunnel.username ?? 'root',
        authType: (tunnel.authType as 'userpass' | 'key' | 'key_pass') ?? 'key',
        privateKeyPath: tunnel.privateKeyPath ?? undefined,
        encryptedPassword: tunnel.encryptedPassword ?? undefined,
        encryptedPassphrase: tunnel.encryptedPassphrase ?? undefined,
        jumpChain: jumpChain.length > 0 ? jumpChain : undefined
      })

      // Set up forwards
      const forwards: TunnelForward[] = JSON.parse(tunnel.forwards || '[]')
      const results: string[] = []

      for (const fwd of forwards) {
        try {
          if (fwd.type === 'local' && fwd.remoteHost && fwd.remotePort) {
            const fwdId = await sshManager.addLocalForward(sessionId, fwd.localPort, fwd.remoteHost, fwd.remotePort)
            results.push(`Local :${fwd.localPort} → ${fwd.remoteHost}:${fwd.remotePort} [${fwdId}]`)
          } else if (fwd.type === 'remote' && fwd.remotePort) {
            const fwdId = await sshManager.addRemoteForward(sessionId, fwd.remotePort, 'localhost', fwd.localPort)
            results.push(`Remote :${fwd.remotePort} → localhost:${fwd.localPort} [${fwdId}]`)
          } else if (fwd.type === 'dynamic') {
            // Dynamic/SOCKS is handled differently — ssh2 doesn't natively support SOCKS
            // For now, mark as unsupported
            results.push(`Dynamic :${fwd.localPort} (SOCKS — requires ssh -D flag)`)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          results.push(`FAILED ${fwd.type} :${fwd.localPort} — ${msg}`)
        }
      }

      activeTunnels.set(id, { sessionId, startedAt: Date.now() })

      // Listen for SSH disconnect to auto-remove
      sshManager.on('session:closed', (closedId: string) => {
        if (closedId === sessionId && activeTunnels.has(id)) {
          activeTunnels.delete(id)
          // Tray notification
          try {
            new Notification({
              title: 'Bifrost Tunnel Disconnected',
              body: `Tunnel "${tunnel.name}" (${tunnel.host}) disconnected`
            }).show()
          } catch { /* notifications may not be available */ }
        }
      })

      return { ok: true, message: `Started: ${results.join(', ')}` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, message: msg }
    }
  })

  ipcMain.handle('tunnels:stop', (_event, id: string) => {
    const info = activeTunnels.get(id)
    if (!info) return { ok: false, message: 'Not running' }
    try {
      sshManager.disconnect(info.sessionId, true)
    } catch { /* ok */ }
    activeTunnels.delete(id)
    return { ok: true, message: 'Stopped' }
  })

  ipcMain.handle('tunnels:stopAll', () => {
    let count = 0
    for (const [id, info] of activeTunnels) {
      try {
        sshManager.disconnect(info.sessionId, true)
      } catch { /* ok */ }
      activeTunnels.delete(id)
      count++
    }
    return { ok: true, message: `Stopped ${count} tunnels` }
  })

  ipcMain.handle('tunnels:status', (_event, id: string) => {
    const info = activeTunnels.get(id)
    if (!info) return { active: false, uptime: 0 }
    return {
      active: true,
      uptime: Date.now() - info.startedAt,
      sessionId: info.sessionId
    }
  })

  ipcMain.handle('tunnels:listActive', () => {
    const result: Array<{ tunnelId: string; sessionId: string; uptime: number }> = []
    for (const [tunnelId, info] of activeTunnels) {
      result.push({ tunnelId, sessionId: info.sessionId, uptime: Date.now() - info.startedAt })
    }
    return result
  })
}

// Auto-start tunnels on app ready
export async function autoStartTunnels(): Promise<void> {
  const db = getDatabase()
  const autoStartList = db.select().from(schema.tunnels).all().filter((t) => t.autoStart)
  for (const tunnel of autoStartList) {
    try {
      // Trigger start via the same logic
      const { ipcMain: ipc } = require('electron')
      // We can't invoke our own handler, so duplicate minimal logic
      const jumpChain = await resolveJumpChainForJson(tunnel.jumpServerConfig)
      const sessionId = await sshManager.connect({
        host: tunnel.host,
        port: tunnel.port ?? 22,
        username: tunnel.username ?? 'root',
        authType: (tunnel.authType as 'userpass' | 'key' | 'key_pass') ?? 'key',
        privateKeyPath: tunnel.privateKeyPath ?? undefined,
        encryptedPassword: tunnel.encryptedPassword ?? undefined,
        encryptedPassphrase: tunnel.encryptedPassphrase ?? undefined,
        jumpChain: jumpChain.length > 0 ? jumpChain : undefined
      })
      const forwards: TunnelForward[] = JSON.parse(tunnel.forwards || '[]')
      for (const fwd of forwards) {
        if (fwd.type === 'local' && fwd.remoteHost && fwd.remotePort) {
          await sshManager.addLocalForward(sessionId, fwd.localPort, fwd.remoteHost, fwd.remotePort)
        } else if (fwd.type === 'remote' && fwd.remotePort) {
          await sshManager.addRemoteForward(sessionId, fwd.remotePort, 'localhost', fwd.localPort)
        }
      }
      activeTunnels.set(tunnel.id, { sessionId, startedAt: Date.now() })
      console.log(`[tunnels] Auto-started: ${tunnel.name} (${tunnel.host})`)
    } catch (err) {
      console.warn(`[tunnels] Auto-start failed for ${tunnel.name}:`, err)
    }
  }
}
