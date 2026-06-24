# Markdown Viewer

## Purpose

Render Markdown documents inside the app and make `.md` paths in SSH terminal output
clickable so they open in the internal viewer, including relative paths resolved against
the session's working directory. Implemented in
`src/renderer/src/components/markdown/MarkdownViewer.tsx`.

## Requirements

### Requirement: Internal Markdown Rendering

The system SHALL render Markdown (with GitHub-flavored Markdown support) in an internal
viewer.

#### Scenario: Open a Markdown document

- **WHEN** a user opens a `.md` document in the viewer
- **THEN** it is rendered as formatted Markdown

### Requirement: Clickable Markdown Paths in Output

The system SHALL detect `.md` file paths in SSH terminal output and open them in the
internal viewer when clicked, resolving relative paths against the session context.

#### Scenario: Click a relative .md path

- **WHEN** a user clicks a relative `.md` path in SSH output
- **THEN** the path is resolved against the working directory and opened in the viewer
