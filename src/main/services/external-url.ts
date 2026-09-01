/**
 * Whether a URL is safe to hand to `shell.openExternal` from terminal output.
 * Only `http:`/`https:` are allowed — never `file:`, `javascript:`, `data:`, or
 * any other scheme that could be weaponized by hostile output. Kept electron-free
 * so it can be unit-tested without the main-process runtime.
 */
export function isOpenableExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
