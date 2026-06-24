# Application Shell

## Purpose

The cross-cutting desktop application frame: preferences, workspaces, window-state
persistence, system tray, command palette and hotkeys, fullscreen/quake terminal, and the
"Spectral Command" design system. Backed by the `preferences` table, renderer stores, and
`tray-manager`/`quake-terminal`/`window-router` services.

## Requirements

### Requirement: Preferences Persistence

The system SHALL persist user preferences and apply migrations across schema versions.

#### Scenario: Persist a preference

- **WHEN** a user changes a setting
- **THEN** it is saved to the `preferences` table and restored on next launch

#### Scenario: Migrate preferences

- **WHEN** the app starts with an older preferences version
- **THEN** the system migrates them to the current version without data loss

### Requirement: Workspaces

The system SHALL let users organize sessions into workspaces selectable from the navbar.

#### Scenario: Switch workspace

- **WHEN** a user selects a different workspace
- **THEN** the UI shows that workspace's sessions

### Requirement: Window State and Tray

The system SHALL persist window position/size across restarts and provide a system tray
with dynamic favorites and recent menus.

#### Scenario: Restore window state

- **WHEN** the app restarts
- **THEN** the window reopens at its previous position and size

#### Scenario: Tray quick connect

- **WHEN** a user opens the tray menu
- **THEN** it lists favorite and recent connections for quick access

### Requirement: Command Palette and Hotkeys

The system SHALL provide a fuzzy-search command palette (Ctrl+K) and multi-chord hotkeys.

#### Scenario: Open the command palette

- **WHEN** a user presses Ctrl+K
- **THEN** a fuzzy-search palette of actions and connections opens

#### Scenario: Multi-chord hotkey

- **WHEN** a user presses a chord prefix (Ctrl+K) followed by a second key
- **THEN** the corresponding chorded action runs

### Requirement: Fullscreen and Quake Terminal

The system SHALL toggle fullscreen (F11) and provide a drop-down quake terminal.

#### Scenario: Toggle fullscreen

- **WHEN** a user presses F11
- **THEN** the window toggles fullscreen

### Requirement: Spectral Command Design System

The UI SHALL follow the Spectral Command design system: no 1px borders (tonal background
shifts), ghost borders only on input fields, a spectral-thread focus indicator on inputs,
0.25rem rounding, JetBrains Mono for terminal/code and Inter for UI.

#### Scenario: Input focus indicator

- **WHEN** an input field gains focus
- **THEN** it shows the spectral-thread rainbow gradient focus indicator
