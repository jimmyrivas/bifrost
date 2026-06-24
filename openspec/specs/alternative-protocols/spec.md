# Alternative Protocols

## Purpose

Connect to targets using protocols beyond plain SSH — Mosh, RDP, and arbitrary custom
commands — launched via external programs. Implemented in
`src/main/services/external-protocol.ts`.

## Requirements

### Requirement: Mosh Sessions

The system SHALL establish Mosh sessions to a target, including through a jump host.

#### Scenario: Connect with Mosh

- **WHEN** a user opens a connection configured for Mosh
- **THEN** the system launches a Mosh session to the target

### Requirement: RDP Sessions

The system SHALL launch RDP sessions with configurable clipboard, drive, printer, audio
redirection, and resolution.

#### Scenario: RDP with redirection options

- **WHEN** a user opens an RDP connection with redirection options set
- **THEN** the system launches the RDP client with those options applied

### Requirement: Custom Command Protocol

The system SHALL launch an arbitrary user-defined command as a connection method,
substituting connection variables.

#### Scenario: Run a custom command

- **WHEN** a user opens a connection whose method is "Custom Command"
- **THEN** the system runs the configured command with variables expanded
