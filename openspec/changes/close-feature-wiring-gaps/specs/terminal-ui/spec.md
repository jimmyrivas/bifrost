## ADDED Requirements

### Requirement: In-terminal search

The terminal SHALL provide in-terminal text search (find next / find previous)
over the scrollback, reachable from the context menu and the Ctrl+F shortcut,
highlighting matches via the loaded search addon.

#### Scenario: Find text in scrollback

- **WHEN** the user opens Find in Terminal and enters a query
- **THEN** matches are highlighted and find-next/previous navigate between them

#### Scenario: Search UI closes cleanly

- **WHEN** the user dismisses the search bar
- **THEN** match highlighting is cleared and focus returns to the terminal

### Requirement: Clear and reset terminal actions function

The Clear Terminal and Reset Terminal context-menu actions SHALL clear the
scrollback and perform a full terminal reset respectively, on the pane they
were invoked from.

#### Scenario: Clear terminal

- **WHEN** the user selects Clear Terminal on a pane
- **THEN** that pane's scrollback is cleared without affecting other panes

#### Scenario: Reset terminal

- **WHEN** the user selects Reset Terminal on a pane
- **THEN** the terminal state (modes, charset, buffer) is reset for that pane
