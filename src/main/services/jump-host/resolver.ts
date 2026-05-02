import type {
  JumpChain,
  JumpHostHop,
  JumpServerConfig,
  ConnectionLookup,
  DecryptFn,
  ResolvedHop
} from './types'

/**
 * Parse a stored JSON config into a JumpChain. Returns an empty array if the
 * value is null/empty/invalid (so callers can always treat the result as a
 * chain — no special-casing the absent/broken case at every call site).
 */
export function parseJumpServerConfig(json: string | null | undefined): JumpChain {
  if (!json) return []
  try {
    const parsed = JSON.parse(json) as JumpServerConfig | null
    if (!parsed || !Array.isArray(parsed.chain)) return []
    return parsed.chain.filter(isValidHop)
  } catch {
    return []
  }
}

export function isValidHop(hop: unknown): hop is JumpHostHop {
  if (!hop || typeof hop !== 'object') return false
  const h = hop as JumpHostHop
  if (h.connectionId && typeof h.connectionId === 'string') return true
  if (h.inline && typeof h.inline.host === 'string' && typeof h.inline.username === 'string') {
    return true
  }
  return false
}

/** Normalize a base64 (or buffer-like) password back to a Buffer for decryption. */
function asBuffer(input: string | null | undefined): Buffer | null {
  if (!input) return null
  return Buffer.from(input, 'base64')
}

export async function resolveHop(
  hop: JumpHostHop,
  lookup: ConnectionLookup,
  decrypt: DecryptFn
): Promise<ResolvedHop> {
  if (hop.connectionId) {
    const conn = await lookup(hop.connectionId)
    if (!conn) {
      throw new Error(`Jump host connection not found: ${hop.connectionId}`)
    }
    if (!conn.host) {
      throw new Error(`Jump host connection ${hop.connectionId} has no host`)
    }
    const authType = conn.authType
    if (authType === 'fido2' || authType === 'manual' || authType === null) {
      throw new Error(
        `Jump host connection ${hop.connectionId} has unsupported authType: ${authType ?? 'null'}`
      )
    }
    return {
      host: conn.host,
      port: conn.port ?? 22,
      username: hop.usernameOverride || conn.username || '',
      authType,
      privateKeyPath: conn.privateKeyPath,
      password: decrypt(conn.encryptedPassword),
      passphrase: decrypt(conn.encryptedPassphrase)
    }
  }

  if (hop.inline) {
    return {
      host: hop.inline.host,
      port: hop.inline.port ?? 22,
      username: hop.inline.username,
      authType: hop.inline.authType,
      privateKeyPath: hop.inline.privateKeyPath ?? null,
      password: decrypt(asBuffer(hop.inline.encryptedPassword)),
      passphrase: decrypt(asBuffer(hop.inline.encryptedPassphrase))
    }
  }

  throw new Error('Invalid jump hop: must have either connectionId or inline config')
}

export async function resolveChain(
  chain: JumpChain,
  lookup: ConnectionLookup,
  decrypt: DecryptFn
): Promise<ResolvedHop[]> {
  const result: ResolvedHop[] = []
  for (const hop of chain) {
    result.push(await resolveHop(hop, lookup, decrypt))
  }
  return result
}

/**
 * Walks the jump chain and any nested chains of referenced connections to
 * detect a cycle that would lead back to `rootConnectionId`. Returns a
 * human-readable error message when a cycle is found, or null when safe.
 *
 * Cases handled:
 *  - Hop directly references the root.
 *  - Hop references a connection whose chain (transitively) includes root.
 *  - Two hops reference the same connection (revisit) — flagged as cycle to
 *    avoid quadratic walks; legitimate "fan-in" through the same bastion is
 *    already covered by walking via the first reference.
 */
export async function detectCycle(
  rootConnectionId: string | undefined,
  chain: JumpChain,
  lookup: ConnectionLookup,
  visited: Set<string> = new Set()
): Promise<string | null> {
  if (rootConnectionId) visited.add(rootConnectionId)

  for (const hop of chain) {
    if (!hop.connectionId) continue
    if (rootConnectionId && hop.connectionId === rootConnectionId) {
      return 'Connection references itself as a jump host'
    }
    if (visited.has(hop.connectionId)) {
      return `Jump-host cycle detected via ${hop.connectionId}`
    }
    // Mark this hop as visited *before* descending and *before* moving to the
    // next sibling. This catches:
    //   1. Cycles through nested chains: a→b→a (caught on recursion).
    //   2. Sibling fan-in: chain=[b,b] (caught when the second b is reached).
    visited.add(hop.connectionId)
    const conn = await lookup(hop.connectionId)
    if (!conn?.jumpServerConfig) continue
    const subChain = parseJumpServerConfig(conn.jumpServerConfig)
    if (subChain.length === 0) continue
    const result = await detectCycle(rootConnectionId, subChain, lookup, visited)
    if (result) return result
  }
  return null
}

/**
 * One-shot translator for legacy `sshConfig.options.ProxyJump` strings.
 * OpenSSH format: `user@host:port[,user2@host2:port2,…]`.
 * Returns null when the input is empty or unparseable.
 */
export function parseProxyJumpString(value: string | null | undefined): JumpChain | null {
  if (!value || !value.trim()) return null
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const chain: JumpChain = []
  for (const part of parts) {
    const atIdx = part.lastIndexOf('@')
    if (atIdx <= 0 || atIdx === part.length - 1) return null
    const username = part.slice(0, atIdx)
    const rest = part.slice(atIdx + 1)
    const colonIdx = rest.lastIndexOf(':')
    let host: string
    let port: number | undefined
    if (colonIdx > 0) {
      host = rest.slice(0, colonIdx)
      const parsed = parseInt(rest.slice(colonIdx + 1), 10)
      if (Number.isFinite(parsed)) port = parsed
    } else {
      host = rest
    }
    if (!host) return null
    chain.push({
      inline: {
        host,
        port,
        username,
        authType: 'agent'
      }
    })
  }
  return chain
}
