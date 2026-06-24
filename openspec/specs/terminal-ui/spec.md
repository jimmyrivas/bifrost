# Terminal UI

## Purpose

Render interactive terminals (xterm.js) for both local PTY and remote SSH sessions, and
provide the tab/pane workspace around them: broadcast, layout, zoom, paste safety,
detach/reattach, theming, and context actions. Core logic in
`src/renderer/src/hooks/useTerminal.ts` and `components/terminal/`.

## Requirements

### Requirement: Dual-Mode Terminals

The system SHALL drive xterm.js terminals in either local PTY mode or remote SSH mode
through a single hook, with output routed to the owning window.

#### Scenario: Local shell

- **WHEN** a user opens a local terminal
- **THEN** a PTY is spawned and its I/O is bound to the xterm instance

#### Scenario: Remote shell

- **WHEN** a user connects to an SSH target
- **THEN** the remote shell stream is bound to the xterm instance

### Requirement: Tab and Pane Persistence

The system SHALL keep every tab mounted in the DOM and show/hide tabs via visibility and
z-index rather than conditional rendering, so switching tabs never destroys a session.

#### Scenario: Switch away and back

- **WHEN** a user switches to another tab and returns
- **THEN** the original session's scrollback and process remain intact

### Requirement: Pane Layout Controls

The system SHALL support splitting a tab into multiple panes, maximizing a single pane,
and resizing panes via keyboard.

#### Scenario: Maximize a pane

- **WHEN** a user presses the maximize hotkey (Ctrl+Shift+M)
- **THEN** the focused pane fills the tab and the other panes are hidden

#### Scenario: Resize panes

- **WHEN** a user presses the resize hotkeys (Ctrl+Shift+Arrow)
- **THEN** the focused pane grows or shrinks in that direction

### Requirement: Broadcast Input

The system SHALL broadcast typed input to multiple panes or to all tabs, and SHALL
display a prominent warning banner while broadcast is active.

#### Scenario: Broadcast to panes

- **WHEN** a user enables broadcast (Ctrl+Shift+B) and types
- **THEN** the keystrokes are sent to all panes in the broadcast group

#### Scenario: Broadcast warning

- **WHEN** broadcast mode is active
- **THEN** an amber or red banner SHALL be shown to indicate keystrokes go to many targets

### Requirement: Paste Safety

The system SHALL warn before pasting multi-line content or content matching known
dangerous command patterns, requiring confirmation.

#### Scenario: Multi-line paste warning

- **WHEN** a user pastes content containing multiple lines
- **THEN** a confirmation dialog SHALL be shown before the content is sent

#### Scenario: Dangerous command paste

- **WHEN** pasted content matches a dangerous-command pattern
- **THEN** the system SHALL flag it and require explicit confirmation

### Requirement: Terminal Appearance and Interaction

The system SHALL support zoom in/out/reset, font ligatures, copy-on-select, clickable
links, dynamic tab titles from OSC sequences, intelligent Ctrl-C handling, and selectable
color schemes (50+).

#### Scenario: Zoom

- **WHEN** a user presses Ctrl+= / Ctrl+- / Ctrl+0
- **THEN** the terminal font size increases / decreases / resets

#### Scenario: Dynamic title

- **WHEN** the shell emits an OSC 0/2 title sequence
- **THEN** the tab title updates to reflect it

#### Scenario: Apply a color scheme

- **WHEN** a user selects a color scheme from the grid
- **THEN** the terminal re-renders with that scheme's palette

### Requirement: Detach and Reattach

The system SHALL detach a terminal into a separate window without destroying its session,
redirecting IPC output to the new window and replaying buffered output.

#### Scenario: Detach to window

- **WHEN** a user detaches a tab
- **THEN** the tab is marked detaching, the session survives, and a new window claims it
  via its `sessionId` and replays buffered output

### Requirement: Progress and Error Feedback

The system SHALL detect long-running command completion and surface errors from terminal
output, with a dismissible error badge.

#### Scenario: Completion notification

- **WHEN** a command runs and the terminal becomes idle after activity
- **THEN** the system SHALL show a desktop notification

#### Scenario: Dismissible error badge

- **WHEN** an error pattern is detected in output
- **THEN** an error badge appears that the user can dismiss and that auto-hides
