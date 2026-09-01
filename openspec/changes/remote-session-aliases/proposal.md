## Why

When a user renames a tab to remember what a terminal is for (e.g. "deploy-prod", "tailing logs"), that name lives only in the local Zustand store and the per-device localStorage session manifest. It is lost the moment the user opens Bifrost on another machine, and it is never linked to the multiplexer session actually running on the server. The user wants the tab alias to travel *with the multiplexer session on the remote host*, so that reattaching a persisted session — from any device — restores the last name they gave it.

## What Changes

- Store a tab's alias **on the remote host**, alongside the multiplexer session it is attached to, in a uniform sidecar file (`~/.config/bifrost/session-aliases.json`) keyed by backend + session target. One code path for all four backends (dtach, tmux, zellij, rmux).
- **Write** the alias whenever the user renames a tab that is backed by a multiplexer session.
- **Read** the alias back during multiplexer probe: each listed session carries its remote alias, so the multiplexer picker shows it, and attaching (or auto-attaching) applies it as the tab title — independent of the device.
- Persist the resolved multiplexer identity (`{kind, target}`) onto the tab so Bifrost knows *where* to write the alias when the tab is renamed.
- Prune stale alias entries during a successful probe so the sidecar file does not accumulate names for sessions that no longer exist.

## Capabilities

### New Capabilities
- `remote-session-aliases`: storing a renamed tab's alias remotely with its multiplexer session, and restoring it on attach from any device — the remote alias store, the write-on-rename path, the read-on-probe/attach path, tab→session identity binding, and stale-entry pruning.

### Modified Capabilities
<!-- The multiplexer picker surfacing the alias and applying it on attach is specified within the new capability to keep a single contract. No existing spec's requirements are being rewritten. -->

## Impact

- **Main / services**: `src/main/services/multiplexer/` — new `alias-store.ts` (remote read/write/prune via the existing SSH/local executor); `MultiplexerSession` type gains `alias?`; `index.ts` `probe()` merges aliases and prunes; new `setAlias` operation.
- **IPC**: `src/main/ipc/multiplexer.ipc.ts` — new `multiplexer:setAlias` channel; `probe` response carries aliases.
- **Preload**: `window.bifrost.multiplexer.setAlias`.
- **Renderer**: `Tab` gains a `muxBinding?: { kind, target }` field (`sessions.store.ts`); `useTerminal.resolveMultiplexerCmd` records the binding and applies a remote alias on attach/auto-attach; `TabBar.commitEdit` / `renameTab` triggers the remote write; `MultiplexerPicker` displays each session's alias.
- **No new dependencies.** No native modules. Cross-device by construction; last-writer-wins on concurrent edits (documented limitation).
