# Session Multiplexing

## Purpose

Persist local terminal sessions across app restarts and detaches by integrating with
terminal multiplexers. Backends live in `src/main/services/multiplexer/` (`dtach.ts`,
`tmux.ts`, `zellij.ts`) plus rmux (a tmux-compatible Rust multiplexer).

## Requirements

### Requirement: Multiplexer Backends

The system SHALL support dtach, tmux, zellij, and rmux as interchangeable backends for
persisting local sessions, selectable by the user.

#### Scenario: Start a persisted session

- **WHEN** a user starts a terminal with a multiplexer backend selected
- **THEN** the session runs inside that multiplexer and survives the terminal closing

#### Scenario: rmux compatibility

- **WHEN** rmux is selected as the backend
- **THEN** the system drives it using tmux-compatible commands

### Requirement: Attach and Reattach Sessions

The system SHALL list existing multiplexer sessions and let users attach to or detach
from them.

#### Scenario: Reattach after restart

- **WHEN** the app restarts and a multiplexer session still exists
- **THEN** the user can list it and reattach with its scrollback intact

### Requirement: Session Naming

The system SHALL generate consistent, recognizable names for multiplexer sessions.

#### Scenario: Named session

- **WHEN** a multiplexer session is created
- **THEN** it receives a deterministic name derived from the connection or tab context
