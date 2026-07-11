import { ipcMain, Notification } from 'electron'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { sshManager } from '../services/ssh-manager'
import { trayManager } from '../services/tray-manager'
import { credentialStore } from '../services/credential-store'
import { resolveJumpChainForJson, sealInlinePasswords } from '../services/jump-host/runtime'

export interface TunnelData {
  id?: string
  name: string
  /** When set, host/port/user/auth/credentials come from the referenced
   *  connection. Inline fields below are ignored. */
  connectionId?: string | null
  host?: string | null
  port?: number
  username?: string
  authType?: 'userpass' | 'key' | 'key_pass'
  privateKeyPath?: string
  /** Plain password from the renderer; encrypted server-side. Empty string
   *  means "no change"; null clears it. */
  password?: string | null
  passphrase?: string | null
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
    const usingRef = !!data.connectionId
    db.insert(schema.tunnels)
      .values({
        id,
        name: data.name,
        connectionId: data.connectionId ?? null,
        host: usingRef ? null : (data.host ?? null),
        port: usingRef ? 22 : (data.port ?? 22),
        username: usingRef ? null : (data.username ?? null),
        authType: usingRef ? null : (data.authType ?? null),
        privateKeyPath: usingRef ? null : (data.privateKeyPath ?? null),
        encryptedPassword: usingRef || !data.password
          ? null
          : credentialStore.encrypt(data.password),
        encryptedPassphrase: usingRef || !data.passphrase
          ? null
          : credentialStore.encrypt(data.passphrase),
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
    // Switching to a saved connection wipes inline fields so they can't drift.
    if (data.connectionId !== undefined) {
      updates.connectionId = data.connectionId
      if (data.connectionId) {
        updates.host = null
        updates.username = null
        updates.authType = null
        updates.privateKeyPath = null
        updates.encryptedPassword = null
        updates.encryptedPassphrase = null
      }
    }
    // Only honor inline fields when not in saved-connection mode.
    if (!data.connectionId) {
      if (data.host !== undefined) updates.host = data.host
      if (data.port !== undefined) updates.port = data.port
      if (data.username !== undefined) updates.username = data.username
      if (data.authType !== undefined) updates.authType = data.authType
      if (data.privateKeyPath !== undefined) updates.privateKeyPath = data.privateKeyPath
      // password/passphrase: empty string = leave alone, null = clear, value = re-encrypt
      if (data.password === null) updates.encryptedPassword = null
      else if (typeof data.password === 'string' && data.password.length > 0) {
        updates.encryptedPassword = credentialStore.encrypt(data.password)
      }
      if (data.passphrase === null) updates.encryptedPassphrase = null
      else if (typeof data.passphrase === 'string' && data.passphrase.length > 0) {
        updates.encryptedPassphrase = credentialStore.encrypt(data.passphrase)
      }
    }
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
      const connectArgs = await resolveTunnelConnectArgs(tunnel)
      if (!connectArgs) {
        return { ok: false, message: 'Referenced connection not found or unsupported' }
      }
      const jumpChain = await resolveJumpChainForJson(
        tunnel.jumpServerConfig ?? connectArgs.jumpServerConfig
      )

      // Connect SSH (no shell)
      const sessionId = await sshManager.connect({
        ...connectArgs.connect,
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
            const fwdId = await sshManager.addDynamicForward(sessionId, fwd.localPort)
            results.push(`Dynamic SOCKS5 :${fwd.localPort} [${fwdId}]`)
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
              body: `Tunnel "${tunnel.name}" (${connectArgs.displayHost}) disconnected`
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

/**
 * Build the SSH connect arguments for a tunnel row, transparently resolving
 * a referenced connection when `connectionId` is set.
 *
 * Returns null when the row references a connection that has been deleted or
 * has an unsupported authType (fido2/manual/null) — caller surfaces a useful
 * message to the user.
 */
async function resolveTunnelConnectArgs(
  tunnel: typeof schema.tunnels.$inferSelect
): Promise<{
  connect: Parameters<typeof sshManager.connect>[0]
  jumpServerConfig: string | null
  displayHost: string
} | null> {
  if (tunnel.connectionId) {
    const db = getDatabase()
    const conn = db
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.id, tunnel.connectionId))
      .get()
    if (!conn || !conn.host) return null
    if (conn.authType === 'fido2' || conn.authType === 'manual' || conn.authType == null) {
      return null
    }
    return {
      connect: {
        host: conn.host,
        port: conn.port ?? 22,
        username: conn.username ?? 'root',
        authType: conn.authType as 'userpass' | 'key' | 'key_pass',
        privateKeyPath: conn.privateKeyPath ?? undefined,
        encryptedPassword: conn.encryptedPassword ?? undefined,
        encryptedPassphrase: conn.encryptedPassphrase ?? undefined
      },
      jumpServerConfig: conn.jumpServerConfig ?? null,
      displayHost: conn.host
    }
  }
  // Inline mode
  return {
    connect: {
      host: tunnel.host ?? '',
      port: tunnel.port ?? 22,
      username: tunnel.username ?? 'root',
      authType: (tunnel.authType as 'userpass' | 'key' | 'key_pass') ?? 'key',
      privateKeyPath: tunnel.privateKeyPath ?? undefined,
      encryptedPassword: tunnel.encryptedPassword ?? undefined,
      encryptedPassphrase: tunnel.encryptedPassphrase ?? undefined
    },
    jumpServerConfig: null,
    displayHost: tunnel.host ?? '(no host)'
  }
}

// Auto-start tunnels on app ready
export async function autoStartTunnels(): Promise<void> {
  const db = getDatabase()
  const autoStartList = db.select().from(schema.tunnels).all().filter((t) => t.autoStart)
  for (const tunnel of autoStartList) {
    try {
      const connectArgs = await resolveTunnelConnectArgs(tunnel)
      if (!connectArgs) {
        console.warn(`[tunnels] Auto-start skipped for ${tunnel.name}: connection not resolvable`)
        continue
      }
      const jumpChain = await resolveJumpChainForJson(
        tunnel.jumpServerConfig ?? connectArgs.jumpServerConfig
      )
      const sessionId = await sshManager.connect({
        ...connectArgs.connect,
        jumpChain: jumpChain.length > 0 ? jumpChain : undefined
      })
      const forwards: TunnelForward[] = JSON.parse(tunnel.forwards || '[]')
      for (const fwd of forwards) {
        if (fwd.type === 'local' && fwd.remoteHost && fwd.remotePort) {
          await sshManager.addLocalForward(sessionId, fwd.localPort, fwd.remoteHost, fwd.remotePort)
        } else if (fwd.type === 'remote' && fwd.remotePort) {
          await sshManager.addRemoteForward(sessionId, fwd.remotePort, 'localhost', fwd.localPort)
        } else if (fwd.type === 'dynamic') {
          await sshManager.addDynamicForward(sessionId, fwd.localPort)
        }
      }
      activeTunnels.set(tunnel.id, { sessionId, startedAt: Date.now() })
      console.log(`[tunnels] Auto-started: ${tunnel.name} (${connectArgs.displayHost})`)
    } catch (err) {
      console.warn(`[tunnels] Auto-start failed for ${tunnel.name}:`, err)
    }
  }
}
