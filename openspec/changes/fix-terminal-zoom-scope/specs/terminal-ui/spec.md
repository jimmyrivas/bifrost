## MODIFIED Requirements

### Requirement: Terminal Appearance and Interaction

The system SHALL support zoom in/out/reset, font ligatures, copy-on-select, clickable
links, dynamic tab titles from OSC sequences, intelligent Ctrl-C handling, and selectable
color schemes (50+). Zoom SHALL apply only to the active terminal; inactive tabs SHALL NOT
change font size.

#### Scenario: Zoom

- **WHEN** a user presses Ctrl+= / Ctrl+- / Ctrl+0
- **THEN** the active terminal's font size increases / decreases / resets

#### Scenario: Zoom does not affect inactive tabs

- **WHEN** a user zooms while other tabs are open in the background
- **THEN** only the active terminal changes font size and the inactive tabs are unaffected

#### Scenario: Dynamic title

- **WHEN** the shell emits an OSC 0/2 title sequence
- **THEN** the tab title updates to reflect it

#### Scenario: Apply a color scheme

- **WHEN** a user selects a color scheme from the grid
- **THEN** the terminal re-renders with that scheme's palette
