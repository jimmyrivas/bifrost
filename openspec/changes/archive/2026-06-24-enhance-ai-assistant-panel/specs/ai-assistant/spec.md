## ADDED Requirements

### Requirement: Multi-Line Prompt Composition

The AI Assistant panel SHALL provide a multi-line prompt editor that grows with its
content between a minimum and maximum height. Pressing Enter SHALL submit the prompt and
Shift+Enter SHALL insert a newline.

#### Scenario: Compose a multi-line prompt

- **WHEN** the user types text that wraps beyond one line, or presses Shift+Enter
- **THEN** the prompt editor grows to show the content up to its maximum height, then
  scrolls internally

#### Scenario: Enter submits, Shift+Enter newlines

- **WHEN** the user presses Enter without Shift in the prompt editor
- **THEN** the prompt is submitted
- **WHEN** the user presses Shift+Enter
- **THEN** a newline is inserted and the prompt is NOT submitted

#### Scenario: Submit is blocked while a request is in flight

- **WHEN** a previous prompt is still loading
- **THEN** submitting is disabled until the response completes

### Requirement: Adjustable Panel Width

The AI Assistant panel SHALL let the user adjust its width by dragging a resize handle,
clamped to a minimum and maximum width, and SHALL persist the chosen width across
application restarts.

#### Scenario: Resize the panel

- **WHEN** the user drags the panel's resize handle
- **THEN** the panel width changes within the allowed minimum and maximum bounds

#### Scenario: Width persists across restarts

- **WHEN** the user has resized the panel and later relaunches the application
- **THEN** the panel reopens at the previously chosen width

### Requirement: Detach and Reattach the Assistant

The AI Assistant SHALL be detachable into its own window via a button in its header, and
reattachable to the main window, reusing the application's detach window mechanism. While
detached, the assistant SHALL remain fully functional and SHALL follow the main window's
active session context as it changes.

#### Scenario: Detach to a separate window

- **WHEN** the user clicks the detach button in the AI Assistant header
- **THEN** the assistant opens in its own window and the in-panel slot in the main window
  is released

#### Scenario: Reattach to the main window

- **WHEN** the user closes the detached assistant window or triggers reattach
- **THEN** the assistant returns to its panel slot in the main window

#### Scenario: Detached assistant stays functional

- **WHEN** the assistant is in its detached window and the user submits a prompt
- **THEN** it generates a response using the active session's connection and terminal
  context, identically to the docked panel

#### Scenario: Detached assistant follows the active tab

- **WHEN** the user switches the active tab in the main window while the assistant is
  detached
- **THEN** the detached assistant updates to use the newly active session's context for
  its next prompt
