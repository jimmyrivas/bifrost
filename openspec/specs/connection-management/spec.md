# Connection Management

## Purpose

Store, organize, and edit the inventory of remote targets (connections), their grouping
hierarchy, and reusable templates. This is the system of record that every session,
tunnel, and automation feature reads from. Backed by the `connections`, `groups`,
`clusters`, `clusterMembers`, and `connectionTemplates` tables.

## Requirements

### Requirement: Connection CRUD

The system SHALL allow users to create, read, update, clone, and delete connections,
each persisting protocol, host, port, credentials reference, and per-connection options.

#### Scenario: Create a connection

- **WHEN** a user fills the connection form with a valid host and saves
- **THEN** the connection is persisted to the `connections` table and appears in the tree

#### Scenario: Clone a connection

- **WHEN** a user selects "Clone" from a connection's context menu
- **THEN** a new connection is created with identical settings and an editable name

#### Scenario: Validation blocks invalid input

- **WHEN** a user submits a connection form with a missing required field
- **THEN** the system SHALL show an inline error and SHALL NOT persist the connection

### Requirement: Hierarchical Grouping

The system SHALL organize connections into nested groups (folders) so users can manage
hundreds of targets, and SHALL support group-level actions.

#### Scenario: Open all in a group

- **WHEN** a user selects "Open All" on a group
- **THEN** the system opens a session for every connection in that group and its subgroups

#### Scenario: Create a sub-group

- **WHEN** a user adds a sub-group under an existing group
- **THEN** the new group is nested and persisted in the `groups` table

### Requirement: Connection Templates

The system SHALL allow saving a connection's settings as a reusable template and
creating new connections from it, persisted in `connectionTemplates`.

#### Scenario: Save session as profile

- **WHEN** a user chooses "Save session as profile" from the terminal context menu
- **THEN** the current session's connection settings are stored as a reusable template

### Requirement: Favorites, History, and Search

The system SHALL let users mark connections as favorites, SHALL record recently used
connections, and SHALL filter the tree by a search query and by tags.

#### Scenario: Toggle favorite

- **WHEN** a user toggles the star on a connection
- **THEN** the connection appears in the Favorites section and the state persists

#### Scenario: Filter by query

- **WHEN** a user types text in the tree search input
- **THEN** the tree shows only connections and groups matching the query

#### Scenario: Recent connections

- **WHEN** a user connects to a target
- **THEN** it is recorded with a timestamp and shown in the Recent section (last 10)

### Requirement: Import and Export

The system SHALL import and export the connection inventory as JSON via file dialogs.

#### Scenario: Export inventory

- **WHEN** a user chooses Export
- **THEN** the system writes the selected connections and groups to a JSON file

#### Scenario: Import inventory

- **WHEN** a user imports a valid JSON file
- **THEN** the contained connections and groups are added to the inventory

### Requirement: Wake-on-LAN

The system SHALL send a Wake-on-LAN magic packet for a connection that has a MAC address
configured.

#### Scenario: Wake a host

- **WHEN** a user selects "Wake-on-LAN" on a connection with a MAC address
- **THEN** the system broadcasts a magic packet to that MAC address
