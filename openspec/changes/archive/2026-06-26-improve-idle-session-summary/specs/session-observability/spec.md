## ADDED Requirements

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
