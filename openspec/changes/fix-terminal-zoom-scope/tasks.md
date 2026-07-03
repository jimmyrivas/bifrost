# Tasks — Fix Terminal Zoom Scope

## 1. Scope zoom to the active terminal

- [x] 1.1 Wrapped `handleZoomIn` / `handleZoomOut` / `handleZoomReset` in `useTerminal.ts` with the existing `isActiveTerminal()` guard so inactive tabs ignore zoom events
- [x] 1.2 Confirmed `isActiveTerminal()` reads the active tab via `useSessionsStore.getState()` at call time (no stale closure); handlers only invoke it at event-dispatch time, so no TDZ despite the later `const` definition

## 2. Verification

- [x] 2.1 `pnpm typecheck` clean; `pnpm lint` introduces no new issues (the 8 remaining warnings in this file — console statements, `AI_PATTERNS` deps — pre-date this change); 235 unit tests pass
- [ ] 2.2 Manual: open 2+ tabs, zoom in/out/reset on the active tab → only the active terminal changes; switch tabs and confirm the previously-zoomed tab kept its own size and the others are untouched
- [ ] 2.3 Manual: confirm paste/broadcast still behave correctly (shared event handlers untouched)
