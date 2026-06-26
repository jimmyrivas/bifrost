# Tasks — Improve Idle Session Summary

## 1. Fix the summary content (buffer id)

- [x] 1.1 Added `rawSessionId(id)` (strips `ssh:`/`mosh:` prefix) plus `meaningfulLineCount`/`hasMeaningfulContent` in `src/renderer/src/lib/session-summary.ts`
- [x] 1.2 `XTerminal.tsx` `requestAiSummary` (and the idle poll) now call `getBuffer(rawSessionId(terminalIdRef.current))` — SSH/mosh buffers resolve correctly
- [x] 1.3 Applied the same helper in `AIAssistant.tsx` `buildRichContext` (had the identical prefix bug)
- [x] 1.4 Fixed `ai:generate` IPC handler in `src/main/ipc/ai.ipc.ts`: it never accumulated streamed chunks (`fullResponse = fullResponse`) so always returned `''` → "Could not generate summary." Now `fullResponse += chunk.text`. (Discovered during manual verification — not the multiplexers.)

## 2. Reliable idle/activity detection

- [x] 2.1 Removed the `MutationObserver`-based activity tracking (xterm paints to a WebGL canvas)
- [x] 2.2 Activity now derived from real output: a poll compares buffer length growth; `mousedown`/`keydown` still count as user activity
- [x] 2.3 Idle evaluated on a 20s interval so the affordance can appear while away; interval + collapse timer cleared on unmount

## 3. Gate visibility on meaningful content

- [x] 3.1 Cheap `hasMeaningfulContent(buffer, errorCount)` check (no AI call): non-trivial line count or detected errors
- [x] 3.2 Affordance set only when `nonTrivialLines >= MIN_SUMMARY_LINES` (3) or errors exist; otherwise nothing renders
- [x] 3.3 AI summary generated on-demand only (on expand) — no proactive generation

## 4. Auto-collapse to a corner icon

- [x] 4.1 Replaced the persistent full-width banner with a two-state affordance scoped to the pane
- [x] 4.2 Collapsed state: small floating icon button in the pane's top-right corner, badge dot when a summary is ready or errors are present
- [x] 4.3 Auto-collapse after 6s with no interaction; clicking the icon expands and lazily generates the summary
- [x] 4.4 Save-as-Note and Dismiss preserved in the expanded state; Dismiss removes the affordance until the next idle period (`dismissedRef`, reset on new output)
- [x] 4.5 Idle affordance is `z-20` above the broadcast banner (`z-10`); positioned in the top-right corner, off the terminal content/scrollbar

## 5. Verification

- [x] 5.1 `pnpm typecheck` clean; `pnpm lint` introduces no new errors (the 2 `useFallback` rules-of-hooks errors pre-date this change; XTerminal has 2 benign `terminalIdRef` ref exhaustive-deps warnings, matching existing repo style)
- [x] 5.2 Unit tests for the pure helpers (`rawSessionId`, `meaningfulLineCount`, `hasMeaningfulContent`) — 10 cases; full suite 235 passing
- [x] 5.3 Manual verification by the user in the production AppImage: the indicator now surfaces only with real session output (the empty-summary and "Could not generate summary" cases are resolved — the latter surfaced the `ai:generate` accumulation bug, fixed in 1.4); collapse/expand/Save-as-Note/Dismiss confirmed
- [x] 5.4 Production AppImage built clean from the minified build; user navigated it without React #185 regressions
