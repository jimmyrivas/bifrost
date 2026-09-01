import type { MultiplexerKind, ProbeResult, RemoteExecutor } from './types'

/**
 * Remote, device-independent store for user-assigned tab aliases, kept on the
 * host next to the multiplexer sessions themselves so a renamed tab's name
 * survives app restarts and is restored on reattach from ANY device.
 *
 * A single JSON sidecar file, shaped `{ [kind]: { [target]: alias } }`, read and
 * written over the connection's existing executor (SSH session or local shell).
 * One code path covers all four backends (dtach, tmux, zellij, rmux) — dtach and
 * zellij have no per-session metadata of their own, so a plain file is the only
 * uniform place to keep this.
 */

const STORE_PATH = '$HOME/.config/bifrost/session-aliases.json'

export type AliasMap = Partial<Record<MultiplexerKind, Record<string, string>>>

/**
 * Read the remote alias store. Returns an empty map when the file is absent,
 * unreadable, or contains invalid JSON — never throws to the caller.
 */
export async function readAliases(exec: RemoteExecutor): Promise<AliasMap> {
  try {
    const { stdout, code } = await exec.run(`cat ${STORE_PATH} 2>/dev/null`)
    if (code !== 0 || !stdout.trim()) return {}
    const parsed = JSON.parse(stdout)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as AliasMap
  } catch {
    return {}
  }
}

/** Quote a JSON string for safe inclusion inside a single-quoted heredoc-free
 *  shell command. We write the whole file via `printf %s` fed a single-quoted
 *  literal, escaping embedded single quotes the POSIX way. */
function squote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

/**
 * Set (or overwrite) the alias for one `{kind, target}` and persist the whole
 * store back atomically. Read-modify-write; missing dir/file is created. Never
 * throws — returns false on any failure so callers can log and move on.
 */
export async function writeAlias(
  exec: RemoteExecutor,
  kind: MultiplexerKind,
  target: string,
  alias: string
): Promise<boolean> {
  try {
    const current = await readAliases(exec)
    const next: AliasMap = { ...current, [kind]: { ...(current[kind] ?? {}), [target]: alias } }
    return await persist(exec, next)
  } catch {
    return false
  }
}

/**
 * Remove alias entries for a backend whose target is not in `liveTargets`.
 * Call ONLY after a probe that successfully listed that backend's sessions, so a
 * failed/unavailable probe never deletes live aliases. No-op (and no write) when
 * nothing changes. Never throws.
 */
export async function pruneAliases(
  exec: RemoteExecutor,
  kind: MultiplexerKind,
  liveTargets: string[]
): Promise<void> {
  try {
    const current = await readAliases(exec)
    const forKind = current[kind]
    if (!forKind) return
    const live = new Set(liveTargets)
    const kept: Record<string, string> = {}
    let changed = false
    for (const [target, alias] of Object.entries(forKind)) {
      if (live.has(target)) kept[target] = alias
      else changed = true
    }
    if (!changed) return
    const next: AliasMap = { ...current }
    if (Object.keys(kept).length > 0) next[kind] = kept
    else delete next[kind]
    await persist(exec, next)
  } catch {
    /* leave the store untouched on any error */
  }
}

/**
 * Attach stored aliases to each listed session and prune entries for sessions
 * that no longer exist. Runs ONLY when the probe successfully listed this
 * backend's sessions (binary installed, no listing error) so a failed or
 * unavailable probe never deletes live aliases. Mutates `result.sessions` in
 * place (adding `alias`).
 */
export async function enrichWithAliases(exec: RemoteExecutor, result: ProbeResult): Promise<void> {
  if (!result.installed || result.error) return
  const aliases = await readAliases(exec)
  const forKind = aliases[result.kind] ?? {}
  for (const s of result.sessions) {
    const a = forKind[s.target]
    if (a) s.alias = a
  }
  await pruneAliases(exec, result.kind, result.sessions.map((s) => s.target))
}

async function persist(exec: RemoteExecutor, map: AliasMap): Promise<boolean> {
  const json = JSON.stringify(map, null, 2)
  const dir = '$HOME/.config/bifrost'
  const tmp = `${STORE_PATH}.tmp.$$`
  const cmd =
    `mkdir -p ${dir} && ` +
    `printf %s ${squote(json)} > ${tmp} && ` +
    `mv ${tmp} ${STORE_PATH}`
  const { code } = await exec.run(cmd)
  return code === 0
}
