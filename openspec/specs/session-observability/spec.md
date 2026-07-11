# Session Observability

## Purpose

Record, audit, monitor, and assist sessions: asciicast recording, an append-only audit
log, host health monitoring, usage statistics, error detection, and AI-assisted
suggestions. Implemented across `session-recorder.ts`, `audit-log.ts`,
`connection-health.ts`, and renderer lib helpers.
## Requirements
### Requirement: Session Recording

The system SHALL record terminal sessions in asciicast v2 format for later replay.

#### Scenario: Record a session

- **WHEN** recording is enabled for a session
- **THEN** the session's output is written as an asciicast v2 file

### Requirement: Audit Log

The system SHALL append connection and action events to an audit log in JSON Lines
format, rotating entries on a 30-day window.

#### Scenario: Log a connection event

- **WHEN** a user connects to a target
- **THEN** an entry is appended to the audit log with timestamp and target

#### Scenario: Rotation

- **WHEN** audit entries exceed the 30-day retention window
- **THEN** older entries are rotated out

### Requirement: Health Monitoring and Statistics

The system SHALL track host reachability/latency and derive connection usage statistics
from the audit log.

#### Scenario: Ping latency

- **WHEN** health monitoring is active for a host
- **THEN** the system tracks and displays its ping latency

#### Scenario: Connection statistics

- **WHEN** a user views statistics
- **THEN** the system shows usage derived from audit-log history

### Requirement: Error Detection and AI Assistance

The system SHALL detect known error patterns in terminal output and SHALL offer AI command
suggestions and explanations (via Ollama with a built-in fallback library) plus built-in
DevOps snippets.

#### Scenario: Detect an error

- **WHEN** terminal output matches one of the error patterns
- **THEN** the system surfaces the detected error to the user

#### Scenario: Explain a command

- **WHEN** a user requests an explanation of a command via the context menu
- **THEN** the system returns an AI-generated explanation, falling back to the built-in
  library when no model is available

### Requirement: Idle Session Summary Affordance

After a session has been idle past a threshold, the system SHALL offer an AI-generated
summary of the session, but only when the session has meaningful output to summarize.
When there is nothing worth summarizing, the system SHALL NOT show any idle-summary UI.

#### Scenario: Surfaced only with meaningful content

- **WHEN** a session becomes idle past the threshold and its output buffer contains
  meaningful content (at least a minimum amount of non-trivial output, or detected errors)
- **THEN** the system surfaces an idle-summary affordance for that session

#### Scenario: Nothing to say shows nothing

- **WHEN** a session becomes idle but has no meaningful output to summarize
- **THEN** the system shows no idle-summary UI at all

### Requirement: Auto-Collapse to an Icon

The idle-summary affordance SHALL not remain as a persistent full-width banner. After
appearing briefly it SHALL collapse to a small indicator in the terminal pane, which the
user can expand on demand to view the summary, and dismiss.

#### Scenario: Collapses after appearing

- **WHEN** the idle-summary affordance has been shown and the user does not interact with
  it within a short interval
- **THEN** it collapses to a compact indicator in the pane corner without occupying
  persistent width

#### Scenario: Expand on demand

- **WHEN** the user activates the collapsed indicator
- **THEN** the summary expands, generating the AI summary at that point if not already
  generated

#### Scenario: Dismiss

- **WHEN** the user dismisses the idle-summary affordance
- **THEN** it is removed for that idle period and does not reappear until the session goes
  idle again

### Requirement: Summary Reflects Actual Session Output

The session summary SHALL be generated from the session's real output buffer, regardless
of whether the session is a local PTY, SSH, or mosh session.

#### Scenario: SSH/mosh session summary has content

- **WHEN** the user requests a summary for an SSH or mosh session that produced output
- **THEN** the summary is generated from that session's buffered output, not reported as
  "no terminal output available"

### Requirement: Capture Files Browser

The system SHALL provide an in-app browser over captured session files with two
tabs — Recordings (asciicast `.cast` files) and Session Logs (plain-text `.log`
transcripts) — showing per file its name, date, and size (plus duration for
recordings). The browser SHALL be reachable from the Preferences Session
Capture section and from the terminal Capture context menu, and both entry
points SHALL open the same browser component.

Per-file actions SHALL be: for recordings — copy the `asciinema play` command,
reveal in the system file manager, and delete; for session logs — open the file
with the OS default handler, reveal in the system file manager, and delete.
Each tab SHALL offer an "Open folder" action for its directory.

#### Scenario: Browse both capture kinds

- **WHEN** the user opens the capture files browser from Preferences or from
  the terminal Capture menu
- **THEN** a Recordings tab lists the `.cast` files and a Session Logs tab
  lists the `.log` files, each with name, date, and size

#### Scenario: Log file actions

- **WHEN** the user invokes open, reveal, or delete on a listed session log
- **THEN** the file opens in the OS default handler, is highlighted in the file
  manager, or is removed from disk and from the list, respectively

#### Scenario: Recording actions are preserved

- **WHEN** the user is on the Recordings tab
- **THEN** the existing actions (copy `asciinema play` command, reveal, delete)
  behave as before

#### Scenario: Same browser from both entry points

- **WHEN** the user opens the browser from the terminal Capture menu
- **THEN** it is the same browser component the Preferences section uses,
  opened on the Recordings tab

### Requirement: Session Log Listing and Deletion over IPC

The system SHALL expose IPC to list session-log files (name, absolute path,
size, modification time, and whether the log is actively being written) and to
delete a session-log file by path, restricted to the session-logs directory.
A log that is actively being written SHALL be marked as active in the listing
and SHALL NOT be deletable until logging stops.

#### Scenario: List includes an active log

- **WHEN** a session is currently logging and the log list is requested
- **THEN** the active file appears in the results flagged as active

#### Scenario: Active log cannot be deleted

- **WHEN** deletion is requested for a log that is actively being written
- **THEN** the system refuses the deletion and the file remains on disk

#### Scenario: Deletion is confined to the logs directory

- **WHEN** a delete request resolves to a path outside the session-logs
  directory
- **THEN** the system rejects the request without touching the file

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

