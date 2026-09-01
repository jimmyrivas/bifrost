## Context

Bifrost persists local/remote terminals through multiplexer backends in
`src/main/services/multiplexer/` (dtach, tmux, zellij, rmux). Each backend implements
`probe`/`buildAttachCmd`/`killSession`/`cleanStale` behind the `index.ts` façade, driven by
an `executorFor(transport)` that runs shell commands either over the live `ssh2` session
(`sshExecutor`) or locally (`localExecutor`).

Today a tab's title (`Tab.title`, `sessions.store.ts`) lives only in the Zustand store and
the per-device localStorage session manifest (`session-manifest.ts`). It is:
- never linked to the multiplexer session the terminal is attached to, and
- invisible to any other device.

The multiplexer session name is chosen once in `MultiplexerPicker.tsx` (via
`uniqueSessionName`) and never read back into the tab title. There is **no** tab→session
binding and **no** remote metadata store (the only `set-option` use is the mouse toggle in
`tmux.ts`/`rmux.ts`).

The user wants a renamed tab's alias to live *with the session on the server*, so
reattaching restores the last name — from any device.

## Goals / Non-Goals

**Goals:**
- A renamed multiplexer-backed tab's alias is stored on the remote host and restored on
  reattach, independent of the device.
- One uniform mechanism across all four backends.
- The multiplexer picker shows each session's remote alias.
- No new dependencies, no native modules, no schema/DB migration.

**Non-Goals:**
- Aliases for non-multiplexer (ephemeral) terminals — nothing durable to bind them to.
- Multi-writer conflict resolution (locking/merge). Last-writer-wins is acceptable.
- An expandable remote metadata schema beyond a flat alias map.
- Syncing any other tab state (styles, layout) remotely — out of scope.

## Decisions

### Decision 1: Uniform remote sidecar JSON, not per-backend native metadata

Store aliases in a single remote file `~/.config/bifrost/session-aliases.json`, shaped as
`{ [kind]: { [target]: alias } }`, read/written over the same executor the backend already
uses.

- **Why:** Only tmux/rmux expose user options (`set-option @foo` / `show-options`); dtach
  and zellij have no per-session KV at all. A sidecar file gives one code path for all four
  backends, is trivially device-independent (it lives on the host, keyed by the session
  identity Bifrost already computes), and survives multiplexer-server restarts.
- **Alternatives considered:**
  - *tmux `@bifrost_alias` user option (+ sidecar for the others):* most elegant for tmux
    and auto-expires with the session, but forces two divergent mechanisms and still needs
    the sidecar for dtach/zellij. Rejected for uniformity.
  - *Store in Bifrost's local DB:* fails the core requirement — not readable from another
    device.

### Decision 2: Key by `{kind, target}`, the identity Bifrost already resolves

`resolveMultiplexerCmd` (`useTerminal.ts`) already computes the backend `kind` and the
session `target` (tmux/zellij/rmux: the session name; dtach: the `.sock` path). The store
is keyed by exactly this pair. Targets are unique within a backend, and nesting by kind
avoids cross-backend collisions.

### Decision 3: Persist `muxBinding` on the tab

Add `Tab.muxBinding?: { kind: MultiplexerKind; target: string }`. `resolveMultiplexerCmd`
sets it when it resolves an attach/create. This is the missing link that lets a rename know
*where* to write. The transport for the remote write is derived at call time from the tab's
SSH session id (as AppShell already does), so the binding stays minimal.

### Decision 4: Read on probe, prune on successful probe

`probe()` in `index.ts` reads the sidecar once after the backend returns its live session
list, attaches `alias` to each `MultiplexerSession`, and prunes entries whose target is not
in the live list — **only** when the probe itself succeeded (multiplexer available, list
command exit 0). A failed/unavailable probe leaves the file untouched, so aliases are never
lost to a transient outage.

### Decision 5: Write is fire-and-forget, read-modify-write whole file

`setAlias` reads the JSON in main, updates the one entry in JS, and writes the whole file
back atomically (`... > tmp && mv tmp file`) after `mkdir -p`. The renderer calls it on
rename without awaiting UI-critical work; a failure is logged, never blocks the local
rename. Missing/corrupt file → treated as `{}`.

### Decision 6: Apply alias by reusing the existing title-lock path

On attach/auto-attach, if the chosen session has an `alias`, set the tab title to it and
lock it (`renameTab` + `toggleLockTitle`, the same path `TabBar.commitEdit` uses), so
dynamic OSC/AI title detection does not immediately overwrite the restored name.

## Risks / Trade-offs

- **Concurrent edits from two devices** → last-writer-wins. Acceptable for a name string;
  documented. Mitigation kept minimal (atomic whole-file replace avoids partial writes).
- **Stale aliases if pruning never runs** (host never re-probed) → bounded: the file is a
  flat map of short strings; pruning happens on the next successful probe of that host.
- **Remote write latency over slow SSH** → write is off the UI critical path and
  fire-and-forget; the rename is instant locally.
- **Home directory / XDG assumptions** (`~/.config/bifrost/`) → matches XDG convention;
  `mkdir -p` handles first use. Non-POSIX remote shells are already out of scope for the
  existing mux commands.
- **Target churn for dtach** (socket path) → stable for the life of the session; pruning
  cleans up when the socket is gone.

## Migration Plan

Purely additive. No DB migration, no dependency. First run on a host simply finds no
sidecar file and creates it on the first rename. Rollback = revert the code; the leftover
`session-aliases.json` on any host is inert and harmless.

## Open Questions

- None blocking. (Considered: showing the alias as the *default* new-session name in the
  picker — deferred; the picker still suggests `uniqueSessionName`, and aliases apply on
  attach, which is the requested behavior.)
