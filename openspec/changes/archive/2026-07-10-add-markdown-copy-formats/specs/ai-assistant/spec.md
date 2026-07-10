## ADDED Requirements

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
