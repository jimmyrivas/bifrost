## Context

`AppShell.tsx` renders a placeholder for the sidebar's `logs` view. Data
already available to the renderer: `audit.query({connectionId, event, since,
limit})` over 17 event types (JSON Lines file, 30-day retention, 50 MB cap),
`audit.getLogSize`, `audit.rotate`, `ssh.listRecordings`,
`system.listSessionLogs`, and the renderer capture store (active captures).
Only `ConnectionStats` consumes the audit IPC today. The audit logger has no
push/event emitter — readers poll.

## Goals / Non-Goals

**Goals:**
- Turn the dead sidebar section into the observability home: one place to
  answer "what happened?" and "what did it produce?".
- Zero heavy machinery: reuse existing IPC; the only new backend is export +
  two audit event types.
- Keep the capture UX single-sourced (no second list implementation).

**Non-Goals:**
- Live tail/follow of an open session-log file (needs fs.watch streaming —
  future change).
- Charts/graphs of activity (counters only for now).
- Audit retention configuration UI (rotation button only).
- Renaming the audit file format or adding new persistence.

## Decisions

- **Label: "Activity"** (was "Logs"). The view covers audit events + captures;
  "Logs" undersells it and collides with "session logs" specifically.
  *Alternative*: keep "Logs" — rejected as ambiguous, but it's a one-line
  revert if the user prefers it.
- **Polling, not push**: the audit logger appends synchronously from many call
  sites; adding an emitter + IPC broadcast touches every writer for marginal
  gain. The view polls `audit.query` every 5 s while visible AND the live
  toggle is on (interval cleared on unmount/hide). *Alternative*: main-process
  fs.watch on audit.jsonl — more moving parts, same UX.
- **Category → event-type mapping** lives in one renderer constant:
  Sessions (`connect`, `disconnect`), Auth (`auth_success`, `auth_fail`,
  `mfa_prompt`), Security (`host_key_*`, `vault_password_changed`,
  `key_file_stored`), Tunnels (`port_forward_*`), Captures (`recording_*`,
  `session_log_*`), Automation (`command`), Errors (`error`). Unknown/future
  types fall into an implicit "Other" bucket so new events never disappear.
- **Filtering strategy**: `audit.query` accepts a single `event` value, so the
  view queries by `since` + generous `limit` (e.g. 2000) and filters
  categories/search client-side. Cheap at 30-day/50 MB scale and keeps the
  IPC untouched. *Alternative*: extend `audit:query` to accept `events[]` —
  unnecessary now, easy later.
- **Captures tab via extraction**: the list rendering inside
  `CaptureFilesBrowser` moves to a `CaptureFileLists` piece (props: tab,
  data, action callbacks). The modal and the Activity tab both render it —
  one implementation, two hosts. The modal keeps its overlay/tabs shell.
- **Export**: `audit:export(options, filePath, format)` runs the same
  `auditLogger.query` server-side and writes JSONL verbatim or CSV
  (RFC 4180; `details` JSON-stringified into one column). The renderer gets
  the path from the existing `system:showSaveDialog`. No streaming needed at
  this size.
- **New audit event types**: extend the `AuditEventType` union with
  `session_log_start` / `session_log_stop`; emit from the `system:startLogging`
  / `system:stopLogging` handlers (covers menu-initiated and future
  auto-logging paths) rather than inside `SessionLogger`, keeping the service
  Electron-free for tests.
- **Insights counters** are computed client-side from the already-fetched
  window (connects today, auth failures 7d) + `audit.getLogSize` + capture
  store counts — no new IPC.

## Risks / Trade-offs

- [Client-side filtering over a big window] 50 MB worst-case file → capped by
  `limit`; if truncation occurs the header shows "showing latest N" so the
  user isn't misled. Mitigation documented in the empty/overflow states.
- [Poll interval vs. freshness] 5 s polling can feel laggy for demos →
  acceptable; the live toggle communicates the model, and a manual refresh
  button forces an immediate query.
- [Two hosts for capture lists] Extraction must not regress the modal —
  mitigation: extraction is mechanical (move JSX + props), verified by the
  existing GUI flow plus typecheck.
- [Sidebar relabel] Users may look for "Logs" → the view's subtitle mentions
  audit + session logs; docs updated (guide ch. 09 + 03 cross-refs).
