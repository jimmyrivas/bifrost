## ADDED Requirements

### Requirement: Copy rendered content as plain text, Markdown, or CSV

The Markdown viewer SHALL provide a context menu on the rendered content offering
three copy actions: copy as plain text, copy as Markdown, and copy as CSV. Each
action SHALL operate on the current text selection when a non-empty selection
exists within the rendered content, and otherwise on the whole document.

Copy as Markdown SHALL convert the rendered content of the selection back to
GitHub-flavored Markdown. When there is no selection, copy as Markdown SHALL return
the document's original Markdown source verbatim.

Copy as CSV SHALL extract every table within the copy scope as CSV, with fields
quoted per RFC 4180 (a field containing a comma, double quote, carriage return, or
line feed is wrapped in double quotes and embedded quotes are doubled). When the
scope contains no table, copy as CSV SHALL fall back to treating whitespace- or
tab-aligned text as rows and columns.

In addition to the context menu, the viewer's header SHALL expose a "Copy" dropdown
offering the same three document-level actions (plain text, Markdown, CSV), so the
copy formats are discoverable without right-clicking. The header dropdown SHALL
always operate on the whole document regardless of any text selection.

The viewer SHALL show a transient confirmation indicating which format was copied,
because the context menu closes when an action is selected.

#### Scenario: Copy a table as CSV

- **WHEN** the user right-clicks a rendered table (with no text selection) and chooses Copy as CSV
- **THEN** the clipboard receives the table as CSV, one row per line, cells comma-separated
- **AND** cells containing commas or quotes are quoted per RFC 4180

#### Scenario: Copy a selection as Markdown

- **WHEN** the user selects part of the rendered content and chooses Copy as Markdown
- **THEN** the clipboard receives the selection converted to GitHub-flavored Markdown

#### Scenario: Copy a partial table selection

- **WHEN** the user selects only some rows of a rendered table and chooses Copy as Markdown or Copy as CSV
- **THEN** the selected rows are emitted as pipe-delimited Markdown rows or CSV rows with cells kept separate

#### Scenario: Copy a selection inside a code block as Markdown

- **WHEN** the user selects lines inside a rendered code block and chooses Copy as Markdown
- **THEN** the clipboard receives the selected lines inside a code fence with line breaks preserved

#### Scenario: Copy the whole document as Markdown returns the source

- **WHEN** the user chooses Copy as Markdown with no active selection
- **THEN** the clipboard receives the document's original Markdown source unchanged

#### Scenario: Copy as CSV without a table falls back to aligned text

- **WHEN** the copy scope contains no table
- **THEN** copy as CSV splits each non-empty line on tabs or runs of two or more spaces into CSV columns

#### Scenario: Copy confirmation is shown

- **WHEN** any copy action completes
- **THEN** a transient badge indicates the format that was copied

#### Scenario: Header dropdown offers the copy formats

- **WHEN** the user opens the header "Copy" dropdown
- **THEN** it offers Copy as text / Copy as Markdown / Copy as CSV over the whole document
