import type { ResolvedHop } from './types'

/**
 * Build the value of mosh's `--ssh=` argument so the underlying ssh client
 * uses ProxyJump (`-J user@host:port[,user2@host2:port2,…]`) before reaching
 * the target.
 *
 * Returns `null` when no chain is provided. Returns `null` when the chain
 * uses password auth on a hop, since OpenSSH's `-J` doesn't support inline
 * passwords — the caller can decide to fall back or surface a warning.
 *
 * Implementation notes:
 *  - `-i <key>` is added when a hop uses key auth and points at a private key
 *    file. Only the first key is forwarded — chained keys would need
 *    per-hop ssh_config which is out of scope for v1.
 *  - All hops with port ≠ 22 include the `:port` suffix.
 */
export interface MoshSshFlagResult {
  flag: string | null
  /** Reason flag is null (not buildable). Useful for surfacing UI hints. */
  reason?: string
}

export function buildMoshSshFlag(chain: ResolvedHop[]): MoshSshFlagResult {
  if (chain.length === 0) return { flag: null }

  const passwordHop = chain.find((h) => h.authType === 'userpass' && h.password)
  if (passwordHop) {
    return {
      flag: null,
      reason:
        'Mosh + jump host requires key-based auth or SSH agent on the bastion (OpenSSH -J cannot consume saved passwords).'
    }
  }

  const jParts = chain.map((hop) => {
    const port = hop.port && hop.port !== 22 ? `:${hop.port}` : ''
    return `${hop.username}@${hop.host}${port}`
  })

  let cmd = `ssh -o StrictHostKeyChecking=accept-new -J ${jParts.join(',')}`

  // Forward the first hop's private key (if any). Mosh cli passes -i through.
  const keyHop = chain.find((h) => h.privateKeyPath)
  if (keyHop?.privateKeyPath) {
    cmd += ` -i ${shellArg(keyHop.privateKeyPath)}`
  }

  return { flag: cmd }
}

/** Quote a path for safe inclusion as a single argument. */
function shellArg(s: string): string {
  if (/^[A-Za-z0-9_./-]+$/.test(s)) return s
  return `'${s.replace(/'/g, `'\\''`)}'`
}
