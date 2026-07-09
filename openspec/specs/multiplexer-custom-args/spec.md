# multiplexer-custom-args Specification

## Purpose

Allow users to customize the arguments passed to terminal multiplexer binaries
(tmux, rmux, zellij, dtach) when Bifrost creates or attaches to a persistent
session: a custom config file, a zellij layout, and free-form extra arguments.
These custom arguments are persisted with the multiplexer configuration and are
surfaced in the configuration UI only where the selected multiplexer supports
them.

## Requirements

### Requirement: Custom config file argument

The system SHALL allow the user to specify a multiplexer config file that is
passed to the multiplexer binary when creating or attaching a session. For tmux
and rmux the file SHALL be passed as `-f <file>`; for zellij it SHALL be passed
as `--config <file>`. The config-file argument SHALL be placed in the
multiplexer's global-flag position (before the subcommand). dtach does not read a
config file and SHALL ignore this field.

The config-file value SHALL be quoted such that a leading `~` and shell variables
like `$HOME` are still expanded by the remote shell, while characters that would
break the quoted string are escaped.

#### Scenario: tmux receives the config file on create

- **WHEN** the config file is set to `~/.tmux.work.conf` and a tmux session is created
- **THEN** the attach command contains `tmux -f "~/.tmux.work.conf" new-session -A -s <name>`
- **AND** the `-f` flag appears before `new-session`

#### Scenario: zellij receives the config file

- **WHEN** the config file is set and a zellij session is attached
- **THEN** the attach command contains `--config "<file>"` before the `attach` subcommand

#### Scenario: config file preserves $HOME expansion

- **WHEN** the config file value contains `$HOME` or a leading `~`
- **THEN** the value is emitted inside double quotes so the remote shell expands it
- **AND** it is not wrapped in single quotes that would suppress expansion

#### Scenario: dtach ignores the config file

- **WHEN** a config file is set and the multiplexer is dtach
- **THEN** the attach command is unchanged and contains no config-file flag

#### Scenario: empty config file adds nothing

- **WHEN** the config file field is empty or unset
- **THEN** the attach command contains no config-file flag for any multiplexer

### Requirement: Custom layout argument (zellij, create-only)

The system SHALL allow the user to specify a zellij layout (a registered layout
name or a path to a `.kdl` layout file) that is passed as `zellij --layout <value>`
in the global-flag position. The layout argument SHALL be applied **only when
creating** a new session and SHALL NOT be added when attaching to an existing
session. The layout field SHALL apply to zellij only; tmux, rmux, and dtach SHALL
ignore it.

The layout value SHALL be quoted such that a leading `~` and shell variables are
still expanded, matching the config-file quoting strategy, so that both a bare
layout name and a `.kdl` path work.

#### Scenario: zellij applies layout on create

- **WHEN** the layout is set to `dev` and a new zellij session is created
- **THEN** the attach command contains `--layout "dev"` before the `attach` subcommand

#### Scenario: zellij omits layout on attach to existing session

- **WHEN** the layout is set and the session is attached without creation (createIfMissing is false)
- **THEN** the attach command contains no `--layout` flag

#### Scenario: layout accepts a .kdl file path

- **WHEN** the layout is set to `~/layouts/dev.kdl`
- **THEN** the value is emitted inside double quotes preserving `~` expansion

#### Scenario: non-zellij multiplexers ignore layout

- **WHEN** a layout is set and the multiplexer is tmux, rmux, or dtach
- **THEN** the attach command contains no layout flag

### Requirement: Free-form extra arguments

The system SHALL allow the user to supply free-form extra arguments that are
inserted verbatim into the multiplexer command in the global-flag position, on
both create and attach. Extra arguments SHALL be supported for all multiplexer
kinds. For tmux, rmux, and zellij the extra arguments SHALL appear before the
subcommand; for dtach they SHALL appear after `-E -z` and before the shell.

Extra arguments SHALL be inserted without additional shell quoting so that the
user can pass multi-token flags such as `-r winch`. This is a documented escape
hatch: the value is the user's own shell command on their own host.

#### Scenario: tmux places extra args before the subcommand

- **WHEN** extra args are set to `-u` and a tmux session is created
- **THEN** the attach command contains `tmux -u new-session -A -s <name>`
- **AND** `-u` appears before `new-session`

#### Scenario: dtach places extra args before the shell

- **WHEN** extra args are set to `-r winch` and a dtach session is created
- **THEN** the attach command contains `-r winch` after `-E -z` and before the shell

#### Scenario: extra args apply on attach as well as create

- **WHEN** extra args are set and an existing session is attached (createIfMissing is false)
- **THEN** the extra args appear in the attach command

#### Scenario: extra args are inserted verbatim

- **WHEN** extra args contain multiple whitespace-separated tokens
- **THEN** the tokens are inserted as-is, not collapsed into a single quoted argument

#### Scenario: empty extra args add nothing

- **WHEN** the extra args field is empty or unset
- **THEN** the attach command is unchanged

### Requirement: Persisted custom arguments survive upgrade

The system SHALL persist the config-file, layout, and extra-args fields as part of
the multiplexer configuration, and SHALL migrate existing persisted preferences so
that configurations saved before this change continue to load with the new fields
defaulted to empty.

#### Scenario: existing preferences migrate without the new fields

- **WHEN** a preferences payload persisted before this change is loaded
- **THEN** the multiplexer config gains empty `configFile`, `layout`, and `extraArgs` values
- **AND** all previously configured multiplexer settings are preserved

### Requirement: UI exposes only supported fields per multiplexer

The configuration UI SHALL render the custom-argument inputs conditionally based
on the selected multiplexer: the config-file input SHALL appear for tmux, rmux,
and zellij; the layout input SHALL appear for zellij only; the extra-args input
SHALL appear for all multiplexer kinds. Fields that the selected multiplexer does
not support SHALL NOT be shown.

#### Scenario: dtach shows only extra args

- **WHEN** the selected multiplexer is dtach
- **THEN** the UI shows the extra-args input
- **AND** the UI hides the config-file and layout inputs

#### Scenario: zellij shows all three fields

- **WHEN** the selected multiplexer is zellij
- **THEN** the UI shows the config-file, layout, and extra-args inputs

#### Scenario: tmux hides the layout field

- **WHEN** the selected multiplexer is tmux or rmux
- **THEN** the UI shows the config-file and extra-args inputs
- **AND** the UI hides the layout input
