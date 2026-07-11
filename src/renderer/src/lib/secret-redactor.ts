/**
 * Secret Redaction — Detect and mask sensitive data in terminal output.
 * Inspired by Warp's secret redaction feature.
 *
 * Detects: AWS keys, GitHub tokens, API keys, bearer tokens, passwords in URLs,
 * private keys, generic secrets in env-like assignments.
 */

import { usePreferencesStore } from '@renderer/stores/preferences.store'

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  // AWS Access Key IDs
  { name: 'aws-key', regex: /\b(AKIA[0-9A-Z]{16})\b/g, replacement: 'AKIA****************' },
  // AWS Secret Keys (40 chars base64)
  { name: 'aws-secret', regex: /\b([A-Za-z0-9/+=]{40})\b/g, replacement: '****************************************' },
  // GitHub tokens
  { name: 'github-token', regex: /\b(ghp_[A-Za-z0-9]{36})\b/g, replacement: 'ghp_************************************' },
  { name: 'github-oauth', regex: /\b(gho_[A-Za-z0-9]{36})\b/g, replacement: 'gho_************************************' },
  // GitLab tokens
  { name: 'gitlab-token', regex: /\b(glpat-[A-Za-z0-9\-_]{20,})\b/g, replacement: 'glpat-********************' },
  // OpenAI/Anthropic API keys
  { name: 'openai-key', regex: /\b(sk-[A-Za-z0-9]{32,})\b/g, replacement: 'sk-********************************' },
  // Bearer tokens in headers
  { name: 'bearer', regex: /(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, replacement: '$1[REDACTED]' },
  // Authorization headers
  { name: 'auth-header', regex: /(Authorization:\s*)\S+/gi, replacement: '$1[REDACTED]' },
  // Passwords in URLs (user:pass@host)
  { name: 'url-password', regex: /:\/\/([^:]+):([^@]+)@/g, replacement: '://$1:[REDACTED]@' },
  // Generic password/secret assignments
  { name: 'password-assign', regex: /((?:password|passwd|secret|token|api_key|apikey|access_key|private_key)\s*[=:]\s*)\S+/gi, replacement: '$1[REDACTED]' },
  // Private key blocks
  { name: 'private-key', regex: /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE KEY-----/g, replacement: '-----BEGIN PRIVATE KEY-----\n[REDACTED]\n-----END PRIVATE KEY-----' },
  // Slack tokens
  { name: 'slack-token', regex: /\b(xox[bpsar]-[A-Za-z0-9\-]{10,})\b/g, replacement: 'xox*-[REDACTED]' },
  // Generic hex secrets (32+ chars that look like hashes/tokens)
  { name: 'hex-secret', regex: /((?:key|token|secret|hash)\s*[=:]\s*)([0-9a-f]{32,})/gi, replacement: '$1[REDACTED]' }
]

/**
 * Redaction state is persisted in the preferences store (a terminal
 * preference), so the toggle survives restarts and is initialized on startup
 * from the loaded value. We cache the flag locally — kept in sync with the
 * store — so `redactSecrets` (called on every terminal data chunk) avoids a
 * store read per write.
 */
let enabled = usePreferencesStore.getState().terminal.secretRedactionEnabled

usePreferencesStore.subscribe((state) => {
  enabled = state.terminal.secretRedactionEnabled
})

export function setSecretRedactionEnabled(value: boolean): void {
  usePreferencesStore.getState().setTerminalPref('secretRedactionEnabled', value)
}

export function isSecretRedactionEnabled(): boolean {
  return enabled
}

/**
 * Redact secrets from terminal output.
 * Returns the redacted string. Only processes if redaction is enabled.
 */
export function redactSecrets(data: string): string {
  if (!enabled) return data
  let result = data
  for (const { regex, replacement } of SECRET_PATTERNS) {
    // Reset regex lastIndex for global patterns
    regex.lastIndex = 0
    result = result.replace(regex, replacement)
  }
  return result
}

/**
 * Check if a string contains potential secrets (for AI context filtering).
 * Returns true if any secret pattern matches.
 */
export function containsSecrets(data: string): boolean {
  for (const { regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0
    if (regex.test(data)) return true
  }
  return false
}
