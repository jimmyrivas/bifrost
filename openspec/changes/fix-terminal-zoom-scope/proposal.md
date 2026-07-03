# Fix Terminal Zoom Scope

## Why

Zooming the terminal font (Ctrl+= / Ctrl+- / Ctrl+0) changes the font size of **every**
open tab, not just the active one. Because Bifrost keeps all tabs mounted for session
persistence, every `useTerminal` instance listens to the same document-level
`terminal:zoom-*` events and applies the zoom to its own terminal. Only the active tab
should respond.

## What Changes

- Scope the zoom event handlers to the active terminal, mirroring the existing
  `isActiveTerminal()` guard already used by the paste handlers in the same hook. Inactive
  tabs ignore zoom events.

No behavior change to paste, broadcast, or any other shared event. No new dependency. No
persisted-state change (zoom is in-memory only today).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `terminal-ui` — clarifies that zoom applies only to the active terminal, not to inactive
  tabs. Refines the existing "Terminal Appearance and Interaction" requirement.

## Impact

- **Renderer**: `src/renderer/src/hooks/useTerminal.ts` — wrap `handleZoomIn` /
  `handleZoomOut` / `handleZoomReset` with the `isActiveTerminal()` check (already defined
  in the same effect for paste). Read the active tab fresh via `useSessionsStore.getState()`
  to avoid a stale closure.
- No main-process, preload, or DB changes.
