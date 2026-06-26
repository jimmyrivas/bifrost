# Improve Idle Session Summary

## Why

The idle "Session Summary" banner is broken and intrusive. On SSH/mosh tabs it always
reports **"No terminal output available."** because the AI summary fetches the output
buffer with the prefixed id (`ssh:<id>` / `mosh:<id>`), while the buffer is stored under
the raw session id — so the lookup always misses. It also renders as a persistent
full-width bar that appears even when there is nothing worth summarizing, and never
collapses. The user wants it to surface only when there is something to say, otherwise
stay out of the way.

## What Changes

- **Fix the empty summary**: two root causes. (1) Strip the `ssh:` / `mosh:` prefix
  before calling `terminal.getBuffer`, so the summary reflects the actual session output
  (local PTY tabs already work, using an unprefixed id). (2) Fix the `ai:generate` IPC
  handler, which never accumulated streamed chunks (`fullResponse = fullResponse` no-op)
  and so always returned an empty string — surfacing as "Could not generate summary."
- **Gate visibility**: only surface the idle-summary affordance when the session has
  meaningful output (a minimum amount of non-trivial buffer content, or detected errors).
  When there is nothing to summarize, render nothing at all.
- **Auto-collapse to an icon**: after appearing briefly, the banner collapses to a small
  floating indicator in the terminal pane's corner (with a badge). Clicking it expands the
  summary on demand; the AI summary is generated only when expanded (no proactive AI
  spend).
- **Make idle/activity detection reliable**: base activity on real terminal output/input
  rather than a DOM `MutationObserver`, which does not observe the WebGL canvas xterm
  paints to.

No new external dependencies. No DB schema change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `session-observability` — adds requirements governing the idle session-summary
  affordance: when it appears (gated on real content), how it collapses to an icon, and
  that the summary accurately reflects the session output. This refines the existing
  AI-assistance surface without changing recording/audit/health behavior.

## Impact

- **Renderer**: `src/renderer/src/components/terminal/XTerminal.tsx` (idle banner,
  buffer-id fix, gating, collapse-to-icon, expand-on-demand). Possibly a small shared
  helper for the "has meaningful content" heuristic. Activity tracking may read the
  existing output-activity signal from `useTerminal.ts` instead of a `MutationObserver`.
- **Main process**: one-line fix in `src/main/ipc/ai.ipc.ts` so `ai:generate` accumulates
  streamed chunks and returns the full text (callers that rely on the return value — like
  the session summary — were getting `''`). The buffer fix itself is purely renderer-side
  (passing the correct id to the existing `terminal:getBuffer` IPC).
