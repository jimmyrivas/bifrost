# remote-session-aliases Specification

## Purpose
TBD - created by archiving change remote-session-aliases. Update Purpose after archive.
## Requirements
### Requirement: Remote Alias Store

The system SHALL persist tab aliases on the remote host in a single sidecar file
(`~/.config/bifrost/session-aliases.json`), keyed by multiplexer backend kind and session
target, using the same store for all backends (dtach, tmux, zellij, rmux). The store SHALL
be read and written over the connection's existing executor (the live SSH session for
remote transports, local shell for local transports) with no additional login.

#### Scenario: Alias written for a renamed session

- **WHEN** a user renames a tab that is attached to a multiplexer session
- **THEN** the system writes that alias into the remote sidecar file under the session's
  backend kind and target

#### Scenario: Missing store is created

- **WHEN** an alias is written and the sidecar file or its directory does not yet exist
- **THEN** the system creates the directory and file rather than failing

#### Scenario: Corrupt or unreadable store degrades gracefully

- **WHEN** the sidecar file cannot be read or contains invalid JSON
- **THEN** the system treats the alias set as empty and continues without surfacing an
  error to the user

### Requirement: Tab to Session Identity Binding

The system SHALL record the resolved multiplexer identity (backend kind and session
target) on the tab whose terminal is attached to that session, so a later rename can be
written to the correct remote entry.

#### Scenario: Binding recorded on attach or create

- **WHEN** a terminal attaches to or creates a multiplexer session
- **THEN** the tab records that session's kind and target

#### Scenario: Non-multiplexer tab has no binding

- **WHEN** a terminal runs without a multiplexer backend
- **THEN** the tab has no multiplexer binding and renaming it performs no remote write

### Requirement: Write Alias on Tab Rename

The system SHALL write the alias to the remote store when the user renames a tab that has
a multiplexer binding, using the new tab title as the alias.

#### Scenario: Rename propagates to the remote store

- **WHEN** a user renames a multiplexer-backed tab to a new title
- **THEN** the remote store entry for that session's kind and target is updated to the new
  title

#### Scenario: Remote write failure does not block the rename

- **WHEN** the remote alias write fails (host unreachable, permission denied)
- **THEN** the local tab is still renamed and the failure does not interrupt the user

### Requirement: Read Aliases on Probe

The system SHALL read the remote alias store during a multiplexer probe and attach the
stored alias to each listed session so it can be surfaced and applied.

#### Scenario: Listed sessions carry their alias

- **WHEN** the system probes a host for existing multiplexer sessions
- **THEN** each session that has a stored alias is reported with that alias

#### Scenario: Picker surfaces the alias

- **WHEN** the multiplexer picker lists a session that has a stored alias
- **THEN** the picker displays the alias for that session

### Requirement: Apply Alias on Attach

The system SHALL apply a session's stored alias as the tab title when the user attaches to
(or the system auto-attaches to) a multiplexer session that has an alias, so a renamed
session is restored to its last name from any device.

#### Scenario: Reattach restores the last name

- **WHEN** a user attaches to a multiplexer session that has a stored alias
- **THEN** the tab title is set to that alias and locked against dynamic overwrite

#### Scenario: Auto-attach restores the last name

- **WHEN** the system auto-attaches to the single live session on a host and that session
  has a stored alias
- **THEN** the tab title is set to that alias

#### Scenario: Cross-device restore without a local manifest

- **WHEN** a user opens Bifrost on a different device that has no local session manifest and
  attaches to a session that has a stored alias
- **THEN** the tab title is restored to that alias from the remote store

### Requirement: Prune Stale Aliases

The system SHALL remove alias entries for sessions that no longer exist, but only after a
probe that successfully listed that backend's sessions, so that a failed or unavailable
probe never deletes live aliases.

#### Scenario: Dead session's alias removed

- **WHEN** a probe successfully lists a backend's sessions and the store contains an alias
  for a target not in that list
- **THEN** the system removes that alias entry from the remote store

#### Scenario: Failed probe preserves aliases

- **WHEN** a probe fails or the multiplexer is unavailable on the host
- **THEN** the system leaves the alias store untouched

