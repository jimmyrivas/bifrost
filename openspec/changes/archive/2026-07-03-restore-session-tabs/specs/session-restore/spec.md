## ADDED Requirements

### Requirement: Persist the Open-Tabs Manifest

The system SHALL persist a manifest of the open tabs across application restarts, updating
it as tabs are opened, closed, or changed. The manifest SHALL store only restorable tabs
and only non-ephemeral fields; live terminal ids and the active-tab flag derived state are
not relied upon for restore.

#### Scenario: Manifest updates as tabs change

- **WHEN** the user opens, closes, or renames a restorable tab
- **THEN** the persisted manifest reflects the current set of restorable tabs

#### Scenario: Restore policy — what is persisted

- **WHEN** the manifest is written
- **THEN** SSH connection tabs are included, local tabs are included only if they were
  multiplexed, and non-multiplexed local tabs are excluded

### Requirement: Prompt to Restore on Launch

On launch, when a non-empty restorable manifest exists, the system SHALL prompt the user
to restore the previous session rather than restoring silently. Declining SHALL start a
fresh session.

#### Scenario: Prompt shown when a manifest exists

- **WHEN** the app launches and the previous session left at least one restorable tab
- **THEN** the system shows a prompt offering to restore the previous session's tabs

#### Scenario: Decline starts fresh

- **WHEN** the user declines the restore prompt
- **THEN** the app starts with a fresh session and does not reopen the previous tabs

#### Scenario: No prompt when nothing to restore

- **WHEN** the app launches and there is no restorable tab in the manifest
- **THEN** no restore prompt is shown and the app starts normally

### Requirement: Restore Recreates and Connects Each Tab

When the user accepts the restore prompt, the system SHALL recreate each restorable tab
and connect it, using the same connect path as a manual connection. A tab that had a live
multiplexer session SHALL reattach to it via the existing connect-time probe.

#### Scenario: Connection tab is reopened and connected

- **WHEN** the user accepts the restore prompt and a tab references an SSH connection
- **THEN** the tab is recreated and connected, prompting for credentials if the connection
  requires them

#### Scenario: Multiplexed tab reattaches to its live session

- **WHEN** a restored tab had a multiplexer session that is still alive
- **THEN** connecting reattaches to that session, restoring its scrollback and running
  processes

#### Scenario: Only the root pane is restored

- **WHEN** a restored tab previously had split panes
- **THEN** the system restores the tab's root pane only (split layout is not recreated)

### Requirement: Skip Unrestorable Tabs Silently

When restoring, the system SHALL silently skip any tab that can no longer be restored — for
example, one whose connection has been deleted from the database since the previous session
— without aborting the rest of the restore.

#### Scenario: Deleted connection is skipped

- **WHEN** a restored tab references a connection that no longer exists in the database
- **THEN** that tab is skipped silently and the remaining tabs still restore
