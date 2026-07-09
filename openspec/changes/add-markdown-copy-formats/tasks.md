## 1. Shared converter helper

- [x] 1.1 Create `src/renderer/src/lib/markdown-clip.ts` with `csvEscape` (RFC 4180), `tablesToCsv` (rendered `<table>` → CSV, null when none), and `textToCsv` (whitespace/tab-aligned text → CSV).
- [x] 1.2 Add `domToMarkdown` — a recursive DOM walker converting a rendered container or a cloned selection Range to GitHub-flavored Markdown (headings, emphasis, code, pre, links, images, lists, blockquotes, tables), escaping pipes in table cells and collapsing excess blank lines.
- [x] 1.3 Add `markdownToCsv` — parse GFM tables from Markdown source text (header row followed by a `---` separator row), honoring escaped pipes and multiple tables, returning null when no table is present.

## 2. Markdown viewer

- [x] 2.1 Wrap `.markdown-body` in a Radix `ContextMenu` with items Copy / Copy as Markdown / Copy as CSV, labelled "Copy selection" or "Copy document" based on selection state.
- [x] 2.2 Capture the live selection on the capture phase of `contextmenu` (clone the Range) so it survives the menu opening; only accept selections contained within the rendered body.
- [x] 2.3 Wire handlers: plain = selection text or body innerText; Markdown = `domToMarkdown` of the selection, or the raw source when nothing is selected; CSV = `tablesToCsv` of the selection/body, falling back to `textToCsv`.
- [x] 2.4 Show a transient "flash" badge confirming the copied format (menu closes on select).

## 3. AI Assistant

- [x] 3.1 Add a reusable `CopyableMessage` wrapper (Radix `ContextMenu`) around the assistant `MessageBubble` and the streaming block, with the same three items.
- [x] 3.2 Operate on the message Markdown `content` when no selection exists; use `markdownToCsv` for CSV (the renderer shows table markdown as plain text, so selection text also parses), falling back to `textToCsv`.
- [x] 3.3 Confirm the detached AI window inherits the menu via the shared `AIAssistant` component.

## 4. Tests & verification

- [x] 4.1 Add `tests/lib/markdown-clip.test.ts`: `csvEscape` quoting; `tablesToCsv` for a rendered table, null when absent, multiple tables; `textToCsv` alignment and blank-line skipping.
- [x] 4.2 Add `domToMarkdown` tests: table round-trip to GFM, headings/emphasis/links, ordered and unordered lists, pipe escaping in cells.
- [x] 4.3 Add `markdownToCsv` tests: extract a table from source, null for pipe-only prose, null when no table, escaped pipes, multiple tables.
- [x] 4.4 Run `pnpm typecheck`, ESLint on the changed files, and `pnpm vitest run tests/lib/markdown-clip.test.ts`; fix any failures.
- [ ] 4.5 Manual GUI verification: viewer table → Copy as CSV pastes clean; viewer selection → Copy as Markdown; AI response → Copy as CSV/Markdown; detached AI window offers the same menu.
