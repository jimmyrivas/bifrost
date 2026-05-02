/** Encryptor: takes plain text, returns a base64-encoded ciphertext string. */
export type EncryptFn = (plain: string) => string

/**
 * Walk a JumpServerConfig JSON and encrypt any plain `password` /
 * `passphrase` fields found in inline hops. Plain fields are dropped after
 * encryption so they never reach disk in clear. Existing `encryptedPassword`
 * fields are preserved when the user leaves the password input blank.
 *
 * Returns the JSON string ready to persist (or null when input was null/empty).
 * Pure (no electron import) — safe to test directly.
 */
export function sealInlinePasswords(
  json: string | null | undefined,
  encrypt: EncryptFn
): string | null {
  if (!json) return null
  let parsed: { chain?: unknown[] }
  try {
    parsed = JSON.parse(json)
  } catch {
    return json
  }
  if (!parsed || !Array.isArray(parsed.chain)) return json

  const chain = parsed.chain as Array<
    {
      inline?: {
        password?: string | null
        passphrase?: string | null
        encryptedPassword?: string | null
        encryptedPassphrase?: string | null
      } & Record<string, unknown>
    } & Record<string, unknown>
  >

  for (const hop of chain) {
    const inline = hop.inline
    if (!inline) continue
    if (typeof inline.password === 'string' && inline.password.length > 0) {
      inline.encryptedPassword = encrypt(inline.password)
      inline.password = undefined
    } else if (inline.password === '' || inline.password === null) {
      inline.password = undefined
    }
    if (typeof inline.passphrase === 'string' && inline.passphrase.length > 0) {
      inline.encryptedPassphrase = encrypt(inline.passphrase)
      inline.passphrase = undefined
    } else if (inline.passphrase === '' || inline.passphrase === null) {
      inline.passphrase = undefined
    }
  }

  return JSON.stringify(parsed)
}
