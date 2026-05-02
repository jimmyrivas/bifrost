/**
 * A single hop in a jump-host chain.
 *
 * Two mutually-exclusive modes:
 *  - `connectionId`: reference an existing Bifrost connection. Credentials are
 *    re-used from that connection (single source of truth, plays nice with the
 *    credential vault). `usernameOverride` allows accessing a shared bastion
 *    as a different user without forking the underlying connection.
 *  - `inline`: ad-hoc host with its own credentials. Useful for one-off
 *    bastions you don't want to save as a regular connection.
 */
export interface JumpHostHop {
  connectionId?: string
  inline?: JumpHostInline
  usernameOverride?: string
}

export interface JumpHostInline {
  host: string
  port?: number
  username: string
  authType: 'userpass' | 'key' | 'key_pass' | 'agent'
  privateKeyPath?: string | null
  /** Encrypted via credentialStore. Stored as base64 string at rest in JSON
   *  so DB JSON columns remain text — decoded back to Buffer in main. */
  encryptedPassword?: string | null
  encryptedPassphrase?: string | null
}

/** Ordered chain: hop[0] → hop[1] → … → target. */
export type JumpChain = JumpHostHop[]

/** Wire shape persisted in DB columns `connections.jumpServerConfig` and
 *  `tunnels.jumpServerConfig`. */
export interface JumpServerConfig {
  chain: JumpChain
}

/**
 * Resolved hop with credentials decrypted, ready to feed to ssh2.
 * Produced by `resolver.resolveHop()` in main process only.
 */
export interface ResolvedHop {
  host: string
  port: number
  username: string
  authType: 'userpass' | 'key' | 'key_pass' | 'agent'
  privateKeyPath?: string | null
  password?: string | null
  passphrase?: string | null
}

/** Lookup callback supplied by main process (DB access).
 *  Returns null if the connection no longer exists. */
export type ConnectionLookup = (id: string) => Promise<ConnectionLookupResult | null>

export interface ConnectionLookupResult {
  host: string | null
  port: number | null
  username: string | null
  authType: 'userpass' | 'key' | 'key_pass' | 'fido2' | 'manual' | null
  privateKeyPath: string | null
  encryptedPassword: Buffer | null
  encryptedPassphrase: Buffer | null
  /** Raw JSON for chained cycle detection. */
  jumpServerConfig: string | null
}

/** Decrypt callback — abstracted so resolver works in tests without electron. */
export type DecryptFn = (buf: Buffer | null | undefined) => string | null
