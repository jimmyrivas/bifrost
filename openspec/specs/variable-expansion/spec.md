# Variable Expansion

## Purpose

Expand placeholder variables in connection fields, commands, and scripts at runtime, so a
single definition adapts per host, environment, or user input. Implemented in
`src/main/services/variable-engine.ts`, backed by the `globalVariables` and
`connectionVariables` tables.

## Requirements

### Requirement: Variable Token Expansion

The system SHALL expand `<IP>`, `<ENV:name>`, `<GV:name>`, `<ASK:prompt>`, and
`<CMD:command>` tokens at the point of use.

#### Scenario: Expand a global variable

- **WHEN** a field contains `<GV:name>` and that global variable is defined
- **THEN** the token is replaced with the variable's value

#### Scenario: Expand an environment variable

- **WHEN** a field contains `<ENV:name>`
- **THEN** the token is replaced with the value of that environment variable

#### Scenario: Prompt for input

- **WHEN** a field contains `<ASK:prompt>`
- **THEN** the system prompts the user and substitutes their answer

#### Scenario: Expand a command result

- **WHEN** a field contains `<CMD:command>`
- **THEN** the system runs the command and substitutes its output

### Requirement: Variable Scope Resolution

The system SHALL resolve connection-scoped variables ahead of global variables when both
define the same name.

#### Scenario: Connection overrides global

- **WHEN** a name is defined both globally and on the connection
- **THEN** the connection-scoped value is used for that connection
