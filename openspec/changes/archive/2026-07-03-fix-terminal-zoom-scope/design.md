# Design — Fix Terminal Zoom Scope

## Context

Zoom is dispatched globally and handled per-instance:

- `App.tsx` global keydown → `document.dispatchEvent(new CustomEvent('terminal:zoom-in'))`
  (and `-out` / `-reset`). The event carries no target.
- `useTerminal.ts` (one instance per mounted pane) registers document listeners
  (`:486–488`): `handleZoomIn → zoomIn()`, etc. Each `zoomIn/zoomOut/resetZoom`
  (`:203–232`) mutates its own `terminalRef.current.options.fontSize`.
- Bifrost keeps every tab mounted (terminal-persistence rule), so all hook instances
  receive the event → all terminals zoom.

The fix already exists in the same effect for a sibling problem: `handlePaste` /
`handlePasteImage` call `isActiveTerminal()` (`:431–436`), which compares
`terminalIdRef.current` against `useSessionsStore.getState().tabs`'
`activeTab.rootPane.terminalId` and returns null when they differ. Zoom handlers simply
don't use it.

## Goals / Non-Goals

**Goals**
- Only the active terminal responds to zoom in/out/reset.

**Non-Goals**
- No change to how zoom is dispatched from `App.tsx` (keep the global event).
- No per-split-pane focus targeting — out of scope (see Open Questions).
- No persistence of zoom level (it is in-memory today; unchanged).

## Decisions

### Decision 1: Guard zoom handlers with the existing `isActiveTerminal()`

Wrap the three handlers so they no-op on inactive instances:

```
const handleZoomIn = (): void => { if (isActiveTerminal()) zoomIn() }
const handleZoomOut = (): void => { if (isActiveTerminal()) zoomOut() }
const handleZoomReset = (): void => { if (isActiveTerminal()) resetZoom() }
```

- **Why**: minimal, and consistent with the paste handlers already in this effect — one
  proven "am I the active terminal?" predicate, not a second mechanism.
- **Stale-closure note**: `isActiveTerminal()` reads `useSessionsStore.getState()` at call
  time (not a captured `activeTab`), so the guard is correct even though the effect's dep
  array is `[zoomIn, zoomOut, resetZoom]`. Confirm it stays a `getState()` read.
- **Alternative considered**: put the active `terminalId` in the event `detail` from
  `App.tsx` and compare per-instance. Rejected for this fix — touches two files and
  duplicates "who is active" logic that already lives behind `isActiveTerminal()`.

## Risks / Trade-offs

- **`isActiveTerminal()` compares against `rootPane.terminalId` only.** With split panes in
  one tab, a non-root focused pane may not match. For zoom this means a split tab might
  zoom only its root pane. Acceptable for this fix (matches current paste behavior); broader
  per-pane focus is a separate concern. → Open Question.
- **Detached windows**: a detached terminal renders via `DetachedTerminal`, not this hook
  path, and has its own window/keybindings — unaffected by this change.

## Open Questions

- Should zoom (and paste) target the *focused pane* rather than the tab's root pane when a
  tab is split? Out of scope here; worth a follow-up if split-pane zoom feels wrong.
