# Automation

## Purpose

Automate interaction with remote sessions through expect rules, macros, JavaScript-based
scripts, and pre-defined commands. Backed by `expect-engine.ts`, `macro-executor.ts`,
`script-engine.ts`, and the `expectRules`, `macros`, `execCommands`, `remoteCommands`,
`globalExpectPatterns` tables.

## Requirements

### Requirement: Expect Engine

The system SHALL match terminal output against expect rules and send configured responses,
with per-rule enable toggles, jump-on-match/fail navigation, and a debug view.

#### Scenario: Respond to a prompt

- **WHEN** terminal output matches an enabled expect rule's pattern
- **THEN** the system sends that rule's configured response

#### Scenario: Jump on match or fail

- **WHEN** an expect rule defines an onMatch or onFail target
- **THEN** rule evaluation proceeds to the specified rule after the result

#### Scenario: Debug expect matching

- **WHEN** a user opens the expect debug panel
- **THEN** the system streams buffer-update events showing what was matched

### Requirement: Script Engine

The system SHALL run JavaScript-based automation scripts in session and connection modes,
exposing a terminal context API, with optional pre/post confirmation prompts.

#### Scenario: Run a session script

- **WHEN** a user runs a script scoped to a session
- **THEN** the script executes against that session via the context API

#### Scenario: Pre/post confirmation

- **WHEN** a script is configured to ask before or after running
- **THEN** the system shows a confirmation dialog at that point

### Requirement: Macros and Pre-Defined Commands

The system SHALL store and execute macros and pre-defined commands (PCC), including
multi-line commands sent on demand.

#### Scenario: Run a pre-defined command

- **WHEN** a user triggers a saved command
- **THEN** the system sends it to the active session

#### Scenario: Multi-line PCC

- **WHEN** a user enters a multi-line command and submits it (Ctrl+Enter)
- **THEN** the full command block is sent to the session

### Requirement: Automatic Clusters

The system SHALL automatically group connections into clusters by matching connection
attributes against regular-expression rules.

#### Scenario: Auto-cluster by pattern

- **WHEN** a connection's attributes match an auto-cluster regex
- **THEN** the connection is added to the corresponding cluster
