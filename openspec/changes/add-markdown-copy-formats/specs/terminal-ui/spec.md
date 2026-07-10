## ADDED Requirements

### Requirement: Copy terminal selection as Markdown or CSV

The terminal context menu SHALL offer, alongside the existing plain-text Copy,
two additional actions on the current terminal selection: Copy as Markdown and
Copy as CSV. Because a terminal yields only plain text, these actions SHALL
reconstruct a table from a selection whose rows are delimited by ASCII pipes
(`|`) or box-drawing verticals (`│ ┃ ║`), discarding border and GFM separator
rows.

Copy as CSV SHALL emit the reconstructed rows with fields quoted per RFC 4180,
and SHALL fall back to treating whitespace- or tab-aligned text as rows and
columns when the selection is not a delimited table. Copy as Markdown SHALL emit
a clean GitHub-flavored Markdown table for a reconstructed grid, and SHALL return
the selected text unchanged when it is not a table.

The terminal SHALL show a transient confirmation indicating which format was
copied, because the context menu closes when an action is selected.

#### Scenario: Copy a bordered terminal table as CSV

- **WHEN** the user selects a table rendered in the terminal (pipe- or box-drawing-bordered) and chooses Copy as CSV
- **THEN** the clipboard receives the table as CSV, one row per line, cells comma-separated with RFC 4180 quoting
- **AND** border and separator rows are omitted

#### Scenario: Copy a terminal table as Markdown

- **WHEN** the user selects a bordered terminal table and chooses Copy as Markdown
- **THEN** the clipboard receives a clean GitHub-flavored Markdown table

#### Scenario: Copy as CSV without a table falls back to aligned text

- **WHEN** the selection is not a delimited table
- **THEN** Copy as CSV splits each non-empty line on tabs or runs of two or more spaces into CSV columns

#### Scenario: Copy with no selection prompts the user

- **WHEN** the user chooses Copy as Markdown or Copy as CSV with no active terminal selection
- **THEN** a transient message indicates that text must be selected first
