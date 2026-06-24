# Design — Enhance AI Assistant Panel

## Context

The AI Assistant is `AIAssistant.tsx`, mounted in `AppShell.tsx` as a fixed-width column:

```
AppShell
└─ PanelGroup (react-resizable-panels, horizontal)
   └─ Panel
      └─ <div class="flex">
         ├─ terminal area (flex-1)
         └─ {aiAssistantOpen && <div class="w-72 shrink-0 border-l"> <AIAssistant/> </div>}
```

- The prompt is a single-line `<input>` (`AIAssistant.tsx:430`); `onKeyDown` submits on
  Enter.
- The panel is a plain `w-72` (288px) `<div>` with `shrink-0` — **not** a resizable
  `Panel`, even though the shell already imports `Panel`/`PanelResizeHandle`.
- A detach mechanism already exists for terminal tabs: `window:detachTab` (main,
  `index.ts:244`) opens a `BrowserWindow` with `?detach=<id>&connId=&sessionId=`, the
  renderer reads the query to render only that view, `window:reattachTab` closes it, and
  `window:tabReattached` notifies the main window. State is per-window React state.
- `preferences.store.ts` has no panel-width field today.

## Goals / Non-Goals

**Goals**
- Multi-line prompt editor (Enter submits, Shift+Enter newline, auto-grow).
- User-resizable panel width, persisted.
- Detach/reattach the assistant into its own window, reusing the existing pattern.

**Non-Goals**
- No change to AI generation behavior, model selection, or the fallback library
  (`session-observability` owns that).
- No conversation persistence/sync across windows — the detached window starts its own
  conversation (matches today's per-window React state for terminals).
- No DB schema change.

## Decisions

### Decision 1: Multi-line input via auto-growing `<textarea>`

Replace the `<input>` with a `<textarea>` whose height tracks `scrollHeight` between a
min (~1 row) and max (~6 rows / ~9rem), then scrolls. Keydown: `Enter` (no Shift) →
`preventDefault()` + submit; `Shift+Enter` → default newline.

- **Why over a contentEditable / rich editor**: textarea is native, accessible, zero-dep,
  and the existing send-on-Enter logic ports directly.
- **Alternative considered**: a fixed taller input — rejected; doesn't scale to long
  prompts and wastes space for short ones.

### Decision 2: Resizable width via a custom drag handle, persisted as pixels in preferences

The docked panel is **conditionally rendered** (`{aiAssistantOpen && ...}`). Adding/
removing a `react-resizable-panels` `Panel` from the top `PanelGroup` on toggle causes
layout recalculation/thrash and needs `order`/remount handling. Combined with the
decision to persist an exact **pixel** width (the library is percentage-based), a small
custom drag handle is simpler and more robust — and it matches the existing pattern in
this codebase (the SFTP side panel already uses an explicit pixel width).

- **Implementation**: a thin `cursor-col-resize` handle on the panel's left edge; on
  `mousedown` capture `{startX, startWidth}` and attach `mousemove`/`mouseup` to
  `window`. During the drag, a local `aiDragWidth` state gives live feedback (no
  localStorage writes per frame); on release, commit the clamped width to
  `terminal.aiPanelWidthPx`. Effective width = `aiDragWidth ?? aiPanelWidthPx`.
- **Persistence (DECIDED)**: explicit pixel field `terminal.aiPanelWidthPx` in
  `preferences.store.ts`, clamped to 280–720px via `clampAiPanelWidth` at read/write.
- **Alternatives considered**: (a) a sibling `react-resizable-panels` `Panel` — rejected
  because of conditional-mount fragility and percentage-based persistence drifting from
  exact pixels; (b) the library's `autoSaveId` layout persistence — rejected, stores
  percentages.

### Decision 3: Detach by reusing the terminal detach window mechanism

Add an AI-specific detach path mirroring `window:detachTab`. The detached window loads
with a query flag (e.g. `?aiDetach=1&connId=<activeConnectionId>`); the renderer's
top-level router (the same place that handles `?detach=`) renders a standalone
`<AIAssistant>` chrome when the flag is present. Closing the window fires a
`reattached`-style event so the main window restores the docked panel.

- **Why**: proven pattern, identical lifecycle (open → claim via query → close → notify).
- **Generalize vs duplicate**: prefer adding `window:detachAi` / `window:reattachAi`
  handlers and an `aiDetach` query branch, keeping the terminal path untouched to avoid
  regressions. A later refactor can generalize both into one "detach surface" helper.
- **Context for the detached window (DECIDED: follow the active tab live)**: pass the
  active `connectionId` via query for the initial render, then keep the detached window in
  sync with the main window's active tab. The main window emits an event (e.g.
  `window:aiActiveContextChanged` with the new `connectionId` + active terminal id)
  whenever the active tab changes; the detached `<AIAssistant>` listens and updates the
  context it sends to `buildRichContext`. Terminal-buffer context (`terminal.getBuffer`)
  is read over IPC by terminal id, which is main-process global, so the detached window
  fetches the latest buffer for whatever the active session is. If no active session, it
  degrades to local/fallback context exactly as docked.

## Risks / Trade-offs

- **Percent vs pixel width** with react-resizable-panels → users may see slightly
  different absolute widths at different window sizes. Mitigation: rely on `autoSaveId`
  layout persistence and clamp with `minSize`/`maxSize`; document that width is relative.
- **Live context sync adds an IPC channel** → the detached assistant follows the main
  window's active tab (decided), so the main window must broadcast active-context changes
  and the detached window must react. Mitigation: a single
  `window:aiActiveContextChanged` event carrying `{ connectionId, terminalId }`; debounce
  rapid tab switches; the detached window only re-reads context on next prompt, not on
  every keystroke.
- **Zustand selector pitfall** (project rule) → when reading panel width / session state
  in `AppShell`/`AIAssistant`, use individual field selectors and `getState()` in
  callbacks; never subscribe to object/array selectors (React #185).
- **No conversation transfer on detach** → in-flight conversation does not move to the new
  window. Mitigation: acceptable for v1; called out as a non-goal.

## Migration Plan

No data migration. If a new preference field is added, default it (e.g. width unset →
current 288px-equivalent) so existing users see no change until they resize. Rollback is
removing the new field/handlers; no persisted connection data is touched.

## Resolved Decisions (previously open)

- **Detach trigger**: header button only (icon next to refresh/close). No keybinding or
  command-palette entry in this change.
- **Width persistence**: explicit pixel field in preferences (`terminal.aiPanelWidthPx`),
  converted to/from the panel-group percentage on resize/mount. Not `autoSaveId`.
- **Detached context**: the detached AI window FOLLOWS the main window's active tab live,
  via a `window:aiActiveContextChanged` event.
