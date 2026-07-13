import type { SshAlgorithms } from './ssh-manager'

/**
 * Typed SSH options parsed out of a connection's `sshConfig.options` blob (the
 * SSH-config-style key/value pairs the SshOptionsPanel saves). Only the fields
 * the ssh-manager actually consumes end-to-end are surfaced here:
 *   - algorithms  → applied to the ssh2 connect config (Ciphers/MACs/KEX/hostkey)
 *   - x11Forward  → applied to the ssh2 shell request
 * ForwardAgent and HTTP proxy are intentionally NOT returned: the connect path
 * doesn't consume them yet, so surfacing them would be an inert control.
 */
export interface ParsedSshOptions {
  algorithms?: SshAlgorithms
  x11Forward?: boolean
}

/** Split a comma-separated option value into a clean list, or undefined. */
function toList(value: unknown): string[] | undefined {
  if (typeof value !== 'string') return undefined
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

export function parseSshOptions(sshConfigJson: string | null | undefined): ParsedSshOptions {
  if (!sshConfigJson) return {}

  let options: Record<string, unknown> = {}
  try {
    const cfg = JSON.parse(sshConfigJson) as { options?: Record<string, unknown> }
    if (cfg && typeof cfg.options === 'object' && cfg.options) {
      options = cfg.options
    }
  } catch {
    return {}
  }

  const algorithms: SshAlgorithms = {}
  const ciphers = toList(options.Ciphers)
  const hmac = toList(options.MACs)
  const kex = toList(options.KexAlgorithms)
  const hostkey = toList(options.HostKeyAlgorithms)
  if (ciphers) algorithms.ciphers = ciphers
  if (hmac) algorithms.hmac = hmac
  if (kex) algorithms.kex = kex
  if (hostkey) algorithms.hostkey = hostkey

  const result: ParsedSshOptions = {}
  if (Object.keys(algorithms).length > 0) result.algorithms = algorithms
  if (options.ForwardX11 === 'yes') result.x11Forward = true
  return result
}
