## Why

The sidebar has a "Logs" section (after Notes) whose view is a stub — a
centered "Session logs will appear here" placeholder (`AppShell.tsx`). Meanwhile
the app already produces rich, queryable observability data that has **no
UI home**: the audit log (17 event types, `audit:query` IPC already exposed to
the renderer but consumed only by per-connection stats), session recordings,
and session logs (both listable as of `unified-capture-files-browser`). An
empty section in a public alpha reads as broken; the data to fill it already
exists.

## What Changes

- The stub view becomes an **Activity Center** (sidebar label: "Activity",
  same slot) with two tabs and an insights header:
  - **Timeline tab** — the audit log rendered as a day-grouped, filterable
    timeline: category filter chips (Sessions, Auth, Security, Tunnels,
    Captures, Automation, Errors), free-text search over connection/host,
    time-range selector (24h / 7d / 30d), expandable per-event details, and
    an auto-refresh "live" toggle while the view is open. Clicking an event's
    connection filters the timeline to it.
  - **Captures tab** — the recordings + session-logs lists (shared with the
    capture files browser) embedded inline, so captured files are reachable
    from the sidebar too.
  - **Insights header** — at-a-glance counters computed from the same data:
    connects today, auth failures (7d), active captures now, audit file size —
    plus maintenance actions: **Rotate** (existing `audit:rotate`) and
    **Export** of the currently filtered events to a JSONL or CSV file.
- Small backend additions:
  - `audit:export` — write the filtered event set to a user-chosen path
    (JSONL or CSV) via the existing save dialog.
  - New audit event types `session_log_start` / `session_log_stop` emitted by
    the session-log start/stop paths, so logging activity appears in the
    timeline exactly like recordings already do.
- ConnectionStats gains a "View activity" link that opens the Activity view
  pre-filtered to that connection.

## Capabilities

### New Capabilities

<!-- none — this is the UI surface for data session-observability already owns -->

### Modified Capabilities

- `session-observability`: gains requirements for (1) an activity view over
  the audit log with category filtering, search, time ranges, live refresh,
  and per-connection drill-down; (2) exporting filtered audit events to
  JSONL/CSV; (3) audit events for session-log start/stop; (4) reaching the
  capture-file listings from the activity view.

## Impact

- Renderer: new `ActivityCenter.tsx` (+ small `ActivityTimeline`,
  `InsightsHeader` pieces); `AppShell.tsx` (replace stub case, relabel sidebar
  item); `Sidebar.tsx` (label/icon); `CaptureFilesBrowser.tsx` (extract the
  list rendering into a reusable piece consumed by both the modal and the
  Captures tab); `ConnectionStats.tsx` ("View activity" link).
- Preload: `audit.export(options, filePath)` typing + bridge (additive).
- Main: `audit.ipc.ts` (`audit:export` using `auditLogger.query` + CSV/JSONL
  serializer); `system.ipc.ts`/`ssh.ipc.ts` log-start/stop call sites emit the
  two new audit event types; `audit-log.ts` type union extended.
- No DB changes; no new npm dependencies; polling only (no push events).
