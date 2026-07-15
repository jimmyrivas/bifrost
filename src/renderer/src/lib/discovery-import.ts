/**
 * Pure mappers shared by the Import/Export + Discovery panels and the tray
 * feed. Kept free of `window.bifrost` so they are unit-testable and the UI
 * components stay thin wiring.
 */

/** A connection payload accepted by `connections:create`. */
export interface ConnectionInput {
  name: string
  method: 'ssh'
  host: string
  port: number
  username?: string
  authType: 'manual'
}

/** Structural shape of a `DiscoveredHost` (cloud/container scan result). */
export interface DiscoveredHostLike {
  name: string
  host: string
  port: number
  user: string
  type: string
}

/** Map a discovered cloud/container host to an SSH connection payload. */
export function discoveredHostToConnection(h: DiscoveredHostLike): ConnectionInput {
  return {
    name: h.name || h.host,
    method: 'ssh',
    host: h.host,
    port: h.port || 22,
    username: h.user || undefined,
    authType: 'manual'
  }
}

/** Structural shape of a `TerraformHost` (parsed .tfstate resource). */
export interface TerraformHostLike {
  name: string
  publicIp: string
  privateIp: string
}

/**
 * Map a Terraform resource to an SSH connection, preferring the public IP.
 * Returns null when the resource has no usable address (skip it).
 */
export function terraformHostToConnection(h: TerraformHostLike): ConnectionInput | null {
  const host = h.publicIp || h.privateIp
  if (!host) return null
  return { name: h.name || host, method: 'ssh', host, port: 22, authType: 'manual' }
}

/** A tray menu entry (mirrors main's `TrayConnectionEntry`). */
export interface TrayEntry {
  id: string
  name: string
  protocol: string
  host: string
  isFavorite: boolean
  lastUsed?: number
}

export interface ConnectionLike {
  id: string
  name: string
  method: string
  host: string | null
}

export interface RecentLike {
  id: string
  timestamp: number
}

/** Build the tray menu list from the renderer's connections + favorites + recents. */
export function connectionsToTrayEntries(
  connections: ConnectionLike[],
  favorites: string[],
  recents: RecentLike[]
): TrayEntry[] {
  return connections.map((c) => ({
    id: c.id,
    name: c.name,
    protocol: c.method,
    host: c.host ?? '',
    isFavorite: favorites.includes(c.id),
    lastUsed: recents.find((r) => r.id === c.id)?.timestamp
  }))
}
