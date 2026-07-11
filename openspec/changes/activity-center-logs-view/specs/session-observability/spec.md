## ADDED Requirements

### Requirement: Activity View over the Audit Log

The system SHALL provide an Activity view (the sidebar section previously
labeled "Logs") that renders audit-log events as a timeline grouped by day,
newest first. The view SHALL support: filtering by event category (Sessions,
Auth, Security, Tunnels, Captures, Automation, Errors), free-text search over
connection name and host, a time-range selector covering at least 24 hours /
7 days / 30 days, and expanding an event to see its detail payload. While the
view is visible and its live toggle is enabled, the timeline SHALL refresh
automatically. Selecting an event's connection SHALL filter the timeline to
that connection, and the per-connection statistics panel SHALL offer a link
that opens the Activity view pre-filtered to that connection.

#### Scenario: Timeline shows grouped, filtered events

- **WHEN** the user opens the Activity view and enables the Auth category only
- **THEN** the timeline shows only authentication-related events, grouped by
  day with the newest events first

#### Scenario: Drill down to one connection

- **WHEN** the user activates a timeline event's connection (or the "View
  activity" link in a connection's statistics)
- **THEN** the timeline filters to that connection's events

#### Scenario: Live refresh

- **WHEN** the live toggle is on and a new audit event is written
- **THEN** the timeline reflects it within the refresh interval without a
  manual reload

#### Scenario: Empty state is informative

- **WHEN** no events match the current filters
- **THEN** the view explains what the timeline records instead of rendering an
  empty area

### Requirement: Activity Insights and Maintenance

The Activity view SHALL show at-a-glance counters derived from the audit log
and capture state — at minimum connects today, authentication failures in the
last 7 days, currently active captures, and the audit file size — and SHALL
expose audit maintenance actions: rotating the audit log and exporting the
currently filtered events.

#### Scenario: Counters reflect the log

- **WHEN** the user opens the Activity view after two connects today and one
  auth failure this week
- **THEN** the insights header shows those counts

#### Scenario: Rotate from the view

- **WHEN** the user triggers Rotate and confirms
- **THEN** entries older than the retention window are rotated out and the
  file-size counter updates

### Requirement: Export Filtered Audit Events

The system SHALL export the audit events matching the Activity view's current
filters to a user-chosen file in JSONL or CSV format, using the standard save
dialog. CSV output SHALL quote fields per RFC 4180 and serialize the details
payload as a JSON string column.

#### Scenario: Export current filter as CSV

- **WHEN** the user filters the timeline to one connection and exports as CSV
- **THEN** a CSV file is written at the chosen path containing only that
  connection's events, one row per event

#### Scenario: Export as JSONL

- **WHEN** the user exports as JSONL
- **THEN** the file contains one JSON event object per line, matching the
  audit log's event shape

### Requirement: Session-Log Lifecycle Audit Events

The system SHALL append audit events when session logging starts
(`session_log_start`) and stops (`session_log_stop`), carrying the session id
and log file path in the details payload, so logging activity is visible in
the audit timeline alongside recording events.

#### Scenario: Log start and stop are audited

- **WHEN** the user starts and later stops a session log
- **THEN** the audit log gains a `session_log_start` and a `session_log_stop`
  event referencing that session and file

### Requirement: Capture Files Reachable from the Activity View

The Activity view SHALL include a Captures tab presenting the same recordings
and session-log listings (with the same per-file actions) as the capture files
browser.

#### Scenario: Manage captures from the sidebar

- **WHEN** the user opens the Activity view's Captures tab
- **THEN** recordings and session logs are listed with the same actions as the
  capture files browser (play-command/open, reveal, delete)
