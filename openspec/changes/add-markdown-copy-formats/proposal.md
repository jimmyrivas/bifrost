## Why

Bifrost renders Markdown in two places: the internal Markdown viewer (opened from
`.md` paths in SSH output) and the AI Assistant panel. Both render tables and rich
text, but the only copy affordance was the viewer's header "Copy" button, which
copies the whole raw document. Users working with tabular output — e.g. a host/IP
inventory table — had no way to lift a table into a spreadsheet or paste a clean
Markdown snippet into notes or a ticket. They were forced to hand-select and
reformat text. Exposing structured copy formats (plain text, Markdown, CSV) on a
selection or the whole content closes that gap.

## What Changes

- Add a right-click context menu to the rendered content of both the Markdown
  viewer and the AI Assistant, offering three copy actions: **Copy** (plain text),
  **Copy as Markdown**, and **Copy as CSV**. Actions operate on the current text
  selection when one exists, otherwise on the whole document/message.
- **Markdown viewer** (rendered DOM is the source of truth): copy-as-Markdown walks
  the rendered DOM (or the cloned selection Range) back to GitHub-flavored Markdown;
  copy-as-CSV extracts every `<table>` in scope. With no selection, copy-as-Markdown
  returns the original source verbatim (perfect fidelity). A transient "flash" badge
  confirms the action since the menu closes on select.
- **AI Assistant** (message `content` is already Markdown source, and its
  lightweight renderer never turns `| a | b |` into a real `<table>`): copy actions
  operate on the Markdown source; copy-as-CSV parses GFM tables directly from the
  source text (header row + `---` separator). This applies to both the docked panel
  and the detached window (which reuses `AIAssistant`).
- Add a shared, dependency-free converter helper `markdown-clip.ts`
  (`domToMarkdown`, `tablesToCsv`, `textToCsv`, `markdownToCsv`, `csvEscape`). No
  HTML-to-Markdown library was available in the project, so the DOM walker and the
  Markdown-source table parser are implemented in-repo. CSV output follows RFC 4180
  quoting; when a scope has no table, CSV falls back to treating whitespace/tab
  aligned text as columns.

## Capabilities

### Modified Capabilities

- `markdown-viewer`: gains a copy-formats requirement (context menu → plain text /
  Markdown / CSV, over selection or whole document).
- `ai-assistant`: gains a copy-formats requirement (context menu on assistant
  responses → plain text / Markdown / CSV, over selection or whole message).

## Impact

- **New helper**: `src/renderer/src/lib/markdown-clip.ts` (pure functions, unit
  tested).
- **Markdown viewer**: `src/renderer/src/components/markdown/MarkdownViewer.tsx`
  wraps `.markdown-body` in a Radix `ContextMenu`, captures the selection on the
  capture phase of `contextmenu`, and shows a transient copy-confirmation badge.
- **AI Assistant**: `src/renderer/src/components/terminal/AIAssistant.tsx` adds a
  reusable `CopyableMessage` wrapper around each assistant bubble and the streaming
  block. The detached window inherits this via `AIAssistant`.
- **Tests**: `tests/lib/markdown-clip.test.ts` (17 cases) covers CSV escaping, DOM →
  Markdown, DOM table → CSV, Markdown-source → CSV, and the text fallback.
- No new dependencies (reuses existing `@radix-ui/react-context-menu`). No breaking
  changes: the existing header "Copy" button and all rendering behavior are
  unchanged; the context menu is purely additive.
