# Design — Improve Idle Session Summary

## Context

The feature lives entirely in `XTerminal.tsx` (≈ lines 101–247):

- `IDLE_THRESHOLD = 5 min`. `lastActivityRef` is updated by a `MutationObserver` on the
  pane DOM subtree (`childList`/`subtree`/`characterData`) **and** by `mousedown`/`keydown`
  on the pane.
- The idle banner is set inside the `markActive` handler: on the next user interaction
  after being idle > threshold, it computes a duration string and shows a full-width bar.
- `requestAiSummary()` calls `window.bifrost.terminal.getBuffer(terminalIdRef.current)`.
- The banner is a persistent absolutely-positioned bar at the top of the pane with an
  "AI Summary" button; the summary renders inline with Save-as-Note / Dismiss.

Two grounding facts from investigation:

1. **Buffer id mismatch.** `terminalIdRef.current` is `ssh:<sid>` / `mosh:<sid>` for
   remote sessions (`useTerminal.ts:893`, `:842`), but `window-router.ts` buffers SSH
   output under the raw `sid` (`ssh.ipc.ts:86`) and `getBuffer` is an exact-key map
   lookup. So `getBuffer('ssh:<sid>')` returns `''` → "No terminal output available."
   Local PTY uses an unprefixed id, which is why local tabs work.

2. **MutationObserver is unreliable.** xterm renders with the WebGL/canvas addon; terminal
   output paints to a `<canvas>`, not DOM text nodes, so `characterData`/`childList`
   mutations do not reliably fire on output. `useTerminal` already maintains an
   output-activity signal (`lastOutputTimeRef` / `outputActiveRef`) used by the
   completion-notification feature.

## Goals / Non-Goals

**Goals**
- Summary reflects real output for PTY, SSH, and mosh.
- Affordance appears only when there is meaningful content; otherwise nothing.
- Auto-collapse to a small corner indicator; expand-on-demand generates the AI summary.
- Reliable idle/activity detection.

**Non-Goals**
- No proactive/background AI generation (decided: generate on expand only).
- No change to recording/audit/health behavior.
- No new persisted preference in this change (thresholds are constants; can be promoted to
  preferences later).

## Decisions

### Decision 1: Fix the buffer id (strip the protocol prefix)

Before calling `getBuffer`, normalize the id: `id.startsWith('ssh:') || id.startsWith('mosh:')`
→ use the substring after the prefix. This matches how `DetachedTerminal` already derives
`actualSessionId`. Centralize as a tiny helper (e.g. `rawSessionId(id)`) so the AI panel
and any future caller share it.

### Decision 2: Gate on a cheap "has meaningful content" heuristic (on-demand summary)

When the session goes idle, compute a cheap signal **without** calling the AI:
- Read the buffer (now with the correct id) and count non-trivial lines (non-empty after
  trim), OR
- Check `detectedErrorsRef` (already tracked) for any detected errors.

Show the affordance only if `nonTrivialLines >= MIN_LINES` (e.g. 3) **or** errors exist.
The AI summary itself is generated only when the user expands the indicator. If the buffer
is empty/below threshold, render nothing.

- **Why**: matches the user's "appear when there's something to say"; no AI spend until
  requested; avoids the empty-summary case entirely because we already know there is
  content before offering.
- **Alternative considered**: pre-generate the summary in the background to decide
  visibility — rejected (proactive AI cost on every idle).

### Decision 3: Auto-collapse to a floating corner indicator

Replace the persistent full-width bar with a two-state affordance scoped to the pane:
- **Expanded** (brief, on first appearance): a compact pill showing "Idle Xh Ym" + an
  expand control. After a short timeout (e.g. 6 s) with no interaction → collapse.
- **Collapsed**: a small floating icon button in the pane's top-right corner (badge when a
  summary is ready / errors present). Click → expand and lazily generate the summary;
  Save-as-Note / Dismiss available in the expanded state.

Keep it absolutely-positioned within the existing pane container (`z` above the terminal,
below modals). Dismiss removes it until the next idle period.

### Decision 4: Drive idle/activity by polling the output buffer (implemented)

`useTerminal` does not expose an output-activity signal, and adding a second
`onData` subscription duplicates listeners. Instead, a single interval (20s) polls
`getBuffer(rawSessionId(...))` and treats **buffer-length growth** as activity: if the
buffer grew since the last tick, stamp `lastActivityRef` and reset the dismissed flag;
otherwise, once `now - lastActivity > IDLE_THRESHOLD` and the buffer has meaningful
content, surface the affordance. `mousedown`/`keydown` still stamp activity. This is
reliable (the buffer is the source of truth, independent of the WebGL canvas), self-
contained (no change to `useTerminal`), and reuses the same buffer fetch needed for the
meaningful-content gate. The interval and collapse timer are cleared on unmount.

- **Why over reading `lastOutputTimeRef` / a second `onData` listener**: no widening of the
  hook API, no duplicate IPC listeners; one poll covers activity + the content gate.
- **Trade-off**: fetches the (capped) buffer every 20s; negligible for this feature.

## Risks / Trade-offs

- **Heuristic mislabels content** (e.g. a banner-only login MOTD counts as "meaningful").
  → tune `MIN_LINES`; errors are a strong positive signal. Acceptable; user can dismiss.
- **Exposing `lastOutputTimeRef` from `useTerminal`** widens the hook's return surface. →
  prefer reading an existing exported field; if none fits, stamp activity from the data
  listener already present in `XTerminal`. Avoid Zustand object selectors (project rule).
- **Timer-based idle check** adds a per-pane interval. → use a single modest interval
  (e.g. 30 s) and clear on unmount.

## Open Questions

- Exact `MIN_LINES` threshold and collapse timeout — start at 3 lines / 6 s, tune by feel.
- Should the collapsed icon persist across tab switches or reset per idle period? (Lean:
  per idle period; dismiss clears it.)
