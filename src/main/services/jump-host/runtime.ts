import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../db'
import { credentialStore } from '../credential-store'
import {
  parseJumpServerConfig,
  resolveChain,
  detectCycle
} from './resolver'
import { sealInlinePasswords as sealPure } from './seal'
import type {
  ConnectionLookup,
  ConnectionLookupResult,
  DecryptFn,
  JumpChain,
  ResolvedHop
} from './types'

/** Production lookup: reads connections from the live DB. */
export const dbConnectionLookup: ConnectionLookup = async (id: string) => {
  const db = getDatabase()
  const conn = db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.id, id))
    .get()
  if (!conn) return null
  const result: ConnectionLookupResult = {
    host: conn.host ?? null,
    port: conn.port ?? null,
    username: conn.username ?? null,
    authType: (conn.authType as ConnectionLookupResult['authType']) ?? null,
    privateKeyPath: conn.privateKeyPath ?? null,
    encryptedPassword: conn.encryptedPassword ?? null,
    encryptedPassphrase: conn.encryptedPassphrase ?? null,
    jumpServerConfig: conn.jumpServerConfig ?? null
  }
  return result
}

/** Production decrypt: routes Buffer through electron safeStorage. */
export const safeStorageDecrypt: DecryptFn = (buf) => {
  if (!buf) return null
  try {
    const text = credentialStore.decrypt(buf)
    return text || null
  } catch {
    return null
  }
}

/**
 * Convenience wrapper used by IPC handlers. Reads `jumpServerConfig` JSON,
 * resolves it through DB lookups + decrypt, and returns a chain ready for
 * ssh-manager. Returns an empty array when no jump host is configured.
 */
export async function resolveJumpChainForJson(
  jsonOrChain: string | JumpChain | null | undefined
): Promise<ResolvedHop[]> {
  const chain =
    typeof jsonOrChain === 'string' || jsonOrChain == null
      ? parseJumpServerConfig(jsonOrChain ?? null)
      : jsonOrChain
  if (chain.length === 0) return []
  return resolveChain(chain, dbConnectionLookup, safeStorageDecrypt)
}

/** Cycle check helper used at save time. */
export async function checkCycleForJson(
  rootConnectionId: string | undefined,
  jsonOrChain: string | JumpChain | null | undefined
): Promise<string | null> {
  const chain =
    typeof jsonOrChain === 'string' || jsonOrChain == null
      ? parseJumpServerConfig(jsonOrChain ?? null)
      : jsonOrChain
  if (chain.length === 0) return null
  return detectCycle(rootConnectionId, chain, dbConnectionLookup)
}

/**
 * Wrapper around the pure sealer that uses electron safeStorage for encryption.
 * The pure logic lives in `./seal` so it can be tested without electron.
 */
export function sealInlinePasswords(json: string | null | undefined): string | null {
  return sealPure(json, (plain) => credentialStore.encrypt(plain).toString('base64'))
}
