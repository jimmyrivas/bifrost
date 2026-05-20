/**
 * Returns the base name with a non-colliding 3-digit suffix appended.
 * If `base` already ends in `-NNN`, the suffix is replaced. Searches
 * 001..999 sequentially and falls back to a base36 timestamp on overflow.
 *
 * Why: tmux/zellij silently attach instead of creating when a session of the
 * same name already exists, and dtach refuses to bind an in-use socket. A
 * stable, predictable suffix lets the user click "Create" repeatedly and get
 * fresh sessions every time.
 */
export function uniqueSessionName(base: string, existing: Iterable<string>): string {
  const trimmed = (base || '').trim()
  const root = trimmed.replace(/-\d{3}$/, '') || 'session'
  const used = new Set<string>()
  for (const name of existing) {
    if (typeof name === 'string') used.add(name)
  }
  for (let i = 1; i < 1000; i++) {
    const candidate = `${root}-${String(i).padStart(3, '0')}`
    if (!used.has(candidate)) return candidate
  }
  return `${root}-${Date.now().toString(36)}`
}
