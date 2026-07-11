## 1. Backend — export + log-lifecycle audit events

- [x] 1.1 `audit-log.ts`: extend `AuditEventType` with `session_log_start` / `session_log_stop`.
- [x] 1.2 `system.ipc.ts`: emit the two new audit events from `system:startLogging` / `system:stopLogging` (details: sessionId, filePath).
- [x] 1.3 `audit.ipc.ts`: add `audit:export(options, filePath, format)` — reuse `auditLogger.query`, write JSONL verbatim or RFC 4180 CSV (`details` as a JSON-string column).
- [x] 1.4 Preload: `audit.export(...)` typing + bridge (additive).

## 2. Renderer — Activity Center

- [x] 2.1 Extract `CaptureFileLists` from `CaptureFilesBrowser.tsx` (list rendering + per-row actions as props); the modal keeps its shell and behavior.
- [x] 2.2 New `ActivityCenter.tsx`: tabs (Timeline | Captures), insights header (connects today, auth failures 7d, active captures from the capture store, audit size + Rotate + Export buttons), Spectral styling.
- [x] 2.3 `ActivityTimeline`: day-grouped list, category chips (mapping constant incl. implicit Other), search box, range selector (24h/7d/30d), expandable event details, live toggle (5 s poll while visible) + manual refresh, per-connection drill-down filter, informative empty/overflow states.
- [x] 2.4 `AppShell.tsx` + `Sidebar.tsx`: replace the stub case with `ActivityCenter`, relabel the item to "Activity" (icon swap if fitting).
- [x] 2.5 `ConnectionStats.tsx`: "View activity" link → opens the Activity view filtered to the connection.
- [x] 2.6 Export flow: `system:showSaveDialog` → `audit.export` with the current filters; toast with Reveal/Copy path on success.

## 3. Verification & docs

- [x] 3.1 Unit tests: CSV serializer (quoting, details column) and the category→event-type mapping (all 19 types covered, unknown → Other).
- [x] 3.2 `pnpm typecheck` + lint + tests green; portable AppImage (`scripts/build-appimage-docker.sh`) for user GUI verification.
- [x] 3.3 Docs: guide ch. 09 EN/ES gains an "Activity view" section (timeline, filters, export, insights); ch. 01/03 sidebar mentions updated; README EN/ES feature line for the Activity view; sync delta spec at archive time.
