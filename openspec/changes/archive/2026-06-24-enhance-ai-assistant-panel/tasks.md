# Tasks — Enhance AI Assistant Panel

## 1. Multi-line prompt editor

- [x] 1.1 In `AIAssistant.tsx`, replace the single-line `<input>` (ref `inputRef`) with an auto-growing `<textarea>`; keep the same value/onChange wiring to `query`
- [x] 1.2 Implement auto-grow: track `scrollHeight` up to `PROMPT_MAX_HEIGHT_PX` (144px ≈ 6 rows), then scroll internally; height resets when `query` clears after submit (effect on `[query]`)
- [x] 1.3 Update `onKeyDown`: Enter (no Shift) → `preventDefault()` + `handleSubmit()`; Shift+Enter → allow default newline
- [x] 1.4 Keep submit disabled while `loading`; preserve focus-on-open behavior and `aria-label`

## 2. Adjustable, persisted panel width

- [x] 2.1 In `AppShell.tsx`, replace the fixed `w-72 shrink-0` AI panel `<div>` with a width-driven container plus a custom `cursor-col-resize` drag handle on its left edge (custom handle chosen over a react-resizable-panels `Panel` — see design Decision 2)
- [x] 2.2 Clamp the panel to ≈280px min / ≈720px max via `clampAiPanelWidth`; the terminal area is `flex-1 min-w-0` so it keeps priority on shrink
- [x] 2.3 Persist width as an explicit pixel field `terminal.aiPanelWidthPx` in `preferences.store.ts` (default 320, version bump 5→6 + migrate backfill); live `aiDragWidth` state during drag, commit clamped px on `mouseup`
- [x] 2.4 Width lives in preferences (not in the mounted node), so toggling `{aiAssistantOpen && !aiDetached}` re-reads the persisted width on remount — conditional mount does not lose the saved layout

## 3. Detach / reattach the assistant

- [x] 3.1 In `src/main/index.ts`, added `window:detachAi` (opens a `BrowserWindow` with `?aiDetach=1&connId=<id>`), `window:reattachAi`, and `window:notifyAiContext` (forwards to the detached window); emits `window:aiReattached` on close
- [x] 3.2 Exposed `detachAi` / `reattachAi` / `onAiReattached` / `notifyAiContext` / `onAiActiveContextChanged` in `src/preload/index.ts`
- [x] 3.3 In `App.tsx`, added an `?aiDetach=1` branch rendering the standalone `DetachedAIAssistant` (new component), reading `connId` from the query for initial context
- [x] 3.4 Added a detach button to the `AIAssistant` header (icon, button only); click calls `detachAi` and `AppShell` hides the docked panel via `aiDetached`
- [x] 3.5 `AppShell` subscribes to `onAiReattached` and restores the docked panel; the detached window's close (or its re-attach button → `reattachAi`) triggers it
- [x] 3.6 Live context follow: `AppShell` calls `notifyAiContext({connectionId, terminalId})` on active-tab change while detached; `DetachedAIAssistant` subscribes via `onAiActiveContextChanged` and updates the context passed to `buildRichContext`
- [x] 3.7 The detached window builds context from the live `connId` and routes inserted commands to the active `terminalId`; degrades to local/fallback context when there is no active session

## 4. Verification

- [x] 4.1 Added unit tests for the extracted `clampAiPanelWidth` helper (4 cases); full suite green (225 passing)
- [x] 4.2 `pnpm typecheck` clean; `pnpm lint` introduces no new errors (the 2 `useFallback` rules-of-hooks errors + the preload `SshAlgorithms` warning pre-date this change; added `console.error`s match existing repo style)
- [x] 4.3 Manual verification by the user: multi-line prompt (Enter sends, Shift+Enter newlines), panel resize + pixel-width persistence across restart, detach → prompt against active SSH session → active-tab follow → reattach — all confirmed working
- [x] 4.4 Production build verified: `scripts/build-appimage.sh` ran clean (electron-vite production build, 2164 modules, minified renderer; Bifrost-0.2.0.AppImage packaged) and the user confirmed no React #185 regression at runtime. Only primitive field selectors were added; the `{connectionId, terminalId}` object is built for IPC, not used in a selector.
