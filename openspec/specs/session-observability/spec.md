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
