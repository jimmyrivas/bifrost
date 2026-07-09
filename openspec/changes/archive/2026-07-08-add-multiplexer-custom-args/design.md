## Context

Bifrost's multiplexer subsystem builds the shell command used to attach/create a
persistent session (`buildAttachCmd`), one implementation per kind under
`src/main/services/multiplexer/`. The config flows renderer → preload → IPC →
service → per-kind builder:

```
MultiplexerConfig (MultiplexerPanel.tsx)
  → AttachOptions (services/multiplexer/types.ts)
    → preload → multiplexer.ipc.ts → index.ts:buildAttachCmd
      → IMPL[kind].buildAttachCmd(target, opts)   [dtach|tmux|zellij|rmux]
```

Today `AttachOptions` carries `shell`, `createIfMissing`, `forceRunCommands`,
`binaryPath`, `disableMouseCapture`. The command builders already establish two
quoting conventions we reuse rather than invent:

- `shellQuote(s)` → single-quote wrap; safe but suppresses `$HOME`/`~` expansion.
- `dquote(s)` (in `dtach.ts`) → double-quote wrap that escapes `\ " \`` but
  deliberately leaves `$` intact, so `$HOME`/`~`/`$XDG_*` expand on the remote.
  `socketDir` relies on this behavior.

The three CLI grammars differ in where global flags go:
- tmux/rmux: `tmux [GLOBAL] new-session -A -s <name> [shell]`
- zellij: `zellij [GLOBAL] attach [--create] <name> [options …]`
- dtach: `dtach -A <socket> -E -z [FLAGS] <shell>`

## Goals / Non-Goals

**Goals:**
- Let users attach their own config file, a zellij layout, and arbitrary extra
  flags, placed where each binary's parser accepts them.
- Reuse existing quoting conventions; no new quoting primitive unless needed.
- Zero-config upgrade: existing users see no behavior change until they opt in.
- Gate each field to the multiplexers that actually support it, in both the
  command builders and the UI.

**Non-Goals:**
- Environment-variable injection (`FOO=bar tmux …`) — deferred; not requested.
- Per-subcommand flag placement (e.g. `new-session -x 200`). Extra args land in
  the global position only; users needing subcommand flags use their config file.
- Validating that a config file or layout exists on the remote host.
- Parsing/validating `extraArgs` — inserted verbatim by design.

## Decisions

**1. Three structured fields, not one raw blob.**
`configFile`, `layout`, `extraArgs` on both `MultiplexerConfig` and
`AttachOptions`, all optional. Rationale: config file and layout are named,
single-value, and each maps to a *different* flag per multiplexer (`-f` vs
`--config`), so a single raw string can't carry the per-kind flag name. `extraArgs`
remains the raw escape hatch for everything else. Alternative considered: one
"extra args" box per kind — rejected because it pushes the `-f`/`--config`
difference and layout-name knowledge onto the user.

**2. All three land in the global-flag position.** For tmux/rmux/zellij the fields
are emitted before the subcommand; for dtach `extraArgs` lands after `-E -z` and
before the shell (config/layout unsupported). This is the only position that is
valid across create and attach without special-casing subcommand grammar.

**3. Quoting per field:**
- `configFile` → `dquote` (preserve `$HOME`/`~`). A config path with a tilde is the
  common case; single-quoting would break it.
- `layout` → `dquote` as well, so both a bare name (`dev`) and a `.kdl` path
  (`~/layouts/dev.kdl`) work. dquote is safe for bare names too.
- `extraArgs` → **verbatim**, no quoting. It must survive as multiple tokens
  (`-r winch`). Injection is not the threat model: it is the user's own shell on
  their own host, exactly like typing the flags into a terminal.

  To share `dquote` across builders it moves from `dtach.ts` into `types.ts`
  alongside `shellQuote`, and the builders import it.

**4. Layout is create-only.** zellij only honors `--layout` when creating a
session and can error/ignore it on re-attach. The builder adds `--layout` only on
the `create` branch, consistent with how `--force-run-commands` is already gated.

**5. UI gates fields by selected kind.** `MultiplexerPanel` shows: config-file for
tmux/rmux/zellij, layout for zellij only, extra-args for all. Mirrors the existing
`showDtachOptions`/`showFallback` conditional pattern already in the panel.

**6. Persistence migration v6 → v7.** Bump the `bifrost-preferences` persist
`version` to 7 and backfill `configFile: ''`, `layout: ''`, `extraArgs: ''` onto
`localMultiplexer`, following the existing v3 backfill pattern for
`disableMouseCapture`. Connection-level multiplexer config (if stored per
connection) picks up the same defaults via `defaultMultiplexer`.

## Risks / Trade-offs

- **Malformed `extraArgs` breaks the attach command** → Mitigated by scoping it as
  a documented power-user escape hatch with helper text; a bad flag fails loudly
  at attach time (visible in the terminal), not silently.
- **`layout`/`configFile` pointing at a nonexistent remote file** → the multiplexer
  reports its own error to the terminal; we do not pre-validate (Non-Goal). Helper
  text notes the path is resolved on the remote host.
- **dquote does not neutralize `$(…)`/backticks in configFile** → dquote escapes
  backticks; `$(…)` remains possible, but this is the user's own shell (same trust
  boundary as `socketDir`, which already behaves this way). Accepted.
- **Field applies to the wrong multiplexer after the user switches kind** → the
  values persist but each builder ignores unsupported fields, and the UI hides
  them, so a stale `layout` on a tmux session is silently inert, not an error.

## Migration Plan

1. Add fields to types/config with empty defaults (backward-compatible).
2. Bump persist version 6 → 7 with a backfill branch; older payloads load clean.
3. Ship builders + UI together. Rollback is a straight revert — since all fields
   default empty, a downgrade simply ignores any values the user had set (they
   remain in persisted state but are unread).

## Open Questions

- None blocking. Env-var injection and per-subcommand flag placement are
  explicitly deferred (Non-Goals) and can be follow-up changes if demanded.
