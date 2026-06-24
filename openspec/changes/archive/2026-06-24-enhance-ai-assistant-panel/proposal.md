# Enhance AI Assistant Panel

## Why

The AI Assistant side panel is constrained for real work: its prompt box is a
single-line `<input>`, so composing or reviewing a multi-line prompt is painful; the
panel is a fixed 288px (`w-72`) column that cannot be widened to read longer answers or
code blocks; and it lives glued to the main window, so it competes for space with the
terminal instead of moving to a second monitor. These are the three pain points the user
hit in practice (annotated screenshot: bigger input ①, resizable width ②, detach ③).

## What Changes

- Replace the single-line prompt `<input>` with an auto-growing multi-line `<textarea>`:
  Enter sends, Shift+Enter inserts a newline, with a sensible min/max height.
- Make the panel width user-adjustable via a drag handle, clamped to a min/max, and
  persist the chosen width across sessions.
- Add the ability to detach the AI Assistant into its own window and reattach it,
  reusing the existing terminal detach/reattach window mechanism.

No breaking changes. No new external dependencies (react-resizable-panels is already used
in the shell).

## Capabilities

### New Capabilities

- `ai-assistant` — the AI Assistant panel surface: how the user composes prompts, sizes
  the panel, and detaches it. This is the presentation/interaction surface and is
  distinct from `session-observability`, which owns the AI suggestion/explanation
  *behavior* (model calls, fallback library). Cross-reference between the two.

### Modified Capabilities

- None. (`session-observability`'s AI-assistance behavior is unchanged; this change only
  affects the panel surface.)

## Impact

- **Renderer**: `src/renderer/src/components/terminal/AIAssistant.tsx` (textarea, detach
  controls), `src/renderer/src/components/layout/AppShell.tsx` (resizable panel container,
  detach wiring), `src/renderer/src/stores/preferences.store.ts` (persisted panel width).
- **Main**: reuse `window:detachTab` / `window:reattachTab` infrastructure in
  `src/main/index.ts`; a parallel detach channel for the AI panel (or generalize the
  existing one) plus the renderer's query-param claim flow.
- **No DB schema change.** Panel width is a UI preference, not connection data.
