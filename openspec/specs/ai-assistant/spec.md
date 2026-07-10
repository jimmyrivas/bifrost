# ai-assistant Specification

## Purpose
TBD - created by archiving change enhance-ai-assistant-panel. Update Purpose after archive.
## Requirements
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

### Requirement: Copy assistant responses as plain text, Markdown, or CSV

The AI Assistant SHALL provide a context menu on each assistant response (including
the in-progress streaming response) offering three copy actions: copy as plain
text, copy as Markdown, and copy as CSV. Plain-text and CSV copy SHALL operate on
the current text selection within the response when a non-empty selection exists,
and otherwise on the whole message. Copy as Markdown SHALL always copy the whole
message's Markdown source, because the rendered selection has the Markdown syntax
(bold markers, backticks, headings) already stripped and cannot round-trip.

Copy as CSV SHALL extract GitHub-flavored Markdown tables directly from the source
text — a header row immediately followed by a `---` separator row, skipping tables
inside fenced code blocks — and produce CSV with fields quoted per RFC 4180. When
no such table is present, copy as CSV SHALL fall back to reconstructing a
pipe-delimited grid from the copy scope (covering a selection of bare table rows
without their separator), and finally to treating whitespace- or tab-aligned text
as rows and columns.

This capability SHALL apply to both the docked panel and the detached assistant
window.

#### Scenario: Copy a response containing a table as CSV

- **WHEN** an assistant response contains a GitHub-flavored Markdown table and the user chooses Copy as CSV
- **THEN** the clipboard receives the table as CSV with RFC 4180 quoting
- **AND** the separator row is omitted from the output

#### Scenario: Copy a response as Markdown

- **WHEN** the user chooses Copy message as Markdown on an assistant response
- **THEN** the clipboard receives the whole message's Markdown source, regardless of any selection

#### Scenario: Copy selected table rows as CSV without their separator

- **WHEN** the user selects only the data rows of a rendered table (excluding the `---` separator line) and chooses Copy as CSV
- **THEN** the pipe-delimited rows are reconstructed and the clipboard receives them as CSV

#### Scenario: Copy actions available in the detached window

- **WHEN** the assistant is detached into its own window
- **THEN** right-clicking a response offers the same Copy / Copy as Markdown / Copy as CSV actions

#### Scenario: Copy as CSV without a table falls back to aligned text

- **WHEN** the copy scope contains no Markdown table
- **THEN** copy as CSV splits each non-empty line on tabs or runs of two or more spaces into CSV columns

