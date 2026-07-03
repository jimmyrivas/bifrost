# Design — Restore Session Tabs

## Context

- `sessions.store.ts` is `create<SessionsState>(...)` with **no** `persist` middleware, so
  the tab list is purely in-memory. `Tab` = `{ id, title, rootPane, isActive,
  connectionId, lockTitle, terminalStyle, shell, shellArgs, aiDetected, aiCwd }`.
- `App.tsx` on mount: `if (tabs.length === 0) createTab()` → always one empty local tab.
- `before-quit` (`main/index.ts:400`) tears down all live sessions (`destroyAllSessions`,
  `sshManager.disconnectAll`, …). Live sessions cannot be preserved — restore means
  **reopen + reconnect**, not resurrect.
- `preferences.store.ts` already uses Zustand `persist` (localStorage, versioned migrate) —
  the precedent for renderer-side persistence.
- **Mux reattach is already free on connect**: `useTerminal.ts:305-316` probes for live
  multiplexer sessions and, when exactly one is alive, builds an attach command with
  `createIfMissing: false`. The session name derives from a deterministic `sessionPrefix`
  (e.g. `bifrost-{conn}`). So a restored tab that reconnects reattaches automatically — the
  manifest need not store the mux session name.

## Goals / Non-Goals

**Goals**
- Persist restorable tabs; prompt to restore on launch; recreate + connect on accept.
- Connection tabs always; multiplexed local tabs always; non-mux locals never.
- Phase 1: root pane only; skip deleted-connection tabs silently.

**Non-Goals**
- No split-pane layout restore (phase 1).
- No preserving live session state (impossible post-quit) beyond mux reattach.
- No main-process / DB schema change.
- No restore of detached windows as detached (out of scope).

## Decisions

> **Apply-time revision**: implemented with a **plain-localStorage helper**
> (`lib/session-manifest.ts`) instead of Zustand `persist` on `sessions.store`. Reason:
> the live store shape (full `Tab` with `rootPane`, live `terminalId`, Maps/Sets) differs
> from what we persist, so `persist` would rehydrate incomplete tabs into live state; and
> it would write an empty manifest on launch (when `tabs` is momentarily `[]`), clobbering
> the previous session before the prompt is answered. The helper does read-once-at-launch
> + write-after-decision via a vanilla `useSessionsStore.subscribe`. The `partialize`/
> `isRestorable` logic below is preserved as pure functions (`deriveManifest`,
> `isRestorable`, `toManifestTab`).

### Decision 1: Persist via Zustand `persist` + `partialize` on `sessions.store`

Wrap the store with `persist` (localStorage, versioned), mirroring `preferences.store`.
`partialize` serializes only:

```
{ activeTabId,
  tabs: tabs
    .filter(isRestorable)              // SSH conn, or local WITH multiplexer
    .map(t => ({ connectionId: t.connectionId, title: t.title,
                 lockTitle: t.lockTitle, terminalStyle: t.terminalStyle,
                 shell: t.shell, shellArgs: t.shellArgs,
                 multiplexer: muxInfoFor(t) /* kind + sessionPrefix, locals */ })) }
```

Dropped: `id`, `rootPane`/`terminalId` (ephemeral), `isActive`, `aiDetected`, `aiCwd`
(re-detected at runtime).

- **`isRestorable(tab)`**: `tab.connectionId != null` → true; else (local) true only if it
  has an effective multiplexer config (per-connection mux, or `preferences.localMultiplexer`
  != none).
- **Why persist over a main-process JSON file**: precedent in `preferences.store`, no IPC
  needed, survives crashes (continuous write). Alternative (main `session.json` on
  `before-quit`) rejected for phase 1 — `before-quit` is main-only and a crash loses it.
- **Zustand rule (project)**: the persisted snapshot is produced by `partialize` from
  `getState()`, not by a reactive `s.tabs` subscription — no array-selector re-render loop.

### Decision 2: Restore is a launch-time flow in `App.tsx`, gated by a prompt

On mount, instead of unconditionally `createTab()` when empty:

```
const manifest = readPersistedManifest()
if (manifest.tabs.length > 0) showRestorePrompt(manifest)   // Restore / Start fresh
else createTab()                                            // current behavior
```

On **Restore**: for each manifest tab in order, resolve it, then recreate + connect:
- Connection tab → verify `connections.get(connectionId)` exists; if not, **skip silently**.
  Otherwise `createTab(title, connectionId, terminalStyle)` (the existing connect path runs,
  which probes & reattaches the mux).
- Multiplexed local tab → `createTab(title, undefined, style, shell, shellArgs)` with the
  persisted mux config applied so the connect path reattaches.
- Restore only the root pane (ignore any historical split).
- Set the active tab from `activeTabId` (or first restored).

On **Start fresh**: clear/ignore the manifest and `createTab()` as today.

- **Connect immediately on accept** (user's decision): the prompt is the gate, so accepting
  connects every tab. Accepted trade-off: N tabs may surface N credential/MFA prompts.

### Decision 3: A small restore-prompt component

A modal/banner (Spectral Command styling) shown once at launch: "Restore N tabs from your
previous session?" with Restore / Start fresh. Lives in the renderer; no persisted
"always do this" preference in phase 1 (could be added later).

## Risks / Trade-offs

- **Credential/MFA storm**: restoring many SSH tabs triggers many auth prompts at once. →
  Accepted for phase 1 (explicit user choice via the prompt). A future option could stagger
  or defer-connect.
- **Manifest references a stale/edited connection** (host changed, deleted): deleted →
  skipped silently (Decision 2). Edited → reconnects with current settings (acceptable;
  the manifest stores only the id).
- **Local mux session already gone** (machine rebooted): the connect-time probe finds no
  live session; with `createIfMissing:false` it would have nothing to attach. → Ensure the
  restore path tolerates "no live session" (start a fresh mux session or a plain shell);
  confirm behavior during apply.
- **Write frequency**: persisting on every tab mutation. → localStorage writes are cheap and
  Zustand `persist` debounces via its own write; keep `partialize` lightweight.

## Open Questions

- Should "Start fresh" **discard** the manifest or keep it (so a later relaunch could still
  offer it)? Lean: keep until overwritten by the new session's tabs.
- Should there be a "don't ask again / always restore" preference? Deferred — not phase 1.
- Multiplexed-local restore when the mux session is gone: fresh mux session vs plain shell —
  confirm during implementation.
