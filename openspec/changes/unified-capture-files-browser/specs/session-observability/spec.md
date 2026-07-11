## ADDED Requirements

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
